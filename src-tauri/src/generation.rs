use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::Command;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
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
    run_command_with_stdin_and_stream(command, display_name, stdin_payload, |_| {})
}

pub(crate) fn run_command_with_stdin_and_stream<F>(
    command: &mut Command,
    display_name: &str,
    stdin_payload: &str,
    mut on_line: F,
) -> Result<std::process::Output, String>
where
    F: FnMut(&str),
{
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

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("{display_name} did not expose stdout."))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| format!("{display_name} did not expose stderr."))?;
    let (line_sender, line_receiver) = mpsc::channel::<String>();
    let stdout_reader = spawn_stream_reader(stdout, line_sender.clone());
    let stderr_reader = spawn_stream_reader(stderr, line_sender);

    let status = loop {
        while let Ok(line) = line_receiver.try_recv() {
            on_line(&line);
        }

        match child
            .try_wait()
            .map_err(|error| format!("{display_name} exited unexpectedly: {error}"))?
        {
            Some(status) => break status,
            None => thread::sleep(Duration::from_millis(50)),
        }
    };

    while let Ok(line) = line_receiver.try_recv() {
        on_line(&line);
    }

    let stdout = stdout_reader
        .join()
        .map_err(|_| format!("{display_name} stdout reader panicked."))?;
    let stderr = stderr_reader
        .join()
        .map_err(|_| format!("{display_name} stderr reader panicked."))?;

    Ok(std::process::Output {
        status,
        stdout,
        stderr,
    })
}

fn spawn_stream_reader<R: std::io::Read + Send + 'static>(
    stream: R,
    line_sender: mpsc::Sender<String>,
) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut reader = BufReader::new(stream);
        let mut collected = Vec::new();
        let mut buffer = Vec::new();

        loop {
            buffer.clear();
            match reader.read_until(b'\n', &mut buffer) {
                Ok(0) => break,
                Ok(_) => {
                    collected.extend_from_slice(&buffer);
                    let line = String::from_utf8_lossy(&buffer).trim_end().to_string();
                    if !line.is_empty() {
                        let _ = line_sender.send(line);
                    }
                }
                Err(_) => break,
            }
        }

        collected
    })
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
