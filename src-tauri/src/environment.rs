use crate::models::{CliStatus, EnvironmentStatus};
use crate::paths::resolve_override_path;
use crate::secrets::cursor_key_status;
use std::path::Path;
use std::process::{Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

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
    let status = inspect_binary("Docker", "docker", None);

    if status.status != "found" {
        return status;
    }

    let Some(path) = status.path.clone() else {
        return status;
    };
    let output = run_status_with_timeout(
        Command::new(&path)
            .arg("info")
            .stdout(Stdio::null())
            .stderr(Stdio::null()),
        Duration::from_secs(5),
    );

    docker_status_from_probe_result(Some(path), output, status)
}

fn docker_status_from_probe_result(
    path: Option<String>,
    output: Result<ExitStatus, String>,
    mut found_status: CliStatus,
) -> CliStatus {
    match output {
        Ok(status_code) if status_code.success() => {
            found_status.detail = format!("{} Docker daemon is reachable.", found_status.detail);
            found_status
        }
        Ok(status_code) => CliStatus {
            name: String::from("Docker"),
            status: String::from("unavailable"),
            path,
            detail: format!(
                "Docker CLI was found, but the daemon is not reachable. Exit status: {status_code}"
            ),
        },
        Err(error) => CliStatus {
            name: String::from("Docker"),
            status: String::from("unavailable"),
            path,
            detail: format!(
                "Docker CLI was found, but the Docker engine did not respond. Docker Desktop may still be starting or its WSL engine may be unhealthy. Probe failed: {error}"
            ),
        },
    }
}

fn run_status_with_timeout(
    command: &mut Command,
    timeout: Duration,
) -> Result<ExitStatus, String> {
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let started_at = Instant::now();

    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(status) => return Ok(status),
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
    use super::{docker_status_from_probe_result, run_status_with_timeout};
    use crate::models::CliStatus;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    #[test]
    fn command_timeout_returns_before_process_finishes() {
        let started_at = Instant::now();
        let result = run_status_with_timeout(
            sleeper_command()
                .stdout(Stdio::null())
                .stderr(Stdio::null()),
            Duration::from_millis(100),
        );

        assert!(result.is_err());
        assert!(started_at.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn docker_probe_timeout_is_reported_as_unavailable() {
        let status = docker_status_from_probe_result(
            Some(String::from("docker")),
            Err(String::from("process timed out after 5s")),
            CliStatus {
                name: String::from("Docker"),
                status: String::from("found"),
                path: Some(String::from("docker")),
                detail: String::from("Detected on PATH. Docker version 1.0"),
            },
        );

        assert_eq!(status.status, "unavailable");
        assert!(status.detail.contains("Docker engine did not respond"));
    }

    #[cfg(windows)]
    fn sleeper_command() -> Command {
        let mut command = Command::new("powershell");
        command.args(["-NoProfile", "-Command", "Start-Sleep -Seconds 5"]);
        command
    }

    #[cfg(not(windows))]
    fn sleeper_command() -> Command {
        let mut command = Command::new("sh");
        command.args(["-c", "sleep 5"]);
        command
    }
}
