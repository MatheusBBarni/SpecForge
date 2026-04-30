use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

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
