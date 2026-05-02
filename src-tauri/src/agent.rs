use crate::models::{AgentStateEvent, ApprovalWaitOutcome};
use crate::state::{ExecutionRuntime, SharedState, WorkspaceContext};
use crate::{
    constants::SAMPLE_DIFF,
    generation::{
        create_spec_generation_temp_dir, format_process_failure, map_codex_reasoning,
        run_command_with_stdin_and_stream,
    },
    git::git_get_diff_for_root,
    secrets::read_cursor_api_key,
};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Arc,
    thread,
};
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub(crate) fn spawn_cli_agent(
    app: AppHandle,
    state: State<SharedState>,
    spec_payload: String,
    mode: String,
    model: String,
    reasoning: String,
) -> Result<(), String> {
    let runtime = state.runtime.clone();
    let run_id = {
        let mut control = runtime
            .control
            .lock()
            .map_err(|_| String::from("Execution lock was poisoned."))?;
        control.run_id = control.run_id.wrapping_add(1);
        control.awaiting_approval = false;
        control.stop_requested = false;
        control.active_container = None;
        control.run_id
    };

    let workspace = state
        .workspace
        .lock()
        .map_err(|_| String::from("Workspace lock was poisoned."))?
        .clone();

    thread::spawn(move || {
        run_sandcastle_agent(
            app,
            runtime,
            workspace,
            run_id,
            spec_payload,
            mode,
            model,
            reasoning,
        );
    });

    Ok(())
}

#[tauri::command]
pub(crate) fn approve_action(state: State<SharedState>) -> Result<(), String> {
    let mut control = state
        .runtime
        .control
        .lock()
        .map_err(|_| String::from("Execution lock was poisoned."))?;
    control.awaiting_approval = false;
    state.runtime.signal.notify_all();
    Ok(())
}

#[tauri::command]
pub(crate) fn kill_agent_process(state: State<SharedState>) -> Result<(), String> {
    let mut control = state
        .runtime
        .control
        .lock()
        .map_err(|_| String::from("Execution lock was poisoned."))?;
    control.stop_requested = true;
    control.awaiting_approval = false;
    let active_container = control.active_container.clone();
    state.runtime.signal.notify_all();
    drop(control);

    if let Some(container_name) = active_container {
        let _ = force_remove_container(&container_name);
    }

    Ok(())
}

pub(crate) fn run_sandcastle_agent(
    app: AppHandle,
    runtime: Arc<ExecutionRuntime>,
    workspace: Option<WorkspaceContext>,
    run_id: u64,
    spec_payload: String,
    mode: String,
    model: String,
    reasoning: String,
) {
    let Some(workspace) = workspace else {
        emit_line(
            &app,
            "Choose a project workspace before starting Sandcastle execution.",
        );
        emit_state(
            &app,
            "error",
            Some("Workspace Required"),
            None,
            Some("Choose a project workspace before starting execution."),
        );
        return;
    };

    emit_state(&app, "executing", Some("Sandcastle Pre-flight"), None, None);
    emit_line(
        &app,
        "Preparing the Sandcastle Runtime sandbox for execution.",
    );

    if mode == "stepped" {
        match wait_for_approval(
            &app,
            &runtime,
            run_id,
            "Stepped Approval",
            "Approve this Sandcastle execution turn before the sandbox runs.",
        ) {
            Ok(ApprovalWaitOutcome::Approved) => {}
            Ok(ApprovalWaitOutcome::StopRequested) => {
                emit_line(&app, "Execution interrupted during approval gate.");
                emit_state(
                    &app,
                    "halted",
                    Some("Stepped Approval"),
                    None,
                    Some("Execution interrupted by the operator."),
                );
                return;
            }
            Ok(ApprovalWaitOutcome::Replaced) => return,
            Err(message) => {
                emit_line(&app, &message);
                emit_state(
                    &app,
                    "error",
                    Some("Stepped Approval"),
                    None,
                    Some(&message),
                );
                return;
            }
        }
    }

    let container_name = format!("specforge-exec-{run_id}");

    match run_sandcastle_execution_turn(
        &app,
        &runtime,
        run_id,
        &workspace.root,
        &spec_payload,
        &model,
        &reasoning,
        &container_name,
    ) {
        Ok(result) => {
            if stop_was_requested(&runtime, run_id) {
                emit_line(&app, "Execution stopped while Sandcastle was running.");
                emit_state(
                    &app,
                    "halted",
                    Some("Sandcastle Runtime"),
                    None,
                    Some("Execution stopped by the operator."),
                );
                return;
            }

            let host_diff =
                git_get_diff_for_root(&workspace.root).unwrap_or_else(|_| SAMPLE_DIFF.to_string());
            let sandbox_result = format!(
                "{}\n\n--- Sandcastle Result ---\n{}",
                if host_diff.trim().is_empty() {
                    SAMPLE_DIFF
                } else {
                    host_diff.trim()
                },
                result.trim()
            );
            emit_line(
                &app,
                "Sandcastle execution turn completed. Review the sandbox result.",
            );

            if mode == "milestone" {
                match wait_for_approval(
                    &app,
                    &runtime,
                    run_id,
                    "Milestone Approval",
                    "Milestone boundary reached. Review the Sandcastle result before continuing.",
                ) {
                    Ok(ApprovalWaitOutcome::Approved) => {}
                    Ok(ApprovalWaitOutcome::StopRequested) => {
                        emit_line(&app, "Execution interrupted during milestone approval.");
                        emit_state(
                            &app,
                            "halted",
                            Some("Milestone Approval"),
                            None,
                            Some("Execution interrupted by the operator."),
                        );
                        return;
                    }
                    Ok(ApprovalWaitOutcome::Replaced) => return,
                    Err(message) => {
                        emit_line(&app, &message);
                        emit_state(
                            &app,
                            "error",
                            Some("Milestone Approval"),
                            None,
                            Some(&message),
                        );
                        return;
                    }
                }
            }

            emit_state(
                &app,
                "completed",
                Some("Execution Complete"),
                Some(&sandbox_result),
                Some("Sandcastle execution completed. The sandbox result is ready for review."),
            );
        }
        Err(error) => {
            if stop_was_requested(&runtime, run_id) {
                emit_line(&app, "Execution stopped while Sandcastle was running.");
                emit_state(
                    &app,
                    "halted",
                    Some("Sandcastle Runtime"),
                    None,
                    Some("Execution stopped by the operator."),
                );
                return;
            }

            emit_line(&app, &error);
            emit_state(
                &app,
                "error",
                Some("Sandcastle Runtime"),
                None,
                Some(&error),
            );
        }
    }
}

fn run_sandcastle_execution_turn(
    app: &AppHandle,
    runtime: &Arc<ExecutionRuntime>,
    run_id: u64,
    workspace_root: &Path,
    spec_payload: &str,
    model: &str,
    reasoning: &str,
    container_name: &str,
) -> Result<String, String> {
    let temp_dir = create_spec_generation_temp_dir("sandcastle-execution")?;
    let output_path = temp_dir.join("assistant-message.md");
    let diff_path = temp_dir.join("sandbox.diff");
    let image = ensure_sandcastle_image()?;
    let prompt = format!(
        "Execute from this approved technical specification inside the sandbox. Do not mutate the host workspace directly. Return a concise Sandbox Result with the intended patch, commands, or blockers.\n\n{}",
        spec_payload
    );
    let mut command = Command::new("docker");
    command
        .arg("run")
        .arg("--rm")
        .arg("-i")
        .arg("--name")
        .arg(container_name)
        .arg("-v")
        .arg(format!("{}:/home/agent/input:ro", workspace_root.display()))
        .arg("-v")
        .arg(format!("{}:/home/agent/output", temp_dir.display()))
        .arg("-e")
        .arg(format!("SPECFORGE_CODEX_MODEL={model}"))
        .arg("-e")
        .arg(format!(
            "SPECFORGE_CODEX_REASONING={}",
            map_codex_reasoning(reasoning)
        ))
        .arg("-e")
        .arg("SPECFORGE_CODEX_SANDBOX=workspace-write")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    configure_codex_auth(&mut command)?;

    command
        .arg(image)
        .arg("sh")
        .arg("-lc")
        .arg(sandcastle_codex_script());

    set_active_container(runtime, run_id, Some(container_name.to_string()))?;
    let output =
        run_command_with_stdin_and_stream(&mut command, "Sandcastle Runtime", &prompt, |line| {
            emit_line(app, line);
        });
    let clear_result = set_active_container(runtime, run_id, None);
    clear_result?;
    let output = output?;

    if !output.status.success() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(format_process_failure("Sandcastle Runtime", &output));
    }

    let result = fs::read_to_string(&output_path).or_else(|_| {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if stdout.is_empty() {
            Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "The Sandcastle Runtime returned no sandbox result.",
            ))
        } else {
            Ok(stdout)
        }
    });
    let mut result = match result {
        Ok(result) => result,
        Err(error) => {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(format!("Unable to read the Sandcastle result: {error}"));
        }
    };
    if let Ok(diff) = fs::read_to_string(&diff_path) {
        if !diff.trim().is_empty() {
            result.push_str("\n\n--- Sandbox Diff ---\n");
            result.push_str(diff.trim());
        }
    }
    let _ = fs::remove_dir_all(&temp_dir);

    Ok(result)
}

fn sandcastle_codex_script() -> &'static str {
    r#"set -eu
mkdir -p /home/agent/workspace
cp -a /home/agent/input/. /home/agent/workspace/
cd /home/agent/workspace
codex exec --color never --skip-git-repo-check --sandbox "$SPECFORGE_CODEX_SANDBOX" --model "$SPECFORGE_CODEX_MODEL" --config "model_reasoning_effort=\"$SPECFORGE_CODEX_REASONING\"" --output-last-message /home/agent/output/assistant-message.md
git diff --no-ext-diff > /home/agent/output/sandbox.diff || true
"#
}

fn set_active_container(
    runtime: &Arc<ExecutionRuntime>,
    run_id: u64,
    active_container: Option<String>,
) -> Result<(), String> {
    let mut control = runtime
        .control
        .lock()
        .map_err(|_| String::from("Execution lock was poisoned."))?;

    if control.run_id == run_id {
        control.active_container = active_container;
    }

    Ok(())
}

fn stop_was_requested(runtime: &Arc<ExecutionRuntime>, run_id: u64) -> bool {
    runtime
        .control
        .lock()
        .map(|control| control.run_id == run_id && control.stop_requested)
        .unwrap_or(true)
}

fn force_remove_container(container_name: &str) -> Result<(), String> {
    let output = Command::new("docker")
        .arg("rm")
        .arg("-f")
        .arg(container_name)
        .output()
        .map_err(|error| {
            format!("Unable to stop Sandcastle container {container_name}: {error}")
        })?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format_process_failure("Docker stop", &output))
    }
}

fn ensure_sandcastle_image() -> Result<String, String> {
    let app_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| String::from("Unable to resolve the SpecForge application root."))?;
    let dockerfile = app_root.join("src").join("sandcastle").join("Dockerfile");

    if !dockerfile.exists() {
        return Err(format!(
            "Sandcastle Dockerfile was not found at {}.",
            dockerfile.display()
        ));
    }

    let image = "specforge-sandcastle-runtime:latest";
    let output = Command::new("docker")
        .arg("build")
        .arg("-t")
        .arg(image)
        .arg("-f")
        .arg(&dockerfile)
        .current_dir(&app_root)
        .env("NO_COLOR", "1")
        .output()
        .map_err(|error| format!("Unable to build the Sandcastle runtime image: {error}"))?;

    if !output.status.success() {
        return Err(format_process_failure("Sandcastle image build", &output));
    }

    Ok(String::from(image))
}

fn configure_codex_auth(command: &mut Command) -> Result<(), String> {
    if let Some(api_key) = read_cursor_api_key()?.filter(|value| !value.trim().is_empty()) {
        command.arg("-e").arg(format!("OPENAI_API_KEY={api_key}"));
        return Ok(());
    }

    let codex_home = local_codex_auth_dir()
        .filter(|path| path.exists())
        .ok_or_else(|| {
            String::from("Codex authentication is required before running Sandcastle.")
        })?;
    command
        .arg("-v")
        .arg(format!("{}:/home/agent/.codex:ro", codex_home.display()));

    Ok(())
}

fn local_codex_auth_dir() -> Option<PathBuf> {
    std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".codex")))
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".codex")))
}

pub(crate) fn wait_for_approval(
    app: &AppHandle,
    runtime: &Arc<ExecutionRuntime>,
    run_id: u64,
    milestone: &str,
    summary: &str,
) -> Result<ApprovalWaitOutcome, String> {
    emit_state(
        app,
        "awaiting_approval",
        Some(milestone),
        Some(SAMPLE_DIFF),
        Some(summary),
    );

    let mut control = runtime
        .control
        .lock()
        .map_err(|_| String::from("Execution lock was poisoned."))?;
    control.awaiting_approval = true;
    runtime.signal.notify_all();

    while control.run_id == run_id && control.awaiting_approval && !control.stop_requested {
        control = runtime
            .signal
            .wait(control)
            .map_err(|_| String::from("Execution lock was poisoned."))?;
    }

    if control.stop_requested {
        return Ok(ApprovalWaitOutcome::StopRequested);
    }

    if control.run_id != run_id {
        return Ok(ApprovalWaitOutcome::Replaced);
    }

    Ok(ApprovalWaitOutcome::Approved)
}

pub(crate) fn emit_line(app: &AppHandle, line: &str) {
    let _ = app.emit("cli-output", line.to_string());
}

pub(crate) fn emit_state(
    app: &AppHandle,
    status: &str,
    current_milestone: Option<&str>,
    pending_diff: Option<&str>,
    summary: Option<&str>,
) {
    let payload = AgentStateEvent {
        status: status.to_string(),
        current_milestone: current_milestone.map(|value| value.to_string()),
        pending_diff: pending_diff.map(|value| value.to_string()),
        summary: summary.map(|value| value.to_string()),
    };
    let _ = app.emit("agent-state", payload);
}
