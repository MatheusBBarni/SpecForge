use crate::{
    environment::{current_timestamp, resolve_cli_binary},
    generation::{
        create_spec_generation_temp_dir, format_process_failure, map_claude_reasoning,
        map_codex_reasoning, run_command_with_stdin, run_command_with_stdin_and_stream,
    },
    git::git_get_diff_for_root,
    models::{
        AutonomyMode, ChatEventPayload, ChatMessage, ChatRuntimeState, ChatSessionSnapshot,
        MessageRole, SessionStatus,
    },
    secrets::read_cursor_api_key,
    state::{ChatExecutionRuntime, WorkspaceContext},
};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Arc,
};
use tauri::{AppHandle, Emitter};

use super::{
    helpers::{build_message_preview, create_chat_entity_id, summarize_session},
    persistence::{read_chat_session_snapshot, refresh_index_summary, write_chat_session_snapshot},
    prompt::{build_chat_prompt, build_context_blocks},
};

pub(super) enum ApprovalGateResult {
    Approved,
    Stopped,
    Replaced,
}

enum ApprovalOutcome {
    Approved,
    StopRequested,
    Replaced,
}

enum ChatStopState {
    Continue,
    StopRequested,
    Replaced,
}

#[derive(Clone, Copy)]
pub(super) enum ChatExecutionPhase {
    Proposal,
    Write,
}

impl ChatExecutionPhase {
    pub(super) fn label(self) -> &'static str {
        match self {
            Self::Proposal => "proposal",
            Self::Write => "write",
        }
    }

    pub(super) fn milestone(self) -> &'static str {
        match self {
            Self::Proposal => "Proposal Pass",
            Self::Write => "Execution Pass",
        }
    }

    pub(super) fn completed_milestone(self) -> &'static str {
        match self {
            Self::Proposal => "Proposal Complete",
            Self::Write => "Execution Complete",
        }
    }

    pub(super) fn summary(self) -> &'static str {
        match self {
            Self::Proposal => {
                "Running a read-only pass to propose the patch or command plan before approval."
            }
            Self::Write => "Running the selected CLI against the project workspace.",
        }
    }

    pub(super) fn completed_summary(self) -> &'static str {
        match self {
            Self::Proposal => {
                "Proposal phase completed. Review the suggested plan before continuing."
            }
            Self::Write => {
                "Provider turn completed. Refresh the diff and transcript before continuing."
            }
        }
    }

    pub(super) fn line(self) -> &'static str {
        match self {
            Self::Proposal => {
                "Launching the proposal pass with read-only permissions and the attached project context."
            }
            Self::Write => "Launching the write pass with the configured autonomy permissions.",
        }
    }

    pub(super) fn instructions(self) -> &'static str {
        match self {
            Self::Proposal => {
                "Proposal-only pass. Do not mutate files or run write commands. Produce the clearest patch or command plan you would execute after approval."
            }
            Self::Write => {
                "Write-enabled pass. You may edit files and run commands that fit the current autonomy mode. Summarize what changed and call out any blockers."
            }
        }
    }

    fn codex_sandbox(self) -> &'static str {
        match self {
            Self::Proposal => "read-only",
            Self::Write => "workspace-write",
        }
    }

    fn claude_permission_mode(self) -> &'static str {
        match self {
            Self::Proposal => "default",
            Self::Write => "acceptEdits",
        }
    }
}

pub(super) fn run_approval_gate(
    app: &AppHandle,
    workspace: &WorkspaceContext,
    session_id: &str,
    runtime: &Arc<ChatExecutionRuntime>,
    run_id: u64,
    snapshot: &mut ChatSessionSnapshot,
    pending_request_message: &str,
    execution_summary_message: &str,
    halt_message: &str,
    approved_summary: &str,
    resume_status: bool,
) -> Result<ApprovalGateResult, String> {
    snapshot.runtime.awaiting_approval = true;
    snapshot.runtime.is_busy = true;
    snapshot.runtime.status = SessionStatus::AwaitingApproval;
    snapshot.runtime.pending_request = Some(pending_request_message.to_string());
    snapshot.runtime.execution_summary = Some(execution_summary_message.to_string());
    snapshot.runtime.pending_diff = Some(git_get_diff_for_root(&workspace.root)?);
    snapshot.updated_at = current_timestamp();
    snapshot.status = SessionStatus::AwaitingApproval;
    write_chat_session_snapshot(&workspace.root, snapshot)?;
    refresh_index_summary(&workspace.root, snapshot)?;
    emit_session_event(
        app,
        session_id,
        "approvalRequired",
        Some(snapshot.clone()),
        None,
        None,
        Some(snapshot.runtime.clone()),
    );

    match wait_for_approval(runtime, session_id, run_id)? {
        ApprovalOutcome::Approved => {
            snapshot.runtime.awaiting_approval = false;
            snapshot.runtime.pending_request = None;
            snapshot.runtime.execution_summary = Some(approved_summary.to_string());
            if resume_status {
                snapshot.runtime.status = SessionStatus::Executing;
                snapshot.status = SessionStatus::Executing;
            }
            snapshot.updated_at = current_timestamp();
            write_chat_session_snapshot(&workspace.root, snapshot)?;
            refresh_index_summary(&workspace.root, snapshot)?;
            Ok(ApprovalGateResult::Approved)
        }
        ApprovalOutcome::StopRequested => {
            halt_session(app, &workspace.root, session_id, snapshot, halt_message)?;
            Ok(ApprovalGateResult::Stopped)
        }
        ApprovalOutcome::Replaced => Ok(ApprovalGateResult::Replaced),
    }
}

pub(super) fn run_chat_turn(
    app: AppHandle,
    runtime: Arc<ChatExecutionRuntime>,
    workspace: WorkspaceContext,
    session_id: String,
    run_id: u64,
    user_message: String,
    claude_path: Option<String>,
    codex_path: Option<String>,
) {
    let result = (|| -> Result<(), String> {
        let mut snapshot = read_chat_session_snapshot(&workspace.root, &session_id)?;
        snapshot.messages.push(ChatMessage {
            id: create_chat_entity_id("msg"),
            role: MessageRole::User,
            content: user_message.clone(),
            created_at: current_timestamp(),
        });
        snapshot.status = SessionStatus::Executing;
        snapshot.last_message_preview = build_message_preview(&user_message);
        snapshot.updated_at = current_timestamp();
        snapshot.runtime.status = SessionStatus::Executing;
        snapshot.runtime.is_busy = true;
        snapshot.runtime.awaiting_approval = false;
        snapshot.runtime.last_error = None;
        snapshot.runtime.pending_request = None;
        snapshot.runtime.execution_summary = Some(String::from(
            "Preparing context and launching the selected CLI.",
        ));
        snapshot.runtime.pending_diff = None;
        snapshot.runtime.current_milestone = Some(String::from("Queue Turn"));
        write_chat_session_snapshot(&workspace.root, &snapshot)?;
        refresh_index_summary(&workspace.root, &snapshot)?;
        emit_session_event(
            &app,
            &session_id,
            "messageStarted",
            Some(snapshot.clone()),
            None,
            None,
            Some(snapshot.runtime.clone()),
        );

        append_terminal_line(
            &app,
            &session_id,
            &mut snapshot,
            "Queued the new user turn and resolved the session context.",
        );

        if matches!(
            stop_state(&runtime, &session_id, run_id),
            ChatStopState::StopRequested
        ) {
            halt_session(
                &app,
                &workspace.root,
                &session_id,
                &mut snapshot,
                "Turn stopped before execution began.",
            )?;
            return Ok(());
        }

        if snapshot.autonomy_mode == AutonomyMode::Stepped {
            execute_chat_phase(
                &app,
                &workspace,
                &session_id,
                &runtime,
                run_id,
                &mut snapshot,
                &user_message,
                &claude_path,
                &codex_path,
                ChatExecutionPhase::Proposal,
            )?;

            match run_approval_gate(
                &app,
                &workspace,
                &session_id,
                &runtime,
                run_id,
                &mut snapshot,
                "Approve the proposal to rerun this turn with write access.",
                "Stepped mode paused after the proposal phase. Approve to rerun the turn with write access.",
                "Turn stopped during the stepped approval gate.",
                "Approval received. Replaying the turn with write access enabled.",
                true,
            )? {
                ApprovalGateResult::Approved => {}
                ApprovalGateResult::Stopped | ApprovalGateResult::Replaced => return Ok(()),
            }

            execute_chat_phase(
                &app,
                &workspace,
                &session_id,
                &runtime,
                run_id,
                &mut snapshot,
                &user_message,
                &claude_path,
                &codex_path,
                ChatExecutionPhase::Write,
            )?;
        } else {
            execute_chat_phase(
                &app,
                &workspace,
                &session_id,
                &runtime,
                run_id,
                &mut snapshot,
                &user_message,
                &claude_path,
                &codex_path,
                ChatExecutionPhase::Write,
            )?;
        }

        if snapshot.autonomy_mode == AutonomyMode::Milestone {
            match run_approval_gate(
                &app,
                &workspace,
                &session_id,
                &runtime,
                run_id,
                &mut snapshot,
                "Approve the current diff to unlock the next turn.",
                "Milestone mode paused after this turn. Review the current diff before the next prompt.",
                "Turn stopped during the milestone approval gate.",
                "Diff approved. The topic is ready for the next prompt.",
                false,
            )? {
                ApprovalGateResult::Approved => {}
                ApprovalGateResult::Stopped | ApprovalGateResult::Replaced => return Ok(()),
            }
        }

        snapshot.runtime.status = SessionStatus::Completed;
        snapshot.runtime.is_busy = false;
        snapshot.runtime.awaiting_approval = false;
        snapshot.runtime.pending_request = None;
        snapshot.runtime.current_milestone = Some(String::from("Complete"));
        snapshot.runtime.pending_diff = Some(git_get_diff_for_root(&workspace.root)?);
        snapshot.runtime.execution_summary = Some(String::from(
            "Turn completed. The transcript, terminal stream, and current diff are ready.",
        ));
        snapshot.status = SessionStatus::Completed;
        snapshot.updated_at = current_timestamp();
        write_chat_session_snapshot(&workspace.root, &snapshot)?;
        refresh_index_summary(&workspace.root, &snapshot)?;
        emit_session_event(
            &app,
            &session_id,
            "completed",
            Some(snapshot),
            None,
            None,
            None,
        );

        Ok(())
    })();

    if let Err(error) = result {
        let _ = mark_session_error(&app, &workspace.root, &session_id, error);
    }
}

fn execute_chat_phase(
    app: &AppHandle,
    workspace: &WorkspaceContext,
    session_id: &str,
    runtime: &Arc<ChatExecutionRuntime>,
    run_id: u64,
    snapshot: &mut ChatSessionSnapshot,
    user_message: &str,
    claude_path: &Option<String>,
    codex_path: &Option<String>,
    phase: ChatExecutionPhase,
) -> Result<(), String> {
    if !matches!(
        stop_state(runtime, session_id, run_id),
        ChatStopState::Continue
    ) {
        halt_session(
            app,
            &workspace.root,
            session_id,
            snapshot,
            "Turn stopped before the provider phase finished.",
        )?;
        return Ok(());
    }

    snapshot.runtime.current_milestone = Some(String::from(phase.milestone()));
    snapshot.runtime.execution_summary = Some(String::from(phase.summary()));
    write_chat_session_snapshot(&workspace.root, snapshot)?;
    refresh_index_summary(&workspace.root, snapshot)?;
    append_terminal_line(app, session_id, snapshot, phase.line());

    let context_blocks = build_context_blocks(workspace, snapshot)?;
    let prompt_payload = build_chat_prompt(snapshot, &context_blocks, user_message, phase);
    let selected_model = snapshot.selected_model.clone();
    let selected_reasoning = snapshot.selected_reasoning.clone();
    let assistant_content = match run_chat_provider_request(
        app,
        runtime,
        session_id,
        run_id,
        snapshot,
        &workspace.root,
        &selected_model,
        &selected_reasoning,
        phase,
        &prompt_payload,
        claude_path.as_deref(),
        codex_path.as_deref(),
    ) {
        Ok(content) => content,
        Err(_)
            if matches!(
                stop_state(runtime, session_id, run_id),
                ChatStopState::StopRequested
            ) =>
        {
            halt_session(
                app,
                &workspace.root,
                session_id,
                snapshot,
                "Turn stopped while Sandcastle was running.",
            )?;
            return Ok(());
        }
        Err(error) => return Err(error),
    };

    if matches!(
        stop_state(runtime, session_id, run_id),
        ChatStopState::StopRequested
    ) {
        halt_session(
            app,
            &workspace.root,
            session_id,
            snapshot,
            "Turn stopped while Sandcastle was running.",
        )?;
        return Ok(());
    }

    let assistant_message = ChatMessage {
        id: create_chat_entity_id("msg"),
        role: MessageRole::Assistant,
        content: assistant_content.trim().to_string(),
        created_at: current_timestamp(),
    };
    snapshot.messages.push(assistant_message.clone());
    snapshot.last_message_preview = build_message_preview(&assistant_message.content);
    snapshot.updated_at = current_timestamp();
    snapshot.runtime.pending_diff = Some(git_get_diff_for_root(&workspace.root)?);
    snapshot.runtime.current_milestone = Some(String::from(phase.completed_milestone()));
    snapshot.runtime.execution_summary = Some(String::from(phase.completed_summary()));
    snapshot.status = SessionStatus::Executing;
    write_chat_session_snapshot(&workspace.root, snapshot)?;
    refresh_index_summary(&workspace.root, snapshot)?;
    emit_session_event(
        app,
        session_id,
        "messageDelta",
        None,
        Some(assistant_message.content.clone()),
        None,
        None,
    );
    emit_session_event(
        app,
        session_id,
        "sessionUpdated",
        Some(snapshot.clone()),
        Some(assistant_message.content),
        None,
        Some(snapshot.runtime.clone()),
    );

    Ok(())
}

fn run_chat_provider_request(
    app: &AppHandle,
    runtime: &Arc<ChatExecutionRuntime>,
    session_id: &str,
    run_id: u64,
    snapshot: &mut ChatSessionSnapshot,
    workspace_root: &Path,
    model: &str,
    reasoning: &str,
    phase: ChatExecutionPhase,
    prompt_payload: &str,
    claude_path: Option<&str>,
    codex_path: Option<&str>,
) -> Result<String, String> {
    if model.starts_with("claude") {
        run_claude_chat_request(
            workspace_root,
            &resolve_cli_binary("claude", claude_path)?,
            model,
            reasoning,
            phase,
            prompt_payload,
        )
    } else {
        run_codex_chat_request(
            app,
            Some((runtime, session_id, run_id)),
            snapshot,
            workspace_root,
            &resolve_cli_binary("codex", codex_path)?,
            Some(&format!(
                "specforge-chat-{}-{run_id}-{}",
                sanitize_container_segment(session_id),
                phase.label()
            )),
            model,
            reasoning,
            phase,
            prompt_payload,
        )
    }
}

fn run_codex_chat_request(
    app: &AppHandle,
    runtime: Option<(&Arc<ChatExecutionRuntime>, &str, u64)>,
    snapshot: &mut ChatSessionSnapshot,
    workspace_root: &Path,
    _binary_path: &Path,
    container_name: Option<&str>,
    model: &str,
    reasoning: &str,
    phase: ChatExecutionPhase,
    prompt_payload: &str,
) -> Result<String, String> {
    let temp_dir = create_spec_generation_temp_dir("codex-chat")?;
    let output_path = temp_dir.join("assistant-message.md");
    let diff_path = temp_dir.join("sandbox.diff");
    let image = ensure_sandcastle_image()?;
    let owned_container_name = container_name
        .map(str::to_string)
        .unwrap_or_else(|| format!("specforge-chat-{}", current_timestamp()));
    let mut command = Command::new("docker");
    command
        .arg("run")
        .arg("--rm")
        .arg("-i")
        .arg("--name")
        .arg(&owned_container_name)
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
        .arg(format!("SPECFORGE_CODEX_SANDBOX={}", phase.codex_sandbox()))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    configure_codex_auth(&mut command)?;

    command
        .arg(image)
        .arg("sh")
        .arg("-lc")
        .arg(sandcastle_codex_script());

    if let Some((runtime, session_id, run_id)) = runtime {
        set_active_chat_container(
            runtime,
            session_id,
            run_id,
            Some(owned_container_name.clone()),
        )?;
    }
    let output = run_command_with_stdin_and_stream(
        &mut command,
        "Sandcastle Runtime",
        prompt_payload,
        |line| {
            if let Some((_, session_id, _)) = runtime {
                append_terminal_line(app, session_id, snapshot, line);
            }
        },
    );
    if let Some((runtime, session_id, run_id)) = runtime {
        set_active_chat_container(runtime, session_id, run_id, None)?;
    }
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
                "The Sandcastle Runtime returned no assistant content.",
            ))
        } else {
            Ok(stdout)
        }
    });

    let mut result = match result {
        Ok(result) => result,
        Err(error) => {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(format!(
                "Unable to read the Sandcastle assistant output: {error}"
            ));
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

fn run_claude_chat_request(
    workspace_root: &Path,
    binary_path: &Path,
    model: &str,
    reasoning: &str,
    phase: ChatExecutionPhase,
    prompt_payload: &str,
) -> Result<String, String> {
    let mut command = Command::new(binary_path);
    command
        .current_dir(workspace_root)
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
        .arg(phase.claude_permission_mode())
        .arg("--max-turns")
        .arg("8")
        .arg("--effort")
        .arg(map_claude_reasoning(reasoning));

    let output = run_command_with_stdin(&mut command, "Claude CLI", prompt_payload)?;

    if !output.status.success() {
        return Err(format_process_failure("Claude CLI", &output));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
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

fn set_active_chat_container(
    runtime: &Arc<ChatExecutionRuntime>,
    session_id: &str,
    run_id: u64,
    active_container: Option<String>,
) -> Result<(), String> {
    let mut controls = runtime
        .control
        .lock()
        .map_err(|_| String::from("Chat execution lock was poisoned."))?;
    let control = controls.entry(session_id.to_string()).or_default();

    if control.run_id == run_id {
        control.active_container = active_container;
    }

    Ok(())
}

fn sanitize_container_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect()
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

fn append_terminal_line(
    app: &AppHandle,
    session_id: &str,
    snapshot: &mut ChatSessionSnapshot,
    line: &str,
) {
    snapshot.runtime.terminal_output.push(line.to_string());

    if snapshot.runtime.terminal_output.len() > 240 {
        let keep_from = snapshot.runtime.terminal_output.len() - 240;
        snapshot.runtime.terminal_output.drain(0..keep_from);
    }

    emit_session_event(
        app,
        session_id,
        "terminalLine",
        None,
        None,
        Some(line.to_string()),
        Some(snapshot.runtime.clone()),
    );
}

fn halt_session(
    app: &AppHandle,
    workspace_root: &Path,
    session_id: &str,
    snapshot: &mut ChatSessionSnapshot,
    message: &str,
) -> Result<(), String> {
    snapshot.status = SessionStatus::Halted;
    snapshot.runtime.status = SessionStatus::Halted;
    snapshot.runtime.is_busy = false;
    snapshot.runtime.awaiting_approval = false;
    snapshot.runtime.pending_request = None;
    snapshot.runtime.execution_summary = Some(message.to_string());
    snapshot.updated_at = current_timestamp();
    write_chat_session_snapshot(workspace_root, snapshot)?;
    refresh_index_summary(workspace_root, snapshot)?;
    emit_session_event(
        app,
        session_id,
        "halted",
        Some(snapshot.clone()),
        None,
        None,
        Some(snapshot.runtime.clone()),
    );
    Ok(())
}

fn mark_session_error(
    app: &AppHandle,
    workspace_root: &Path,
    session_id: &str,
    error: String,
) -> Result<(), String> {
    let mut snapshot = read_chat_session_snapshot(workspace_root, session_id)?;
    snapshot.status = SessionStatus::Error;
    snapshot.runtime.status = SessionStatus::Error;
    snapshot.runtime.is_busy = false;
    snapshot.runtime.awaiting_approval = false;
    snapshot.runtime.pending_request = None;
    snapshot.runtime.last_error = Some(error.clone());
    snapshot.runtime.execution_summary = Some(error.clone());
    snapshot.updated_at = current_timestamp();
    write_chat_session_snapshot(workspace_root, &snapshot)?;
    refresh_index_summary(workspace_root, &snapshot)?;
    emit_session_event(
        app,
        session_id,
        "error",
        None,
        Some(error),
        None,
        Some(snapshot.runtime),
    );
    Ok(())
}

fn emit_session_event(
    app: &AppHandle,
    session_id: &str,
    event_type: &str,
    session: Option<ChatSessionSnapshot>,
    message_delta: Option<String>,
    terminal_line: Option<String>,
    runtime: Option<ChatRuntimeState>,
) {
    let summary = session.as_ref().map(summarize_session);
    let message = session
        .as_ref()
        .and_then(|snapshot| snapshot.messages.last().cloned());
    let payload = ChatEventPayload {
        session_id: session_id.to_string(),
        event_type: event_type.to_string(),
        message,
        message_delta,
        terminal_line,
        session,
        runtime,
        summary,
    };

    let _ = app.emit("chat-session-event", payload);
}

fn wait_for_approval(
    runtime: &Arc<ChatExecutionRuntime>,
    session_id: &str,
    run_id: u64,
) -> Result<ApprovalOutcome, String> {
    let mut controls = runtime
        .control
        .lock()
        .map_err(|_| String::from("Chat execution lock was poisoned."))?;
    let control = controls.entry(session_id.to_string()).or_default();
    control.awaiting_approval = true;
    runtime.signal.notify_all();

    loop {
        let current = controls.entry(session_id.to_string()).or_default().clone();

        if current.run_id != run_id {
            return Ok(ApprovalOutcome::Replaced);
        }

        if current.stop_requested {
            return Ok(ApprovalOutcome::StopRequested);
        }

        if !current.awaiting_approval {
            return Ok(ApprovalOutcome::Approved);
        }

        controls = runtime
            .signal
            .wait(controls)
            .map_err(|_| String::from("Chat execution lock was poisoned."))?;
    }
}

fn stop_state(runtime: &Arc<ChatExecutionRuntime>, session_id: &str, run_id: u64) -> ChatStopState {
    runtime
        .control
        .lock()
        .map(|controls| {
            let Some(control) = controls.get(session_id) else {
                return ChatStopState::Continue;
            };

            if control.run_id != run_id {
                ChatStopState::Replaced
            } else if control.stop_requested {
                ChatStopState::StopRequested
            } else {
                ChatStopState::Continue
            }
        })
        .unwrap_or(ChatStopState::StopRequested)
}
