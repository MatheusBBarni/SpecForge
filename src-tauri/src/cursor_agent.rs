use crate::{models::CursorModel, paths::canonicalize_existing_path, secrets::read_cursor_api_key};
use serde::{Deserialize, Serialize};
use std::{
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CursorAgentPromptRequest {
    api_key: String,
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

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum CursorAgentRunnerLine {
    Event { text: String },
    Result { content: String },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorModelsRunnerRequest {
    api_key: Option<String>,
}

#[tauri::command]
pub(crate) fn run_cursor_agent_prompt(
    payload: CursorAgentPromptRequest,
) -> Result<CursorAgentPromptResponse, String> {
    if payload.api_key.trim().is_empty() {
        return Err(String::from("Cursor API key is required."));
    }

    if payload.prompt.trim().is_empty() {
        return Err(String::from("Cursor prompt is required."));
    }

    let workspace_root = canonicalize_existing_path(&PathBuf::from(payload.workspace_root.trim()))
        .map_err(|error| format!("Unable to resolve workspace root: {error}"))?;
    let app_root = resolve_app_root()?;
    let runner_path = app_root.join("src").join("cursorAgentRunner.ts");

    if !runner_path.exists() {
        return Err(format!(
            "Cursor SDK runner was not found at {}.",
            runner_path.display()
        ));
    }

    let bun_path =
        which::which("bun").map_err(|error| format!("Unable to find Bun on PATH: {error}"))?;
    let request = CursorAgentPromptRequest {
        workspace_root: workspace_root.display().to_string(),
        ..payload
    };
    let request_json = serde_json::to_vec(&request)
        .map_err(|error| format!("Unable to prepare Cursor SDK request: {error}"))?;
    let mut child = Command::new(bun_path)
        .arg(&runner_path)
        .current_dir(&app_root)
        .env("NO_COLOR", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start the Bun Cursor SDK runner: {error}"))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| String::from("Unable to open the Cursor SDK runner input."))?;
    stdin
        .write_all(&request_json)
        .map_err(|error| format!("Unable to send the Cursor SDK request: {error}"))?;
    drop(stdin);

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Unable to read Cursor SDK runner output: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format_process_failure(&stderr, &stdout));
    }

    parse_runner_output(&stdout)
}

#[tauri::command]
pub(crate) fn list_cursor_models() -> Result<Vec<CursorModel>, String> {
    let api_key = read_cursor_api_key()?;
    let app_root = resolve_app_root()?;
    let runner_path = app_root.join("src").join("cursorModelsRunner.ts");

    if !runner_path.exists() {
        return Err(format!(
            "Cursor SDK model runner was not found at {}.",
            runner_path.display()
        ));
    }

    let bun_path =
        which::which("bun").map_err(|error| format!("Unable to find Bun on PATH: {error}"))?;
    let request_json = serde_json::to_vec(&CursorModelsRunnerRequest { api_key })
        .map_err(|error| format!("Unable to prepare Cursor model request: {error}"))?;
    let mut child = Command::new(bun_path)
        .arg(&runner_path)
        .current_dir(&app_root)
        .env("NO_COLOR", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start the Bun Cursor model runner: {error}"))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| String::from("Unable to open the Cursor model runner input."))?;
    stdin
        .write_all(&request_json)
        .map_err(|error| format!("Unable to send the Cursor model request: {error}"))?;
    drop(stdin);

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Unable to read Cursor model runner output: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format_process_failure(&stderr, &stdout));
    }

    serde_json::from_str(stdout.trim()).map_err(|error| {
        format!(
            "Cursor SDK model runner returned malformed output: {error}. Output: {}",
            stdout.trim()
        )
    })
}

fn resolve_app_root() -> Result<PathBuf, String> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| String::from("Unable to resolve the SpecForge application root."))
}

fn parse_runner_output(stdout: &str) -> Result<CursorAgentPromptResponse, String> {
    let mut events = Vec::new();
    let mut content = None;

    for line in stdout.lines().filter(|line| !line.trim().is_empty()) {
        let parsed: CursorAgentRunnerLine = serde_json::from_str(line).map_err(|error| {
            format!("Cursor SDK runner returned malformed output: {error}. Output line: {line}")
        })?;

        match parsed {
            CursorAgentRunnerLine::Event { text } => events.push(text),
            CursorAgentRunnerLine::Result { content: result } => content = Some(result),
        }
    }

    let content = content
        .filter(|result| !result.trim().is_empty())
        .ok_or_else(|| String::from("Cursor SDK runner returned no generated content."))?;

    Ok(CursorAgentPromptResponse { content, events })
}

fn format_process_failure(stderr: &str, stdout: &str) -> String {
    let mut details = stderr.trim().to_string();

    if details.is_empty() {
        details = stdout.trim().to_string();
    }

    if details.is_empty() {
        details = String::from("The Bun process exited without an error message.");
    }

    format!("Cursor SDK runner failed: {details}")
}
