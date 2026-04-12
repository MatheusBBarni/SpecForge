use crate::documents::write_generated_workspace_document;
use crate::environment::resolve_cli_binary;
use crate::models::WorkspaceDocument;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::async_runtime;

struct DocumentGenerationRequest {
    workspace_root: String,
    output_path: String,
    prompt_template: String,
    user_prompt: String,
    attachments: Vec<(String, String)>,
    provider: String,
    model: String,
    reasoning: String,
    claude_path: Option<String>,
    codex_path: Option<String>,
    field_name: &'static str,
}

#[tauri::command]
pub(crate) async fn generate_prd_document(
    workspace_root: String,
    output_path: String,
    prompt_template: String,
    user_prompt: String,
    provider: String,
    model: String,
    reasoning: String,
    claude_path: Option<String>,
    codex_path: Option<String>,
) -> Result<WorkspaceDocument, String> {
    let trimmed_prompt = user_prompt.trim();

    if trimmed_prompt.is_empty() {
        return Err(String::from(
            "Add the product context you want the AI to consider.",
        ));
    }

    run_workspace_document_generation(DocumentGenerationRequest {
        workspace_root,
        output_path,
        prompt_template,
        user_prompt: trimmed_prompt.to_string(),
        attachments: Vec::new(),
        provider,
        model,
        reasoning,
        claude_path,
        codex_path,
        field_name: "PRD output path",
    })
    .await
}

#[tauri::command]
pub(crate) async fn generate_spec_document(
    workspace_root: String,
    output_path: String,
    prd_content: String,
    prompt_template: String,
    user_prompt: String,
    provider: String,
    model: String,
    reasoning: String,
    claude_path: Option<String>,
    codex_path: Option<String>,
) -> Result<WorkspaceDocument, String> {
    let trimmed_prd = prd_content.trim();
    let trimmed_prompt = user_prompt.trim();

    if trimmed_prd.is_empty() {
        return Err(String::from(
            "Load or write a PRD before generating a specification.",
        ));
    }

    if trimmed_prompt.is_empty() {
        return Err(String::from(
            "Add the technical guidance you want the AI to consider.",
        ));
    }

    run_workspace_document_generation(DocumentGenerationRequest {
        workspace_root,
        output_path,
        prompt_template,
        user_prompt: trimmed_prompt.to_string(),
        attachments: vec![(
            String::from("Attached Product Requirements Document (PRD)"),
            trimmed_prd.to_string(),
        )],
        provider,
        model,
        reasoning,
        claude_path,
        codex_path,
        field_name: "SPEC output path",
    })
    .await
}

async fn run_workspace_document_generation(
    request: DocumentGenerationRequest,
) -> Result<WorkspaceDocument, String> {
    async_runtime::spawn_blocking(move || run_workspace_document_generation_blocking(request))
        .await
        .map_err(|error| format!("Document generation task failed: {error}"))?
}

fn run_workspace_document_generation_blocking(
    request: DocumentGenerationRequest,
) -> Result<WorkspaceDocument, String> {
    let attachments = request
        .attachments
        .iter()
        .map(|(label, content)| (label.as_str(), content.as_str()))
        .collect::<Vec<_>>();
    let prompt_payload =
        build_generation_prompt(&request.prompt_template, &request.user_prompt, &attachments);
    let generated_document = run_generation_request(
        &request.provider,
        &request.model,
        &request.reasoning,
        request.claude_path.as_deref(),
        request.codex_path.as_deref(),
        &prompt_payload,
    )?;

    write_generated_workspace_document(
        &request.workspace_root,
        &request.output_path,
        generated_document,
        request.field_name,
    )
}

pub(crate) fn build_generation_prompt(
    prompt_template: &str,
    user_prompt: &str,
    attachments: &[(&str, &str)],
) -> String {
    let mut prompt = String::new();
    prompt.push_str(prompt_template.trim());
    prompt.push_str("\n\n");
    prompt.push_str("Additional operator context:\n");
    prompt.push_str(user_prompt.trim());

    for (label, content) in attachments {
        let trimmed_content = content.trim();

        if trimmed_content.is_empty() {
            continue;
        }

        prompt.push_str("\n\n");
        prompt.push_str(label);
        prompt.push_str(":\n");
        prompt.push_str(trimmed_content);
    }

    prompt
}

pub(crate) fn run_generation_request(
    provider: &str,
    model: &str,
    reasoning: &str,
    claude_path: Option<&str>,
    codex_path: Option<&str>,
    prompt_payload: &str,
) -> Result<String, String> {
    match provider {
        "codex" => run_codex_generation(
            &resolve_cli_binary("codex", codex_path)?,
            model,
            reasoning,
            prompt_payload,
        ),
        "claude" => run_claude_generation(
            &resolve_cli_binary("claude", claude_path)?,
            model,
            reasoning,
            prompt_payload,
        ),
        _ => Err(format!("Unsupported model provider: {provider}")),
    }
}

pub(crate) fn run_codex_generation(
    binary_path: &std::path::Path,
    model: &str,
    reasoning: &str,
    prompt_payload: &str,
) -> Result<String, String> {
    let temp_dir = create_spec_generation_temp_dir("codex")?;
    let output_path = temp_dir.join("generated-spec.md");
    let reasoning_effort = map_codex_reasoning(reasoning);

    let mut command = Command::new(binary_path);
    command
        .current_dir(&temp_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("exec")
        .arg("--color")
        .arg("never")
        .arg("--skip-git-repo-check")
        .arg("--sandbox")
        .arg("read-only")
        .arg("--model")
        .arg(model)
        .arg("--config")
        .arg(format!("model_reasoning_effort=\"{reasoning_effort}\""))
        .arg("--output-last-message")
        .arg(&output_path);

    let result = run_command_with_stdin(&mut command, "Codex CLI", prompt_payload).and_then(
        |output| {
            if !output.status.success() {
                return Err(format_process_failure("Codex CLI", &output));
            }

            match fs::read_to_string(&output_path) {
                Ok(content) => Ok(content),
                Err(read_error) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

                    if !stdout.trim().is_empty() {
                        Ok(stdout)
                    } else {
                        Err(format!(
                            "Codex CLI completed, but the generated spec could not be read: {read_error}"
                        ))
                    }
                }
            }
        },
    );

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

pub(crate) fn run_claude_generation(
    binary_path: &std::path::Path,
    model: &str,
    reasoning: &str,
    prompt_payload: &str,
) -> Result<String, String> {
    let temp_dir = create_spec_generation_temp_dir("claude")?;
    let mut command = Command::new(binary_path);
    command
        .current_dir(&temp_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("--print")
        .arg("Respond to the request provided on stdin.")
        .arg("--model")
        .arg(model)
        .arg("--output-format")
        .arg("text")
        .arg("--permission-mode")
        .arg("bypassPermissions")
        .arg("--tools")
        .arg("")
        .arg("--max-turns")
        .arg("1")
        .arg("--no-session-persistence")
        .arg("--effort")
        .arg(map_claude_reasoning(reasoning));

    let result =
        run_command_with_stdin(&mut command, "Claude CLI", prompt_payload).and_then(|output| {
            if !output.status.success() {
                return Err(format_process_failure("Claude CLI", &output));
            }

            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        });

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

pub(crate) fn create_spec_generation_temp_dir(prefix: &str) -> Result<PathBuf, String> {
    let base_dir = std::env::temp_dir().join("specforge");
    fs::create_dir_all(&base_dir)
        .map_err(|error| format!("Unable to prepare temporary generation folder: {error}"))?;
    let unique_suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let temp_dir = base_dir.join(format!("{prefix}-{unique_suffix}-{}", std::process::id()));

    fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("Unable to prepare temporary generation folder: {error}"))?;

    Ok(temp_dir)
}

pub(crate) fn run_command_with_stdin(
    command: &mut Command,
    display_name: &str,
    stdin_payload: &str,
) -> Result<std::process::Output, String> {
    let mut child = command
        .spawn()
        .map_err(|error| format!("Unable to start {display_name}: {error}"))?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| format!("{display_name} did not expose stdin."))?;

    stdin
        .write_all(stdin_payload.as_bytes())
        .map_err(|error| format!("Unable to send the prompt to {display_name}: {error}"))?;
    drop(stdin);

    child
        .wait_with_output()
        .map_err(|error| format!("{display_name} exited unexpectedly: {error}"))
}

pub(crate) fn format_process_failure(display_name: &str, output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let details = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("{display_name} exited with status {}", output.status)
    };

    format!("{display_name} failed: {details}")
}

pub(crate) fn map_codex_reasoning(reasoning: &str) -> &str {
    match reasoning {
        "max" => "xhigh",
        "high" => "high",
        "low" => "low",
        _ => "medium",
    }
}

pub(crate) fn map_claude_reasoning(reasoning: &str) -> &str {
    match reasoning {
        "max" => "high",
        "high" => "high",
        "low" => "low",
        _ => "medium",
    }
}
