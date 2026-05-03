use crate::{
    docker::{DockerRuntime, docker_mount_arg, sandcastle_build_args},
    generation::{
        create_spec_generation_temp_dir, format_process_failure as format_command_failure,
        map_codex_reasoning, run_command_with_stdin,
    },
    models::CursorModel,
    paths::canonicalize_existing_path,
    secrets::read_cursor_api_key,
};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CursorAgentPromptRequest {
    workspace_root: String,
    model: String,
    reasoning: String,
    prompt: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CursorAgentPromptResponse {
    content: String,
    events: Vec<String>,
}

const CODEX_REASONING_PARAMETER_ID: &str = "reasoning";

#[tauri::command]
pub(crate) async fn run_cursor_agent_prompt(
    payload: CursorAgentPromptRequest,
) -> Result<CursorAgentPromptResponse, String> {
    tauri::async_runtime::spawn_blocking(move || run_cursor_agent_prompt_sync(payload))
        .await
        .map_err(|error| format!("Unable to join Sandcastle runtime task: {error}"))?
}

fn run_cursor_agent_prompt_sync(
    payload: CursorAgentPromptRequest,
) -> Result<CursorAgentPromptResponse, String> {
    if payload.prompt.trim().is_empty() {
        return Err(String::from("Sandcastle prompt is required."));
    }

    let workspace_root = canonicalize_existing_path(&PathBuf::from(payload.workspace_root.trim()))
        .map_err(|error| format!("Unable to resolve workspace root: {error}"))?;
    let app_root = resolve_app_root()?;
    let docker = DockerRuntime::detect()?;
    let image = ensure_sandcastle_image(&app_root, &docker)?;
    let temp_dir = create_spec_generation_temp_dir("sandcastle-document")?;
    let output_path = temp_dir.join("assistant-message.md");
    let mut command = docker.command();
    command
        .arg("run")
        .arg("--rm")
        .arg("-i")
        .arg("-v")
        .arg(docker_mount_arg(
            &docker,
            &workspace_root,
            "/home/agent/workspace",
            "ro",
        ))
        .arg("-v")
        .arg(docker_mount_arg(
            &docker,
            &temp_dir,
            "/home/agent/output",
            "rw",
        ))
        .arg("-w")
        .arg("/home/agent/workspace")
        .env("NO_COLOR", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    configure_codex_auth(&mut command, &docker)?;

    command
        .arg(image)
        .arg("codex")
        .arg("exec")
        .arg("--color")
        .arg("never")
        .arg("--skip-git-repo-check")
        .arg("--sandbox")
        .arg("read-only")
        .arg("--model")
        .arg(payload.model)
        .arg("--config")
        .arg(format!(
            "model_reasoning_effort=\"{}\"",
            map_codex_reasoning(&payload.reasoning)
        ))
        .arg("--output-last-message")
        .arg("/home/agent/output/assistant-message.md");

    let output = run_command_with_stdin(&mut command, "Sandcastle Runtime", &payload.prompt)?;

    if !output.status.success() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(format_command_failure("Sandcastle Runtime", &output));
    }

    let content = std::fs::read_to_string(&output_path).or_else(|_| {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if stdout.is_empty() {
            Err(std::io::Error::other(
                "The Sandcastle Runtime returned no assistant content.",
            ))
        } else {
            Ok(stdout)
        }
    });
    let _ = std::fs::remove_dir_all(&temp_dir);

    Ok(CursorAgentPromptResponse {
        content: content.map_err(|error| format!("Unable to read Sandcastle output: {error}"))?,
        events: vec![String::from("Sandcastle Runtime completed the Codex turn.")],
    })
}

fn ensure_sandcastle_image(app_root: &Path, docker: &DockerRuntime) -> Result<String, String> {
    let dockerfile = app_root.join("src").join("sandcastle").join("Dockerfile");

    if !dockerfile.exists() {
        return Err(format!(
            "Sandcastle Dockerfile was not found at {}.",
            dockerfile.display()
        ));
    }

    let image = "specforge-sandcastle-runtime:latest";
    let mut command = docker.command();
    let output = command
        .args(sandcastle_build_args(docker, image, &dockerfile, app_root))
        .env("NO_COLOR", "1")
        .output()
        .map_err(|error| format!("Unable to build the Sandcastle runtime image: {error}"))?;

    if !output.status.success() {
        return Err(format_command_failure("Sandcastle image build", &output));
    }

    Ok(String::from(image))
}

fn configure_codex_auth(command: &mut Command, docker: &DockerRuntime) -> Result<(), String> {
    if let Some(api_key) = read_cursor_api_key()?.filter(|value| !value.trim().is_empty()) {
        command.arg("-e").arg(format!("OPENAI_API_KEY={api_key}"));
        return Ok(());
    }

    let codex_home = local_codex_auth_dir()
        .filter(|path| path.exists())
        .ok_or_else(|| {
            String::from("Codex authentication is required before running Sandcastle.")
        })?;
    command.arg("-v").arg(docker_mount_arg(
        docker,
        &codex_home,
        "/home/agent/.codex",
        "ro",
    ));

    Ok(())
}

fn local_codex_auth_dir() -> Option<PathBuf> {
    std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".codex")))
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".codex")))
}

#[tauri::command]
pub(crate) async fn list_cursor_models() -> Result<Vec<CursorModel>, String> {
    tauri::async_runtime::spawn_blocking(list_cursor_models_sync)
        .await
        .map_err(|error| format!("Unable to join Codex model discovery task: {error}"))?
}

fn list_cursor_models_sync() -> Result<Vec<CursorModel>, String> {
    let codex_path = which::which("codex")
        .map_err(|error| format!("Unable to find Codex CLI on PATH: {error}"))?;
    let live_output = Command::new(&codex_path)
        .args(["debug", "models"])
        .env("NO_COLOR", "1")
        .output()
        .map_err(|error| format!("Unable to start Codex model discovery: {error}"))?;

    if live_output.status.success() {
        let stdout = String::from_utf8_lossy(&live_output.stdout);
        let models = parse_codex_models_output(&stdout);

        if !models.is_empty() {
            return Ok(models);
        }
    }

    let bundled_output = Command::new(&codex_path)
        .args(["debug", "models", "--bundled"])
        .env("NO_COLOR", "1")
        .output()
        .map_err(|error| format!("Unable to start bundled Codex model discovery: {error}"))?;
    let bundled_stdout = String::from_utf8_lossy(&bundled_output.stdout);

    if bundled_output.status.success() {
        let models = parse_codex_models_output(&bundled_stdout);

        if !models.is_empty() {
            return Ok(models);
        }
    }

    let live_stderr = String::from_utf8_lossy(&live_output.stderr);
    let bundled_stderr = String::from_utf8_lossy(&bundled_output.stderr);
    Err(format!(
        "Codex model discovery returned no models. live: {} bundled: {}",
        live_stderr.trim(),
        bundled_stderr.trim()
    ))
}

fn resolve_app_root() -> Result<PathBuf, String> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| String::from("Unable to resolve the SpecForge application root."))
}

fn parse_codex_models_output(stdout: &str) -> Vec<CursorModel> {
    let trimmed = stdout.trim();

    if trimmed.is_empty() {
        return Vec::new();
    }

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        return parse_codex_models_json(&value);
    }

    parse_codex_models_lines(trimmed)
}

fn parse_codex_models_json(value: &serde_json::Value) -> Vec<CursorModel> {
    let model_values = value
        .as_array()
        .cloned()
        .or_else(|| {
            value
                .get("models")
                .and_then(|models| models.as_array().cloned())
        })
        .or_else(|| {
            value
                .get("availableModels")
                .and_then(|models| models.as_array().cloned())
        })
        .unwrap_or_default();

    if model_values.is_empty() {
        return parse_codex_models_object(value);
    }

    model_values
        .iter()
        .filter_map(|entry| {
            if let Some(id) = entry.as_str() {
                return Some(build_codex_model(id, None));
            }

            let id = entry
                .get("id")
                .or_else(|| entry.get("model"))
                .or_else(|| entry.get("modelId"))
                .or_else(|| entry.get("name"))
                .and_then(|value| value.as_str())?;
            let label = entry
                .get("label")
                .or_else(|| entry.get("name"))
                .and_then(|value| value.as_str());

            Some(build_codex_model(id, label))
        })
        .collect()
}

fn parse_codex_models_object(value: &serde_json::Value) -> Vec<CursorModel> {
    let Some(object) = value.as_object() else {
        return Vec::new();
    };

    object
        .iter()
        .filter_map(|(id, entry)| {
            if !looks_like_codex_model_id(id) {
                return None;
            }

            let label = entry
                .get("label")
                .or_else(|| entry.get("displayName"))
                .and_then(|value| value.as_str());

            Some(build_codex_model(id, label))
        })
        .collect()
}

fn looks_like_codex_model_id(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.starts_with("gpt-") || lower.starts_with("o3") || lower.starts_with("codex")
}

fn parse_codex_models_lines(stdout: &str) -> Vec<CursorModel> {
    stdout
        .lines()
        .filter_map(|line| {
            let id = line
                .split_whitespace()
                .find(|part| {
                    part.chars()
                        .any(|character| character.is_ascii_alphanumeric())
                })?
                .trim_matches(|character: char| matches!(character, '-' | '*' | ',' | ':'));

            if id.is_empty() || id.eq_ignore_ascii_case("model") || id.eq_ignore_ascii_case("id") {
                return None;
            }

            Some(build_codex_model(id, None))
        })
        .collect()
}

fn build_codex_model(id: &str, label: Option<&str>) -> CursorModel {
    CursorModel {
        id: id.to_string(),
        label: label
            .filter(|value| !value.trim().is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format_codex_model_label(id)),
        description: Some(String::from(
            "Codex CLI model available through Sandcastle.",
        )),
        parameters: Some(vec![crate::models::CursorModelParameter {
            id: String::from(CODEX_REASONING_PARAMETER_ID),
            label: String::from("Reasoning"),
            values: ["low", "medium", "high", "xhigh"]
                .iter()
                .map(|value| crate::models::CursorModelParameterValue {
                    value: (*value).to_string(),
                    label: format_reasoning_label(value),
                })
                .collect(),
        }]),
    }
}

fn format_codex_model_label(id: &str) -> String {
    let normalized = id.trim();

    if let Some(label) = format_gpt_model_label(normalized) {
        return label;
    }

    normalized
        .split(['-', '_'])
        .filter(|part| !part.is_empty())
        .map(format_model_label_part)
        .collect::<Vec<_>>()
        .join(" ")
}

fn format_gpt_model_label(id: &str) -> Option<String> {
    let mut parts = id.split(['-', '_']).filter(|part| !part.is_empty());
    let prefix = parts.next()?;

    if !prefix.eq_ignore_ascii_case("gpt") {
        return None;
    }

    let version = parts.next()?;
    let mut label = format!("GPT-{version}");
    let suffix = parts
        .map(format_model_label_part)
        .collect::<Vec<_>>()
        .join(" ");

    if !suffix.is_empty() {
        label.push(' ');
        label.push_str(&suffix);
    }

    Some(label)
}

fn format_model_label_part(part: &str) -> String {
    let upper = part.to_ascii_uppercase();
    if matches!(upper.as_str(), "GPT" | "API")
        || part
            .chars()
            .all(|character| character.is_ascii_digit() || character == '.')
    {
        upper
    } else {
        let mut characters = part.chars();
        match characters.next() {
            Some(first) => format!("{}{}", first.to_uppercase(), characters.as_str()),
            None => String::new(),
        }
    }
}

fn format_reasoning_label(value: &str) -> String {
    match value {
        "xhigh" => String::from("Extra High"),
        "high" => String::from("High"),
        "medium" => String::from("Medium"),
        "low" => String::from("Low"),
        _ => value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::parse_codex_models_output;

    #[test]
    fn parses_json_model_array() {
        let models = parse_codex_models_output(r#"[{"id":"gpt-5.2","label":"GPT-5.2"}]"#);

        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "gpt-5.2");
        assert_eq!(models[0].label, "GPT-5.2");
    }

    #[test]
    fn parses_models_property() {
        let models = parse_codex_models_output(r#"{"models":["gpt-5.4-mini"]}"#);

        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "gpt-5.4-mini");
    }

    #[test]
    fn parses_keyed_model_object() {
        let models = parse_codex_models_output(
            r#"{"gpt-5.4-mini":{"description":"fast"},"gpt-5.2":{"label":"GPT-5.2"}}"#,
        );

        assert_eq!(models.len(), 2);
        let mini_model = models
            .iter()
            .find(|model| model.id == "gpt-5.4-mini")
            .expect("expected gpt-5.4-mini");
        let default_model = models
            .iter()
            .find(|model| model.id == "gpt-5.2")
            .expect("expected gpt-5.2");

        assert_eq!(mini_model.label, "GPT-5.4 Mini");
        assert_eq!(default_model.label, "GPT-5.2");
    }

    #[test]
    fn parses_line_output() {
        let models = parse_codex_models_output("gpt-5.2\n- gpt-5.4");

        assert_eq!(models.len(), 2);
        assert_eq!(models[1].id, "gpt-5.4");
    }
}
