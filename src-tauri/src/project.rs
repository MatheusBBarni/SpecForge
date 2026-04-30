use crate::{
    chat::load_chat_session_index,
    constants::{
        DEFAULT_EXECUTION_AGENT_DESCRIPTION, DEFAULT_PRD_AGENT_DESCRIPTION,
        DEFAULT_PROJECT_PRD_PATH, DEFAULT_PROJECT_SPEC_PATH, DEFAULT_SPEC_AGENT_DESCRIPTION,
        SPECFORGE_SETTINGS_RELATIVE_PATH,
    },
    documents::load_configured_workspace_document,
    models::{ProjectContextPayload, ProjectSettings},
    paths::{canonicalize_existing_path, normalize_relative_path},
    state::{ScannedWorkspace, SharedState},
    workspace::scan_workspace_folder,
};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::State;

#[tauri::command]
pub(crate) fn pick_project_folder(
    state: State<SharedState>,
) -> Result<Option<ProjectContextPayload>, String> {
    let Some(folder_path) = rfd::FileDialog::new().pick_folder() else {
        return Ok(None);
    };

    load_project_context_from_folder(&state, &folder_path).map(Some)
}

#[tauri::command]
pub(crate) fn load_project_context(
    state: State<SharedState>,
    folder_path: String,
) -> Result<ProjectContextPayload, String> {
    let trimmed_path = folder_path.trim();

    if trimmed_path.is_empty() {
        return Err(String::from("A workspace folder path is required."));
    }

    load_project_context_from_folder(&state, &PathBuf::from(trimmed_path))
}

#[tauri::command]
pub(crate) fn save_project_settings(
    folder_path: String,
    settings: ProjectSettings,
) -> Result<ProjectSettings, String> {
    let trimmed_path = folder_path.trim();

    if trimmed_path.is_empty() {
        return Err(String::from("A workspace folder path is required."));
    }

    let workspace_root =
        canonicalize_existing_path(&PathBuf::from(trimmed_path)).map_err(|error| {
            format!(
                "Unable to resolve the selected workspace folder {}: {error}",
                trimmed_path
            )
        })?;
    let default_settings = build_default_project_settings(&workspace_root, None, None);
    let normalized_settings =
        normalize_project_settings(&workspace_root, default_settings, Some(settings))?;
    let settings_path = workspace_root.join(SPECFORGE_SETTINGS_RELATIVE_PATH);
    let settings_directory = settings_path
        .parent()
        .ok_or_else(|| String::from("Unable to resolve the .specforge directory."))?;

    fs::create_dir_all(settings_directory).map_err(|error| {
        format!(
            "Unable to create the project settings directory {}: {error}",
            settings_directory.display()
        )
    })?;
    let settings_json = serde_json::to_string_pretty(&normalized_settings)
        .map_err(|error| format!("Unable to encode project settings: {error}"))?;

    fs::write(&settings_path, settings_json.as_bytes()).map_err(|error| {
        format!(
            "Unable to write project settings to {}: {error}",
            settings_path.display()
        )
    })?;

    Ok(normalized_settings)
}

pub(crate) fn load_project_context_from_folder(
    state: &State<SharedState>,
    folder_path: &Path,
) -> Result<ProjectContextPayload, String> {
    let scanned_workspace = scan_workspace_folder(folder_path)?;
    let ScannedWorkspace { result, context } = scanned_workspace;
    let settings_path = context.root.join(SPECFORGE_SETTINGS_RELATIVE_PATH);
    let default_settings = build_default_project_settings(
        &context.root,
        result.prd_document.as_ref(),
        result.spec_document.as_ref(),
    );
    let (settings, has_saved_settings) =
        load_project_settings_from_workspace_root(&context.root, default_settings)?;
    let prd_document = load_configured_workspace_document(&context.root, &settings.prd_path)?;
    let spec_document = load_configured_workspace_document(&context.root, &settings.spec_path)?;
    let chat_index = load_chat_session_index(&context.root)?;
    let mut active_workspace = state
        .workspace
        .lock()
        .map_err(|_| String::from("Workspace lock was poisoned."))?;
    *active_workspace = Some(context);

    Ok(ProjectContextPayload {
        root_name: result.root_name,
        root_path: active_workspace
            .as_ref()
            .map(|workspace| workspace.root.display().to_string())
            .unwrap_or_default(),
        settings_path: settings_path.display().to_string(),
        has_saved_settings,
        settings,
        entries: result.entries,
        ignored_file_count: result.ignored_file_count,
        prd_document,
        spec_document,
        chat_sessions: chat_index.sessions,
        last_active_session_id: chat_index.last_active_session_id,
    })
}

pub(crate) fn build_default_project_settings(
    workspace_root: &Path,
    prd_document: Option<&crate::models::WorkspaceDocument>,
    spec_document: Option<&crate::models::WorkspaceDocument>,
) -> ProjectSettings {
    ProjectSettings {
        selected_model: String::from("composer-2"),
        selected_reasoning: String::from("medium"),
        prd_agent_description: String::from(DEFAULT_PRD_AGENT_DESCRIPTION),
        spec_agent_description: String::from(DEFAULT_SPEC_AGENT_DESCRIPTION),
        execution_agent_description: String::from(DEFAULT_EXECUTION_AGENT_DESCRIPTION),
        prd_path: derive_default_document_path(
            workspace_root,
            prd_document,
            DEFAULT_PROJECT_PRD_PATH,
        ),
        spec_path: derive_default_document_path(
            workspace_root,
            spec_document,
            DEFAULT_PROJECT_SPEC_PATH,
        ),
        supporting_document_paths: Vec::new(),
    }
}

pub(crate) fn normalize_project_settings(
    workspace_root: &Path,
    defaults: ProjectSettings,
    provided: Option<ProjectSettings>,
) -> Result<ProjectSettings, String> {
    let Some(provided) = provided else {
        return Ok(defaults);
    };

    let selected_model =
        normalize_project_model(&provided.selected_model, &defaults.selected_model)?;
    let selected_reasoning =
        normalize_project_reasoning(&provided.selected_reasoning, &defaults.selected_reasoning)?;
    let normalized_prd_path =
        normalize_project_path_or_default(workspace_root, &provided.prd_path, &defaults.prd_path)?;
    let normalized_spec_path = normalize_project_path_or_default(
        workspace_root,
        &provided.spec_path,
        &defaults.spec_path,
    )?;
    let supporting_document_paths = provided
        .supporting_document_paths
        .iter()
        .filter_map(|entry| normalize_relative_path(entry).ok())
        .collect::<Vec<_>>();

    Ok(ProjectSettings {
        selected_model,
        selected_reasoning,
        prd_agent_description: if provided.prd_agent_description.trim().is_empty() {
            defaults.prd_agent_description
        } else {
            provided.prd_agent_description.trim().to_string()
        },
        spec_agent_description: if provided.spec_agent_description.trim().is_empty() {
            defaults.spec_agent_description
        } else {
            provided.spec_agent_description.trim().to_string()
        },
        execution_agent_description: if provided.execution_agent_description.trim().is_empty() {
            defaults.execution_agent_description
        } else {
            provided.execution_agent_description.trim().to_string()
        },
        prd_path: normalized_prd_path,
        spec_path: normalized_spec_path,
        supporting_document_paths,
    })
}

pub(crate) fn normalize_project_path_or_default(
    workspace_root: &Path,
    value: &str,
    fallback: &str,
) -> Result<String, String> {
    if value.trim().is_empty() {
        return Ok(fallback.to_string());
    }

    normalize_relative_path(value).map_err(|error| {
        format!(
            "Invalid project document path for workspace {}: {error}",
            workspace_root.display()
        )
    })
}

pub(crate) fn derive_default_document_path(
    workspace_root: &Path,
    document: Option<&crate::models::WorkspaceDocument>,
    fallback: &str,
) -> String {
    document
        .and_then(|entry| {
            PathBuf::from(&entry.source_path)
                .strip_prefix(workspace_root)
                .ok()
                .map(|path| path.to_string_lossy().replace('\\', "/"))
        })
        .unwrap_or_else(|| fallback.to_string())
}

fn read_project_settings(
    settings_path: &Path,
    workspace_root: &Path,
    defaults: ProjectSettings,
) -> Result<(ProjectSettings, bool), String> {
    if !settings_path.exists() {
        return Ok((defaults, false));
    }

    let raw_settings = fs::read_to_string(settings_path).map_err(|error| {
        format!(
            "Unable to read project settings {}: {error}",
            settings_path.display()
        )
    })?;
    let parsed_settings =
        serde_json::from_str::<ProjectSettings>(&raw_settings).map_err(|error| {
            format!(
                "Unable to parse project settings {}: {error}",
                settings_path.display()
            )
        })?;

    Ok((
        normalize_project_settings(workspace_root, defaults, Some(parsed_settings))?,
        true,
    ))
}

pub(crate) fn load_project_settings_from_workspace_root(
    workspace_root: &Path,
    defaults: ProjectSettings,
) -> Result<(ProjectSettings, bool), String> {
    let settings_path = workspace_root.join(SPECFORGE_SETTINGS_RELATIVE_PATH);
    read_project_settings(&settings_path, workspace_root, defaults)
}

pub(crate) fn normalize_project_model(value: &str, fallback: &str) -> Result<String, String> {
    let trimmed_value = value.trim();

    if trimmed_value.is_empty() {
        return Ok(fallback.to_string());
    }

    if !trimmed_value.chars().any(char::is_whitespace) {
        return Ok(trimmed_value.to_string());
    }

    Err(format!(
        "Unsupported model `{trimmed_value}` in project settings."
    ))
}

pub(crate) fn normalize_project_reasoning(value: &str, fallback: &str) -> Result<String, String> {
    let trimmed_value = value.trim();

    if trimmed_value.is_empty() {
        return Ok(fallback.to_string());
    }

    if !trimmed_value.chars().any(char::is_whitespace) {
        return Ok(trimmed_value.to_string());
    }

    Err(format!(
        "Unsupported reasoning profile `{trimmed_value}` in project settings."
    ))
}
