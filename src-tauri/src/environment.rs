use crate::models::{CliStatus, EnvironmentStatus};
use crate::paths::resolve_override_path;
use crate::secrets::cursor_key_status;
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub(crate) fn run_environment_scan() -> Result<EnvironmentStatus, String> {
    Ok(EnvironmentStatus {
        scanned_at: current_timestamp(),
        cursor: cursor_key_status(),
        git: inspect_binary("Git", "git", None),
    })
}

pub(crate) fn current_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| String::from("0"))
}

pub(crate) fn inspect_binary(
    display_name: &str,
    binary_name: &str,
    override_path: Option<&str>,
) -> CliStatus {
    let resolved_path = override_path
        .and_then(|value| {
            let candidate = resolve_override_path(value);
            candidate.exists().then_some(candidate)
        })
        .or_else(|| which::which(binary_name).ok());

    if let Some(path) = resolved_path {
        match probe_binary_version(&path) {
            Ok(version_detail) => {
                let detail = if override_path.is_some() {
                    format!("Using manual override. {version_detail}")
                } else {
                    format!("Detected on PATH. {version_detail}")
                };

                return CliStatus {
                    name: display_name.to_string(),
                    status: String::from("found"),
                    path: Some(path.display().to_string()),
                    detail,
                };
            }
            Err(error) if override_path.is_some() => {
                return CliStatus {
                    name: display_name.to_string(),
                    status: String::from("missing"),
                    path: None,
                    detail: format!(
                        "Manual override could not be executed at {}: {error}",
                        path.display()
                    ),
                };
            }
            Err(_) => {}
        }
    }

    CliStatus {
        name: display_name.to_string(),
        status: String::from("missing"),
        path: None,
        detail: String::from("Binary not found. Add a manual path or install it on PATH."),
    }
}

pub(crate) fn resolve_cli_binary(
    binary_name: &str,
    override_path: Option<&str>,
) -> Result<std::path::PathBuf, String> {
    if let Some(path_value) = override_path {
        let candidate = resolve_override_path(path_value);

        if !candidate.exists() {
            return Err(format!(
                "The configured {binary_name} path does not exist: {}",
                candidate.display()
            ));
        }

        return Ok(candidate);
    }

    which::which(binary_name).map_err(|_| {
        format!(
            "{binary_name} was not found on PATH. Set a manual binary path in Settings and refresh."
        )
    })
}

fn probe_binary_version(path: &Path) -> Result<String, String> {
    let output = Command::new(path)
        .arg("--version")
        .output()
        .map_err(|error| error.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !stdout.is_empty() {
        return Ok(stdout);
    }

    if !stderr.is_empty() {
        return Ok(stderr);
    }

    Ok(String::from(
        "Binary detected. Version probe returned no output.",
    ))
}
