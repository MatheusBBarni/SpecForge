use std::{
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum DockerRuntime {
    Host { binary: PathBuf },
    Wsl { distribution: Option<String> },
}

impl DockerRuntime {
    pub(crate) fn detect() -> Result<Self, String> {
        let host_result = detect_host_docker();

        if let Ok(runtime) = host_result {
            return Ok(runtime);
        }

        #[cfg(windows)]
        {
            let wsl_result = detect_wsl_docker();

            if let Ok(runtime) = wsl_result {
                return Ok(runtime);
            }

            Err(format!(
                "{} WSL Docker probe also failed: {}",
                host_result
                    .err()
                    .unwrap_or_else(|| String::from("Host Docker probe failed.")),
                wsl_result
                    .err()
                    .unwrap_or_else(|| String::from("unknown error"))
            ))
        }

        #[cfg(not(windows))]
        {
            Err(host_result
                .err()
                .unwrap_or_else(|| String::from("Docker is unavailable.")))
        }
    }

    pub(crate) fn command(&self) -> Command {
        match self {
            Self::Host { binary } => Command::new(binary),
            Self::Wsl { distribution } => {
                let mut command = Command::new("wsl");
                if let Some(distribution) = distribution {
                    command.args(["-d", distribution]);
                }
                command.args(["--", "docker"]);
                command
            }
        }
    }

    pub(crate) fn label(&self) -> String {
        match self {
            Self::Host { .. } => String::from("host Docker"),
            Self::Wsl {
                distribution: Some(distribution),
            } => format!("WSL Docker ({distribution})"),
            Self::Wsl { distribution: None } => String::from("default WSL Docker"),
        }
    }
}

fn detect_host_docker() -> Result<DockerRuntime, String> {
    let binary = which::which("docker")
        .map_err(|error| format!("Docker CLI was not found on the host PATH: {error}"))?;
    let status = run_status_with_timeout(
        Command::new(&binary)
            .arg("info")
            .stdout(Stdio::null())
            .stderr(Stdio::null()),
        Duration::from_secs(5),
    )?;

    if status.success() {
        Ok(DockerRuntime::Host { binary })
    } else {
        Err(format!(
            "Host Docker CLI was found at {}, but the daemon probe exited with status {status}.",
            binary.display()
        ))
    }
}

#[cfg(windows)]
fn detect_wsl_docker() -> Result<DockerRuntime, String> {
    let default_result = probe_wsl_docker(None);

    if default_result.is_ok() {
        return Ok(DockerRuntime::Wsl { distribution: None });
    }

    for distribution in wsl_distributions()? {
        if probe_wsl_docker(Some(&distribution)).is_ok() {
            return Ok(DockerRuntime::Wsl {
                distribution: Some(distribution),
            });
        }
    }

    Err(format!(
        "default WSL Docker probe failed: {}",
        default_result
            .err()
            .unwrap_or_else(|| String::from("unknown error"))
    ))
}

#[cfg(windows)]
fn probe_wsl_docker(distribution: Option<&str>) -> Result<(), String> {
    let mut command = Command::new("wsl");
    if let Some(distribution) = distribution {
        command.args(["-d", distribution]);
    }
    command
        .args(["--", "docker", "info"])
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let status = run_status_with_timeout(&mut command, Duration::from_secs(10))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("probe exited with status {status}."))
    }
}

#[cfg(windows)]
fn wsl_distributions() -> Result<Vec<String>, String> {
    let output = Command::new("wsl")
        .args(["-l", "-q"])
        .output()
        .map_err(|error| format!("Unable to list WSL distributions: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "Unable to list WSL distributions: {}",
            output.status
        ));
    }

    Ok(parse_wsl_distribution_output(&output.stdout))
}

fn parse_wsl_distribution_output(output: &[u8]) -> Vec<String> {
    decode_wsl_output(output)
        .lines()
        .map(|line| line.trim_matches(['\0', '\r', '\n', ' ', '\t']))
        .filter(|line| !line.is_empty())
        .filter(|line| {
            !line.eq_ignore_ascii_case("docker-desktop")
                && !line.eq_ignore_ascii_case("docker-desktop-data")
        })
        .map(str::to_string)
        .collect()
}

fn decode_wsl_output(output: &[u8]) -> String {
    if output.len() >= 2
        && output
            .chunks(2)
            .all(|chunk| chunk.get(1).copied() == Some(0))
    {
        let units = output
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        String::from_utf16_lossy(&units)
    } else {
        String::from_utf8_lossy(output).to_string()
    }
}

pub(crate) fn docker_path_arg(runtime: &DockerRuntime, path: &Path) -> String {
    match runtime {
        DockerRuntime::Host { .. } => path.display().to_string(),
        DockerRuntime::Wsl { .. } => windows_path_to_wsl(path)
            .unwrap_or_else(|| path.display().to_string().replace('\\', "/")),
    }
}

pub(crate) fn docker_mount_arg(
    runtime: &DockerRuntime,
    host_path: &Path,
    container_path: &str,
    mode: &str,
) -> String {
    format!(
        "{}:{container_path}:{mode}",
        docker_path_arg(runtime, host_path)
    )
}

pub(crate) fn sandcastle_build_args(
    runtime: &DockerRuntime,
    image: &str,
    dockerfile: &Path,
    app_root: &Path,
) -> Vec<String> {
    vec![
        String::from("build"),
        String::from("-t"),
        image.to_string(),
        String::from("-f"),
        docker_path_arg(runtime, dockerfile),
        docker_path_arg(runtime, app_root),
    ]
}

fn windows_path_to_wsl(path: &Path) -> Option<String> {
    let raw = path.display().to_string().replace('\\', "/");
    let mut chars = raw.chars();
    let drive = chars.next()?;
    let colon = chars.next()?;
    let slash = chars.next()?;

    if !drive.is_ascii_alphabetic() || colon != ':' || slash != '/' {
        return None;
    }

    Some(format!(
        "/mnt/{}/{}",
        drive.to_ascii_lowercase(),
        chars.as_str()
    ))
}

fn run_status_with_timeout(
    command: &mut Command,
    timeout: Duration,
) -> Result<std::process::ExitStatus, String> {
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
            None => std::thread::sleep(Duration::from_millis(50)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{DockerRuntime, docker_mount_arg, docker_path_arg, sandcastle_build_args};
    use std::path::{Path, PathBuf};

    #[test]
    fn host_build_args_include_explicit_context() {
        let args = sandcastle_build_args(
            &DockerRuntime::Host {
                binary: PathBuf::from("docker"),
            },
            "specforge-sandcastle-runtime:latest",
            Path::new(r"C:\repo\src\sandcastle\Dockerfile"),
            Path::new(r"C:\repo"),
        );

        assert_eq!(args.last().map(String::as_str), Some(r"C:\repo"));
    }

    #[test]
    fn host_paths_keep_unix_paths_for_macos_and_linux() {
        let path = docker_path_arg(
            &DockerRuntime::Host {
                binary: PathBuf::from("docker"),
            },
            Path::new("/Users/brehm/SpecForge"),
        );

        assert_eq!(path, "/Users/brehm/SpecForge");
    }

    #[test]
    fn wsl_paths_convert_windows_drive_paths_to_mnt_paths() {
        let converted = docker_path_arg(
            &DockerRuntime::Wsl { distribution: None },
            Path::new(r"C:\Users\brehm\Project"),
        );

        assert_eq!(converted, "/mnt/c/Users/brehm/Project");
    }

    #[test]
    fn wsl_mount_args_use_converted_host_paths() {
        let mount = docker_mount_arg(
            &DockerRuntime::Wsl {
                distribution: Some(String::from("Ubuntu")),
            },
            Path::new(r"D:\Work Space\SpecForge"),
            "/home/agent/workspace",
            "ro",
        );

        assert_eq!(
            mount,
            "/mnt/d/Work Space/SpecForge:/home/agent/workspace:ro"
        );
    }

    #[test]
    fn distro_wsl_runtime_keeps_wsl_path_conversion() {
        let converted = docker_path_arg(
            &DockerRuntime::Wsl {
                distribution: Some(String::from("Ubuntu-24.04")),
            },
            Path::new(r"C:\repo"),
        );

        assert_eq!(converted, "/mnt/c/repo");
    }

    #[test]
    fn parses_wsl_distribution_output_and_skips_docker_internal_distros() {
        let output =
            "Ubuntu\0\r\0\n\0docker-desktop\0\r\0\n\0docker-desktop-data\0\r\0\n\0Debian\0\r\0\n\0";
        let bytes = output
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();

        assert_eq!(
            super::parse_wsl_distribution_output(&bytes),
            vec![String::from("Ubuntu"), String::from("Debian")]
        );
    }
}
