use crate::docker::DockerRuntime;
use crate::models::{CliStatus, EnvironmentStatus};
use crate::paths::resolve_override_path;
use crate::secrets::cursor_key_status;
use std::path::Path;
use std::process::Command;
#[cfg(windows)]
use std::process::Output;
#[cfg(windows)]
use std::process::Stdio;
#[cfg(windows)]
use std::thread;
#[cfg(windows)]
use std::time::{Duration, Instant};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub(crate) fn run_environment_scan() -> Result<EnvironmentStatus, String> {
    Ok(EnvironmentStatus {
        scanned_at: current_timestamp(),
        cursor: cursor_key_status(),
        codex: inspect_binary("Codex CLI", "codex", None),
        docker: inspect_docker(),
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

fn inspect_docker() -> CliStatus {
    match DockerRuntime::detect() {
        Ok(runtime) => {
            let label = runtime.label();
            CliStatus {
                name: String::from("Docker"),
                status: String::from("found"),
                path: Some(label.clone()),
                detail: format!("Docker daemon is reachable through {label}."),
            }
        }
        Err(error) => CliStatus {
            name: String::from("Docker"),
            status: String::from("unavailable"),
            path: which::which("docker")
                .ok()
                .map(|path| path.display().to_string()),
            detail: docker_unavailable_detail(&error, windows_docker_service_hint()),
        },
    }
}

fn docker_unavailable_detail(error: &str, service_hint: Option<String>) -> String {
    let mut detail = format!(
        "Docker CLI was found, but the Docker engine did not respond. Docker Desktop may still be starting or its WSL engine may be unhealthy. Probe failed: {error}"
    );

    if let Some(hint) = service_hint {
        detail.push(' ');
        detail.push_str(&hint);
    }

    detail
}

#[cfg(windows)]
fn windows_docker_service_hint() -> Option<String> {
    let output = run_output_with_timeout(
        Command::new("sc")
            .arg("query")
            .arg("com.docker.service")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped()),
        Duration::from_secs(2),
    )
    .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}\n{stderr}");

    if combined.contains("STOPPED") {
        return Some(String::from(
            "Windows also reports com.docker.service is stopped. Restart Docker Desktop as an administrator or start the Docker Desktop Service, then refresh the scan.",
        ));
    }

    if combined.contains("RUNNING") {
        return Some(String::from(
            "Windows reports com.docker.service is running, so the issue is likely in Docker Desktop's WSL engine or daemon startup.",
        ));
    }

    None
}

#[cfg(not(windows))]
fn windows_docker_service_hint() -> Option<String> {
    None
}

#[cfg(windows)]
fn run_output_with_timeout(command: &mut Command, timeout: Duration) -> Result<Output, String> {
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let started_at = Instant::now();

    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(_) => return child.wait_with_output().map_err(|error| error.to_string()),
            None if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("process timed out after {}s", timeout.as_secs()));
            }
            None => thread::sleep(Duration::from_millis(50)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::docker_unavailable_detail;

    #[test]
    fn docker_unavailable_detail_includes_windows_service_hint_when_present() {
        let detail = docker_unavailable_detail(
            "process timed out after 5s",
            Some(String::from(
                "Windows reports com.docker.service is stopped.",
            )),
        );

        assert!(detail.contains("process timed out after 5s"));
        assert!(detail.contains("com.docker.service is stopped"));
    }
}
