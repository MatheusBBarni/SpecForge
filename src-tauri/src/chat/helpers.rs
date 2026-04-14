use crate::{
    models::{
        AutonomyMode, ChatContextItem, ChatSessionIndexPayload, ChatSessionSnapshot,
        ChatSessionSummary, ProjectSettings,
    },
    project::{build_default_project_settings, load_project_settings_from_workspace_root},
    state::{SharedState, WorkspaceContext},
};
use std::{
    collections::BTreeSet,
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;

pub(crate) static SESSION_COUNTER: AtomicU64 = AtomicU64::new(0);

pub(super) fn active_workspace_context(
    state: &State<SharedState>,
) -> Result<WorkspaceContext, String> {
    state
        .workspace
        .lock()
        .map_err(|_| String::from("Workspace lock was poisoned."))?
        .clone()
        .ok_or_else(|| String::from("No workspace folder is currently open."))
}

pub(super) fn load_workspace_project_settings(
    workspace_root: &Path,
) -> Result<ProjectSettings, String> {
    let defaults = build_default_project_settings(workspace_root, None, None);
    load_project_settings_from_workspace_root(workspace_root, defaults)
        .map(|(settings, _)| settings)
}

pub(super) fn build_default_context_items(settings: &ProjectSettings) -> Vec<ChatContextItem> {
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

pub(super) fn build_context_item(
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

pub(super) fn normalize_context_items(items: Vec<ChatContextItem>) -> Vec<ChatContextItem> {
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

pub(super) fn summarize_session(snapshot: &ChatSessionSnapshot) -> ChatSessionSummary {
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

pub(super) fn upsert_chat_session_summary(
    index: &mut ChatSessionIndexPayload,
    summary: ChatSessionSummary,
) {
    if let Some(existing_summary) = index.sessions.iter_mut().find(|entry| entry.id == summary.id) {
        *existing_summary = summary;
    } else {
        index.sessions.push(summary);
    }

    index
        .sessions
        .sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
}

pub(super) fn normalized_title(title: Option<&str>) -> Option<String> {
    title
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.replace('\n', " "))
}

pub(super) fn normalize_autonomy_mode(value: &str) -> AutonomyMode {
    match value.trim() {
        "stepped" => AutonomyMode::Stepped,
        "god_mode" => AutonomyMode::GodMode,
        _ => AutonomyMode::Milestone,
    }
}

pub(super) fn build_message_preview(value: &str) -> String {
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut preview = collapsed.chars().take(120).collect::<String>();

    if collapsed.chars().count() > 120 {
        preview.push('…');
    }

    preview
}

pub(super) fn create_chat_entity_id(prefix: &str) -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let counter = SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{millis:x}-{counter:x}")
}
