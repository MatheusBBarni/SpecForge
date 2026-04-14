use crate::{
    environment::current_timestamp,
    models::{
        AutonomyMode, ChatContextItem, ChatRuntimeState, ChatSessionIndexPayload,
        ChatSessionSnapshot, ChatSessionSummary, SessionStatus,
    },
    project::{normalize_project_model, normalize_project_reasoning},
    state::SharedState,
};
use std::{fs, thread};
use tauri::{AppHandle, State};

use super::{
    execution::run_chat_turn,
    helpers::{
        active_workspace_context, build_default_context_items, build_message_preview,
        create_chat_entity_id, load_workspace_project_settings, normalize_autonomy_mode,
        normalize_context_items, normalized_title, summarize_session,
        upsert_chat_session_summary,
    },
    persistence::{
        load_chat_session_index, read_chat_session_snapshot, session_snapshot_path,
        write_chat_session_index, write_chat_session_snapshot,
    },
};

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
        status: SessionStatus::Idle,
        last_message_preview: String::new(),
        selected_model: settings.selected_model.clone(),
        selected_reasoning: settings.selected_reasoning.clone(),
        autonomy_mode: AutonomyMode::Milestone,
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
