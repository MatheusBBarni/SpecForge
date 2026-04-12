use crate::{
    documents::parse_workspace_document,
    environment::{current_timestamp, resolve_cli_binary},
    generation::{
        create_spec_generation_temp_dir, format_process_failure, map_claude_reasoning,
        map_codex_reasoning, run_command_with_stdin,
    },
    git::git_get_diff_for_root,
    models::{
        ChatContextItem, ChatEventPayload, ChatMessage, ChatRuntimeState, ChatSessionIndexPayload,
        ChatSessionSnapshot, ChatSessionSummary, ProjectSettings,
    },
    paths::resolve_relative_path_under_root,
    project::{
        build_default_project_settings, load_project_settings_from_workspace_root,
        normalize_project_model, normalize_project_reasoning,
    },
    state::{ChatExecutionRuntime, SharedState, WorkspaceContext},
};
use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};

const SESSION_DIRECTORY_RELATIVE_PATH: &str = ".specforge/sessions";
const SESSION_INDEX_FILE_NAME: &str = "index.json";
const CAVEMAN_PREAMBLE: &str =
    "Default response style: caveman. Keep prose terse and direct while leaving code blocks, commands, and diffs fully normal.";

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
pub(crate) fn create_chat_session(
    state: State<SharedState>,
    title: Option<String>,
) -> Result<ChatSessionSnapshot, String> {
    let workspace = active_workspace_context(&state)?;
    let settings = load_workspace_project_settings(&workspace.root)?;
    let mut index = load_chat_session_index(&workspace.root)?;
    let timestamp = current_timestamp();
    let session_id = create_chat_entity_id("session");
    let next_title = normalized_title(title.as_deref())
        .unwrap_or_else(|| format!("Topic {}", index.sessions.len() + 1));

    let snapshot = ChatSessionSnapshot {
        id: session_id.clone(),
        title: next_title,
        created_at: timestamp.clone(),
        updated_at: timestamp,
        status: String::from("idle"),
        last_message_preview: String::new(),
        selected_model: settings.selected_model.clone(),
        selected_reasoning: settings.selected_reasoning.clone(),
        autonomy_mode: String::from("milestone"),
        context_items: build_default_context_items(&settings),
        messages: Vec::new(),
        runtime: ChatRuntimeState::default(),
    };

    write_chat_session_snapshot(&workspace.root, &snapshot)?;
    upsert_chat_session_summary(&mut index, summarize_session(&snapshot));
    index.last_active_session_id = Some(session_id);
    write_chat_session_index(&workspace.root, &index)?;

    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn load_chat_session(
    state: State<SharedState>,
    session_id: String,
) -> Result<ChatSessionSnapshot, String> {
    let workspace = active_workspace_context(&state)?;
    let snapshot = read_chat_session_snapshot(&workspace.root, &session_id)?;
    let mut index = load_chat_session_index(&workspace.root)?;
    index.last_active_session_id = Some(session_id);
    upsert_chat_session_summary(&mut index, summarize_session(&snapshot));
    write_chat_session_index(&workspace.root, &index)?;
    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn save_chat_session(
    state: State<SharedState>,
    session_id: String,
    selected_model: String,
    selected_reasoning: String,
    autonomy_mode: String,
    context_items: Vec<ChatContextItem>,
) -> Result<ChatSessionSnapshot, String> {
    let workspace = active_workspace_context(&state)?;
    let mut snapshot = read_chat_session_snapshot(&workspace.root, &session_id)?;
    snapshot.selected_model =
        normalize_project_model(&selected_model, &snapshot.selected_model)?;
    snapshot.selected_reasoning =
        normalize_project_reasoning(&selected_reasoning, &snapshot.selected_reasoning)?;
    snapshot.autonomy_mode = normalize_autonomy_mode(&autonomy_mode);
    snapshot.context_items = normalize_context_items(context_items);
    snapshot.updated_at = current_timestamp();
    write_chat_session_snapshot(&workspace.root, &snapshot)?;

    let mut index = load_chat_session_index(&workspace.root)?;
    upsert_chat_session_summary(&mut index, summarize_session(&snapshot));
    write_chat_session_index(&workspace.root, &index)?;

    Ok(snapshot)
}

#[tauri::command]
pub(crate) fn rename_chat_session(
    state: State<SharedState>,
    session_id: String,
    title: String,
) -> Result<ChatSessionSummary, String> {
    let workspace = active_workspace_context(&state)?;
    let mut snapshot = read_chat_session_snapshot(&workspace.root, &session_id)?;
    snapshot.title = normalized_title(Some(&title))
        .ok_or_else(|| String::from("A non-empty session title is required."))?;
    snapshot.updated_at = current_timestamp();
    write_chat_session_snapshot(&workspace.root, &snapshot)?;

    let summary = summarize_session(&snapshot);
    let mut index = load_chat_session_index(&workspace.root)?;
    upsert_chat_session_summary(&mut index, summary.clone());
    write_chat_session_index(&workspace.root, &index)?;

    Ok(summary)
}

#[tauri::command]
pub(crate) fn delete_chat_session(
    state: State<SharedState>,
    session_id: String,
) -> Result<ChatSessionIndexPayload, String> {
    let workspace = active_workspace_context(&state)?;
    let session_path = session_snapshot_path(&workspace.root, &session_id);

    if session_path.exists() {
        fs::remove_file(&session_path).map_err(|error| {
            format!(
                "Unable to delete chat session {}: {error}",
                session_path.display()
            )
        })?;
    }

    let mut index = load_chat_session_index(&workspace.root)?;
    index.sessions.retain(|entry| entry.id != session_id);

    if index
        .last_active_session_id
        .as_ref()
        .is_some_and(|active_id| active_id == &session_id)
    {
        index.last_active_session_id = index.sessions.first().map(|entry| entry.id.clone());
    }

    write_chat_session_index(&workspace.root, &index)?;
    Ok(index)
}

#[tauri::command]
pub(crate) fn approve_chat_session(
    state: State<SharedState>,
    session_id: String,
) -> Result<(), String> {
    let mut controls = state
        .chat_runtime
        .control
        .lock()
        .map_err(|_| String::from("Chat execution lock was poisoned."))?;
    let control = controls.entry(session_id).or_default();
    control.awaiting_approval = false;
    state.chat_runtime.signal.notify_all();
    Ok(())
}

#[tauri::command]
pub(crate) fn stop_chat_session(
    state: State<SharedState>,
    session_id: String,
) -> Result<(), String> {
    let mut controls = state
        .chat_runtime
        .control
        .lock()
        .map_err(|_| String::from("Chat execution lock was poisoned."))?;
    let control = controls.entry(session_id).or_default();
    control.stop_requested = true;
    control.awaiting_approval = false;
    state.chat_runtime.signal.notify_all();
    Ok(())
}

#[tauri::command]
pub(crate) fn send_chat_message(
    app: AppHandle,
    state: State<SharedState>,
    session_id: String,
    message: String,
    claude_path: Option<String>,
    codex_path: Option<String>,
) -> Result<(), String> {
    let trimmed_message = message.trim().to_string();

    if trimmed_message.is_empty() {
        return Err(String::from("A message is required before sending."));
    }

    let workspace = active_workspace_context(&state)?;
    let snapshot = read_chat_session_snapshot(&workspace.root, &session_id)?;

    if snapshot.runtime.is_busy || snapshot.runtime.awaiting_approval {
        return Err(String::from(
            "This topic is still waiting on the current turn. Approve or stop it before sending another message.",
        ));
    }

    let run_id = {
        let mut controls = state
            .chat_runtime
            .control
            .lock()
            .map_err(|_| String::from("Chat execution lock was poisoned."))?;
        let control = controls.entry(session_id.clone()).or_default();
        control.run_id = control.run_id.wrapping_add(1);
        control.stop_requested = false;
        control.awaiting_approval = false;
        control.run_id
    };

    let runtime = state.chat_runtime.clone();
    thread::spawn(move || {
        run_chat_turn(
            app,
            runtime,
            workspace,
            session_id,
            run_id,
            trimmed_message,
            claude_path,
            codex_path,
        );
    });

    Ok(())
}

pub(crate) fn load_chat_session_index(
    workspace_root: &Path,
) -> Result<ChatSessionIndexPayload, String> {
    let index_path = session_index_path(workspace_root);

    if !index_path.exists() {
        return Ok(ChatSessionIndexPayload {
            sessions: Vec::new(),
            last_active_session_id: None,
        });
    }

    let raw_value = fs::read_to_string(&index_path).map_err(|error| {
        format!(
            "Unable to read the chat session index {}: {error}",
            index_path.display()
        )
    })?;

    serde_json::from_str::<ChatSessionIndexPayload>(&raw_value).map_err(|error| {
        format!(
            "Unable to parse the chat session index {}: {error}",
            index_path.display()
        )
    })
}

fn run_chat_turn(
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
            role: String::from("user"),
            content: user_message.clone(),
            created_at: current_timestamp(),
        });
        snapshot.status = String::from("executing");
        snapshot.last_message_preview = build_message_preview(&user_message);
        snapshot.updated_at = current_timestamp();
        snapshot.runtime.status = String::from("executing");
        snapshot.runtime.is_busy = true;
        snapshot.runtime.awaiting_approval = false;
        snapshot.runtime.last_error = None;
        snapshot.runtime.pending_request = None;
        snapshot.runtime.execution_summary =
            Some(String::from("Preparing context and launching the selected CLI."));
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
            &workspace.root,
            &session_id,
            &mut snapshot,
            "Queued the new user turn and resolved the session context.",
        )?;

        if matches!(stop_state(&runtime, &session_id, run_id), ChatStopState::StopRequested) {
            halt_session(
                &app,
                &workspace.root,
                &session_id,
                &mut snapshot,
                "Turn stopped before execution began.",
            )?;
            return Ok(());
        }

        if snapshot.autonomy_mode == "stepped" {
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
            snapshot.runtime.awaiting_approval = true;
            snapshot.runtime.is_busy = true;
            snapshot.runtime.status = String::from("awaiting_approval");
            snapshot.runtime.pending_request =
                Some(String::from("Approve the proposal to rerun this turn with write access."));
            snapshot.runtime.execution_summary = Some(String::from(
                "Stepped mode paused after the proposal phase. Approve to rerun the turn with write access.",
            ));
            snapshot.runtime.pending_diff = Some(git_get_diff_for_root(&workspace.root)?);
            snapshot.updated_at = current_timestamp();
            snapshot.status = String::from("awaiting_approval");
            write_chat_session_snapshot(&workspace.root, &snapshot)?;
            refresh_index_summary(&workspace.root, &snapshot)?;
            emit_session_event(
                &app,
                &session_id,
                "approvalRequired",
                Some(snapshot.clone()),
                None,
                None,
                Some(snapshot.runtime.clone()),
            );

            match wait_for_approval(&runtime, &session_id, run_id)? {
                ApprovalOutcome::Approved => {
                    snapshot.runtime.awaiting_approval = false;
                    snapshot.runtime.status = String::from("executing");
                    snapshot.runtime.pending_request = None;
                    snapshot.runtime.execution_summary = Some(String::from(
                        "Approval received. Replaying the turn with write access enabled.",
                    ));
                    snapshot.status = String::from("executing");
                    snapshot.updated_at = current_timestamp();
                    write_chat_session_snapshot(&workspace.root, &snapshot)?;
                    refresh_index_summary(&workspace.root, &snapshot)?;
                }
                ApprovalOutcome::StopRequested => {
                    halt_session(
                        &app,
                        &workspace.root,
                        &session_id,
                        &mut snapshot,
                        "Turn stopped during the stepped approval gate.",
                    )?;
                    return Ok(());
                }
                ApprovalOutcome::Replaced => return Ok(()),
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

        if snapshot.autonomy_mode == "milestone" {
            snapshot.runtime.awaiting_approval = true;
            snapshot.runtime.is_busy = true;
            snapshot.runtime.status = String::from("awaiting_approval");
            snapshot.runtime.execution_summary = Some(String::from(
                "Milestone mode paused after this turn. Review the current diff before the next prompt.",
            ));
            snapshot.runtime.pending_request =
                Some(String::from("Approve the current diff to unlock the next turn."));
            snapshot.runtime.pending_diff = Some(git_get_diff_for_root(&workspace.root)?);
            snapshot.updated_at = current_timestamp();
            snapshot.status = String::from("awaiting_approval");
            write_chat_session_snapshot(&workspace.root, &snapshot)?;
            refresh_index_summary(&workspace.root, &snapshot)?;
            emit_session_event(
                &app,
                &session_id,
                "approvalRequired",
                Some(snapshot.clone()),
                None,
                None,
                Some(snapshot.runtime.clone()),
            );

            match wait_for_approval(&runtime, &session_id, run_id)? {
                ApprovalOutcome::Approved => {
                    snapshot.runtime.awaiting_approval = false;
                    snapshot.runtime.pending_request = None;
                    snapshot.runtime.execution_summary = Some(String::from(
                        "Diff approved. The topic is ready for the next prompt.",
                    ));
                }
                ApprovalOutcome::StopRequested => {
                    halt_session(
                        &app,
                        &workspace.root,
                        &session_id,
                        &mut snapshot,
                        "Turn stopped during the milestone approval gate.",
                    )?;
                    return Ok(());
                }
                ApprovalOutcome::Replaced => return Ok(()),
            }
        }

        snapshot.runtime.status = String::from("completed");
        snapshot.runtime.is_busy = false;
        snapshot.runtime.awaiting_approval = false;
        snapshot.runtime.pending_request = None;
        snapshot.runtime.current_milestone = Some(String::from("Complete"));
        snapshot.runtime.pending_diff = Some(git_get_diff_for_root(&workspace.root)?);
        snapshot.runtime.execution_summary = Some(String::from(
            "Turn completed. The transcript, terminal stream, and current diff are ready.",
        ));
        snapshot.status = String::from("completed");
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
    if !matches!(stop_state(runtime, session_id, run_id), ChatStopState::Continue) {
        halt_session(
            app,
            &workspace.root,
            session_id,
            snapshot,
            "Turn stopped before the provider phase finished.",
        )?;
        return Ok(());
    }

    let phase_copy = phase.copy();
    snapshot.runtime.current_milestone = Some(String::from(phase_copy.milestone()));
    snapshot.runtime.execution_summary = Some(String::from(phase_copy.summary()));
    write_chat_session_snapshot(&workspace.root, snapshot)?;
    refresh_index_summary(&workspace.root, snapshot)?;
    append_terminal_line(app, &workspace.root, session_id, snapshot, phase_copy.line())?;

    let context_blocks = build_context_blocks(workspace, snapshot)?;
    let prompt_payload = build_chat_prompt(snapshot, &context_blocks, user_message, phase_copy);
    let assistant_content = run_chat_provider_request(
        &workspace.root,
        &snapshot.selected_model,
        &snapshot.selected_reasoning,
        phase_copy,
        &prompt_payload,
        claude_path.as_deref(),
        codex_path.as_deref(),
    )?;

    let assistant_message = ChatMessage {
        id: create_chat_entity_id("msg"),
        role: String::from("assistant"),
        content: assistant_content.trim().to_string(),
        created_at: current_timestamp(),
    };
    snapshot.messages.push(assistant_message.clone());
    snapshot.last_message_preview = build_message_preview(&assistant_message.content);
    snapshot.updated_at = current_timestamp();
    snapshot.runtime.pending_diff = Some(git_get_diff_for_root(&workspace.root)?);
    snapshot.runtime.current_milestone = Some(String::from(phase_copy.completed_milestone()));
    snapshot.runtime.execution_summary = Some(String::from(phase_copy.completed_summary()));
    snapshot.status = String::from("executing");
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

fn build_context_blocks(
    workspace: &WorkspaceContext,
    snapshot: &ChatSessionSnapshot,
) -> Result<Vec<(String, String)>, String> {
    let mut blocks = Vec::new();

    for item in &snapshot.context_items {
        let content = match item.kind.as_str() {
            "workspace_summary" => build_workspace_summary(workspace),
            _ => {
                let Some(path) = item.path.as_deref() else {
                    continue;
                };
                let resolved_path = resolve_relative_path_under_root(&workspace.root, path)?;

                if !resolved_path.exists() {
                    format!("Missing file at {path}.")
                } else {
                    parse_workspace_document(&resolved_path)?
                }
            }
        };

        if content.trim().is_empty() {
            continue;
        }

        blocks.push((item.label.clone(), content));
    }

    Ok(blocks)
}

fn build_chat_prompt(
    snapshot: &ChatSessionSnapshot,
    context_blocks: &[(String, String)],
    user_message: &str,
    phase: ChatExecutionPhase,
) -> String {
    let mut prompt = String::new();
    prompt.push_str(CAVEMAN_PREAMBLE);
    prompt.push_str("\n\n");
    prompt.push_str("You are SpecForge Chat, a desktop coding assistant operating on a project-scoped topic.\n");
    prompt.push_str("Keep responses direct. Preserve technical accuracy. Use the attached project context.\n");
    prompt.push_str("Current topic: ");
    prompt.push_str(&snapshot.title);
    prompt.push_str("\nAutonomy mode: ");
    prompt.push_str(&snapshot.autonomy_mode);
    prompt.push_str("\nExecution phase: ");
    prompt.push_str(phase.label());
    prompt.push_str("\n");
    prompt.push_str(phase.instructions());

    if !context_blocks.is_empty() {
        prompt.push_str("\n\nAttached context:\n");

        for (label, content) in context_blocks {
            prompt.push_str("\n### ");
            prompt.push_str(label);
            prompt.push('\n');
            prompt.push_str(content.trim());
            prompt.push('\n');
        }
    }

    if !snapshot.messages.is_empty() {
        prompt.push_str("\nConversation so far:\n");

        for message in &snapshot.messages {
            prompt.push_str("\n");
            prompt.push_str(&message.role.to_uppercase());
            prompt.push_str(": ");
            prompt.push_str(message.content.trim());
            prompt.push('\n');
        }
    } else {
        prompt.push_str("\nConversation so far:\n\nNo prior turns yet.\n");
    }

    prompt.push_str("\nCurrent user request:\n");
    prompt.push_str(user_message.trim());
    prompt.push('\n');
    prompt
}

fn run_chat_provider_request(
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
            workspace_root,
            &resolve_cli_binary("codex", codex_path)?,
            model,
            reasoning,
            phase,
            prompt_payload,
        )
    }
}

fn run_codex_chat_request(
    workspace_root: &Path,
    binary_path: &Path,
    model: &str,
    reasoning: &str,
    phase: ChatExecutionPhase,
    prompt_payload: &str,
) -> Result<String, String> {
    let temp_dir = create_spec_generation_temp_dir("codex-chat")?;
    let output_path = temp_dir.join("assistant-message.md");
    let mut command = Command::new(binary_path);
    command
        .current_dir(workspace_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("exec")
        .arg("--color")
        .arg("never")
        .arg("--skip-git-repo-check")
        .arg("--sandbox")
        .arg(phase.codex_sandbox())
        .arg("--model")
        .arg(model)
        .arg("--config")
        .arg(format!(
            "model_reasoning_effort=\"{}\"",
            map_codex_reasoning(reasoning)
        ))
        .arg("--output-last-message")
        .arg(&output_path);

    let output = run_command_with_stdin(&mut command, "Codex CLI", prompt_payload)?;

    if !output.status.success() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(format_process_failure("Codex CLI", &output));
    }

    let result = fs::read_to_string(&output_path).or_else(|_| {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if stdout.is_empty() {
            Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "The Codex CLI returned no assistant content.",
            ))
        } else {
            Ok(stdout)
        }
    });
    let _ = fs::remove_dir_all(&temp_dir);

    result.map_err(|error| format!("Unable to read the Codex assistant output: {error}"))
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

fn refresh_index_summary(workspace_root: &Path, snapshot: &ChatSessionSnapshot) -> Result<(), String> {
    let mut index = load_chat_session_index(workspace_root)?;
    upsert_chat_session_summary(&mut index, summarize_session(snapshot));
    if index.last_active_session_id.is_none() {
        index.last_active_session_id = Some(snapshot.id.clone());
    }
    write_chat_session_index(workspace_root, &index)
}

fn append_terminal_line(
    app: &AppHandle,
    workspace_root: &Path,
    session_id: &str,
    snapshot: &mut ChatSessionSnapshot,
    line: &str,
) -> Result<(), String> {
    snapshot.runtime.terminal_output.push(line.to_string());

    if snapshot.runtime.terminal_output.len() > 240 {
        let keep_from = snapshot.runtime.terminal_output.len() - 240;
        snapshot.runtime.terminal_output.drain(0..keep_from);
    }

    snapshot.updated_at = current_timestamp();
    write_chat_session_snapshot(workspace_root, snapshot)?;
    refresh_index_summary(workspace_root, snapshot)?;
    emit_session_event(
        app,
        session_id,
        "terminalLine",
        None,
        None,
        Some(line.to_string()),
        Some(snapshot.runtime.clone()),
    );
    Ok(())
}

fn halt_session(
    app: &AppHandle,
    workspace_root: &Path,
    session_id: &str,
    snapshot: &mut ChatSessionSnapshot,
    message: &str,
) -> Result<(), String> {
    snapshot.status = String::from("halted");
    snapshot.runtime.status = String::from("halted");
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
    snapshot.status = String::from("error");
    snapshot.runtime.status = String::from("error");
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
        Some(snapshot),
        Some(error),
        None,
        None,
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

fn active_workspace_context(state: &State<SharedState>) -> Result<WorkspaceContext, String> {
    state
        .workspace
        .lock()
        .map_err(|_| String::from("Workspace lock was poisoned."))?
        .clone()
        .ok_or_else(|| String::from("No workspace folder is currently open."))
}

fn load_workspace_project_settings(workspace_root: &Path) -> Result<ProjectSettings, String> {
    let defaults = build_default_project_settings(workspace_root, None, None);
    load_project_settings_from_workspace_root(workspace_root, defaults).map(|(settings, _)| settings)
}

fn build_default_context_items(settings: &ProjectSettings) -> Vec<ChatContextItem> {
    let mut items = vec![
        build_context_item("prd", "PRD", Some(settings.prd_path.clone()), true),
        build_context_item("spec", "SPEC", Some(settings.spec_path.clone()), true),
        build_context_item("workspace_summary", "Workspace Tree Summary", None, true),
    ];

    for path in &settings.supporting_document_paths {
        items.push(build_context_item(
            "supporting_document",
            &format!("Supporting: {path}"),
            Some(path.clone()),
            true,
        ));
    }

    normalize_context_items(items)
}

fn build_context_item(
    kind: &str,
    label: &str,
    path: Option<String>,
    is_default: bool,
) -> ChatContextItem {
    ChatContextItem {
        id: create_chat_entity_id("ctx"),
        kind: kind.to_string(),
        label: label.to_string(),
        path,
        is_default,
    }
}

fn normalize_context_items(items: Vec<ChatContextItem>) -> Vec<ChatContextItem> {
    let mut seen = BTreeSet::<String>::new();
    let mut normalized_items = Vec::new();

    for item in items {
        let dedupe_key = format!(
            "{}::{}",
            item.kind,
            item.path.as_deref().unwrap_or(item.label.as_str())
        );

        if !seen.insert(dedupe_key) {
            continue;
        }

        normalized_items.push(ChatContextItem {
            id: if item.id.trim().is_empty() {
                create_chat_entity_id("ctx")
            } else {
                item.id
            },
            kind: item.kind.trim().to_string(),
            label: item.label.trim().to_string(),
            path: item.path.and_then(|value| {
                let trimmed_value = value.trim().replace('\\', "/");
                (!trimmed_value.is_empty()).then_some(trimmed_value)
            }),
            is_default: item.is_default,
        });
    }

    normalized_items
}

fn summarize_session(snapshot: &ChatSessionSnapshot) -> ChatSessionSummary {
    ChatSessionSummary {
        id: snapshot.id.clone(),
        title: snapshot.title.clone(),
        created_at: snapshot.created_at.clone(),
        updated_at: snapshot.updated_at.clone(),
        status: snapshot.status.clone(),
        last_message_preview: snapshot.last_message_preview.clone(),
        selected_model: snapshot.selected_model.clone(),
        selected_reasoning: snapshot.selected_reasoning.clone(),
        autonomy_mode: snapshot.autonomy_mode.clone(),
    }
}

fn upsert_chat_session_summary(
    index: &mut ChatSessionIndexPayload,
    summary: ChatSessionSummary,
) {
    if let Some(existing_summary) = index.sessions.iter_mut().find(|entry| entry.id == summary.id) {
        *existing_summary = summary;
    } else {
        index.sessions.push(summary);
    }

    index.sessions.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
}

fn write_chat_session_index(
    workspace_root: &Path,
    index: &ChatSessionIndexPayload,
) -> Result<(), String> {
    ensure_session_directory(workspace_root)?;
    let encoded = serde_json::to_string_pretty(index)
        .map_err(|error| format!("Unable to encode the chat session index: {error}"))?;
    fs::write(session_index_path(workspace_root), encoded.as_bytes()).map_err(|error| {
        format!(
            "Unable to write the chat session index {}: {error}",
            session_index_path(workspace_root).display()
        )
    })
}

fn read_chat_session_snapshot(
    workspace_root: &Path,
    session_id: &str,
) -> Result<ChatSessionSnapshot, String> {
    let session_path = session_snapshot_path(workspace_root, session_id);
    let raw_value = fs::read_to_string(&session_path).map_err(|error| {
        format!(
            "Unable to read the chat session {}: {error}",
            session_path.display()
        )
    })?;

    serde_json::from_str::<ChatSessionSnapshot>(&raw_value).map_err(|error| {
        format!(
            "Unable to parse the chat session {}: {error}",
            session_path.display()
        )
    })
}

fn write_chat_session_snapshot(
    workspace_root: &Path,
    snapshot: &ChatSessionSnapshot,
) -> Result<(), String> {
    ensure_session_directory(workspace_root)?;
    let encoded = serde_json::to_string_pretty(snapshot)
        .map_err(|error| format!("Unable to encode the chat session {}: {error}", snapshot.id))?;
    fs::write(session_snapshot_path(workspace_root, &snapshot.id), encoded.as_bytes()).map_err(
        |error| {
            format!(
                "Unable to write the chat session {}: {error}",
                session_snapshot_path(workspace_root, &snapshot.id).display()
            )
        },
    )
}

fn ensure_session_directory(workspace_root: &Path) -> Result<(), String> {
    let sessions_path = sessions_directory_path(workspace_root);
    fs::create_dir_all(&sessions_path).map_err(|error| {
        format!(
            "Unable to create the chat session directory {}: {error}",
            sessions_path.display()
        )
    })
}

fn sessions_directory_path(workspace_root: &Path) -> PathBuf {
    workspace_root.join(SESSION_DIRECTORY_RELATIVE_PATH)
}

fn session_index_path(workspace_root: &Path) -> PathBuf {
    sessions_directory_path(workspace_root).join(SESSION_INDEX_FILE_NAME)
}

fn session_snapshot_path(workspace_root: &Path, session_id: &str) -> PathBuf {
    sessions_directory_path(workspace_root).join(format!("{session_id}.json"))
}

fn build_workspace_summary(workspace: &WorkspaceContext) -> String {
    let mut paths = workspace.files.keys().cloned().collect::<Vec<_>>();
    paths.sort();

    if paths.is_empty() {
        return String::from("No workspace files were discovered for this project.");
    }

    let mut summary = String::from("Workspace files:\n");

    for path in paths.iter().take(180) {
        summary.push_str("- ");
        summary.push_str(path);
        summary.push('\n');
    }

    if paths.len() > 180 {
        summary.push_str(&format!(
            "- ... and {} more files not shown in this summary.\n",
            paths.len() - 180
        ));
    }

    summary
}

fn normalized_title(title: Option<&str>) -> Option<String> {
    title
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.replace('\n', " "))
}

fn normalize_autonomy_mode(value: &str) -> String {
    match value.trim() {
        "stepped" => String::from("stepped"),
        "god_mode" => String::from("god_mode"),
        _ => String::from("milestone"),
    }
}

fn build_message_preview(value: &str) -> String {
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut preview = collapsed.chars().take(120).collect::<String>();

    if collapsed.chars().count() > 120 {
        preview.push('…');
    }

    preview
}

fn create_chat_entity_id(prefix: &str) -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let counter = SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{millis:x}-{counter:x}")
}

#[derive(Clone, Copy)]
enum ChatExecutionPhase {
    Proposal,
    Write,
}

impl ChatExecutionPhase {
    fn copy(self) -> Self {
        self
    }

    fn label(self) -> &'static str {
        match self {
            Self::Proposal => "proposal",
            Self::Write => "write",
        }
    }

    fn milestone(self) -> &'static str {
        match self {
            Self::Proposal => "Proposal Pass",
            Self::Write => "Execution Pass",
        }
    }

    fn completed_milestone(self) -> &'static str {
        match self {
            Self::Proposal => "Proposal Complete",
            Self::Write => "Execution Complete",
        }
    }

    fn summary(self) -> &'static str {
        match self {
            Self::Proposal => {
                "Running a read-only pass to propose the patch or command plan before approval."
            }
            Self::Write => "Running the selected CLI against the project workspace.",
        }
    }

    fn completed_summary(self) -> &'static str {
        match self {
            Self::Proposal => "Proposal phase completed. Review the suggested plan before continuing.",
            Self::Write => "Provider turn completed. Refresh the diff and transcript before continuing.",
        }
    }

    fn line(self) -> &'static str {
        match self {
            Self::Proposal => {
                "Launching the proposal pass with read-only permissions and the attached project context."
            }
            Self::Write => "Launching the write pass with the configured autonomy permissions.",
        }
    }

    fn instructions(self) -> &'static str {
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

enum ChatStopState {
    Continue,
    StopRequested,
    Replaced,
}

enum ApprovalOutcome {
    Approved,
    StopRequested,
    Replaced,
}
