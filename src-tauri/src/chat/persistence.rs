use crate::models::{ChatSessionIndexPayload, ChatSessionSnapshot};
use std::{
    fs,
    path::{Path, PathBuf},
};

use super::helpers::{summarize_session, upsert_chat_session_summary};

pub(super) const SESSION_DIRECTORY_RELATIVE_PATH: &str = ".specforge/sessions";
pub(super) const SESSION_INDEX_FILE_NAME: &str = "index.json";

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

pub(super) fn write_chat_session_index(
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

pub(super) fn read_chat_session_snapshot(
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

pub(super) fn write_chat_session_snapshot(
    workspace_root: &Path,
    snapshot: &ChatSessionSnapshot,
) -> Result<(), String> {
    ensure_session_directory(workspace_root)?;
    let encoded = serde_json::to_string_pretty(snapshot)
        .map_err(|error| format!("Unable to encode the chat session {}: {error}", snapshot.id))?;
    fs::write(
        session_snapshot_path(workspace_root, &snapshot.id),
        encoded.as_bytes(),
    )
    .map_err(|error| {
        format!(
            "Unable to write the chat session {}: {error}",
            session_snapshot_path(workspace_root, &snapshot.id).display()
        )
    })
}

pub(super) fn ensure_session_directory(workspace_root: &Path) -> Result<(), String> {
    let sessions_path = sessions_directory_path(workspace_root);
    fs::create_dir_all(&sessions_path).map_err(|error| {
        format!(
            "Unable to create the chat session directory {}: {error}",
            sessions_path.display()
        )
    })
}

pub(super) fn sessions_directory_path(workspace_root: &Path) -> PathBuf {
    workspace_root.join(SESSION_DIRECTORY_RELATIVE_PATH)
}

pub(super) fn session_index_path(workspace_root: &Path) -> PathBuf {
    sessions_directory_path(workspace_root).join(SESSION_INDEX_FILE_NAME)
}

pub(super) fn session_snapshot_path(workspace_root: &Path, session_id: &str) -> PathBuf {
    sessions_directory_path(workspace_root).join(format!("{session_id}.json"))
}

pub(super) fn refresh_index_summary(
    workspace_root: &Path,
    snapshot: &ChatSessionSnapshot,
) -> Result<(), String> {
    let mut index = load_chat_session_index(workspace_root)?;
    upsert_chat_session_summary(&mut index, summarize_session(snapshot));
    if index.last_active_session_id.is_none() {
        index.last_active_session_id = Some(snapshot.id.clone());
    }
    write_chat_session_index(workspace_root, &index)
}
