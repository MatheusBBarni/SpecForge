use git2::{DiffFormat, DiffOptions, Repository};
use ignore::WalkBuilder;
use lopdf::Document;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Condvar, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
struct SharedState {
    runtime: Arc<ExecutionRuntime>,
    workspace: Mutex<Option<WorkspaceContext>>,
}

#[derive(Default)]
struct ExecutionRuntime {
    control: Mutex<ExecutionControl>,
    signal: Condvar,
}

#[derive(Default)]
struct ExecutionControl {
    run_id: u64,
    awaiting_approval: bool,
    stop_requested: bool,
}

struct WorkspaceContext {
    root: PathBuf,
    files: HashMap<String, PathBuf>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliStatus {
    name: String,
    status: String,
    path: Option<String>,
    detail: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EnvironmentStatus {
    scanned_at: String,
    claude: CliStatus,
    codex: CliStatus,
    git: CliStatus,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceEntry {
    name: String,
    path: String,
    kind: String,
    depth: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceDocument {
    content: String,
    source_path: String,
    file_name: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSettings {
    selected_model: String,
    selected_reasoning: String,
    prd_prompt: String,
    spec_prompt: String,
    prd_path: String,
    spec_path: String,
    supporting_document_paths: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectContextPayload {
    root_name: String,
    root_path: String,
    settings_path: String,
    has_saved_settings: bool,
    settings: ProjectSettings,
    entries: Vec<WorkspaceEntry>,
    ignored_file_count: usize,
    prd_document: Option<WorkspaceDocument>,
    spec_document: Option<WorkspaceDocument>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceScanResult {
    root_name: String,
    entries: Vec<WorkspaceEntry>,
    ignored_file_count: usize,
    prd_document: Option<WorkspaceDocument>,
    spec_document: Option<WorkspaceDocument>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentStateEvent {
    status: String,
    current_milestone: Option<String>,
    pending_diff: Option<String>,
    summary: Option<String>,
}

struct SimulatedStep {
    delay_ms: u64,
    line: String,
    milestone: &'static str,
    gate: bool,
}

struct ScannedWorkspace {
    result: WorkspaceScanResult,
    context: WorkspaceContext,
}

enum StopState {
    Continue,
    StopRequested,
    Replaced,
}

enum ApprovalWaitOutcome {
    Approved,
    StopRequested,
    Replaced,
}

const SAMPLE_DIFF: &str = r#"diff --git a/src/App.tsx b/src/App.tsx
index 0000000..forge42 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@
- Render placeholder starter card
+ Introduce PRD/spec review workspace with execution controls
+ Add Dracula-first theme tokens and persisted preferences
+ Surface CLI health, diff approvals, and terminal streaming"#;
const SPECFORGE_SETTINGS_RELATIVE_PATH: &str = ".specforge/settings.json";
const DEFAULT_PROJECT_PRD_PATH: &str = "docs/PRD.md";
const DEFAULT_PROJECT_SPEC_PATH: &str = "docs/SPEC.md";
const DEFAULT_PRD_PROMPT: &str = r#"Act as an Expert Senior Product Manager. Your goal is to help me write a comprehensive, well-structured Product Requirements Document (PRD) for a new [product / feature / app] called [Project Name].

I have some initial ideas, but I want to make sure the PRD is thorough. Before you draft the full document, please ask me a series of clarifying questions to gather the necessary context.

Please ask about:
- The core problem we are solving
- The target audience/user personas
- Key features and user flows
- Success metrics (KPIs)
- Technical or timeline constraints

Ask me these questions one or two at a time so I do not get overwhelmed. Once you have enough context, we will move on to drafting the actual PRD."#;
const DEFAULT_SPEC_PROMPT: &str = r#"Act as an Expert Software Architect and Tech Lead. I have attached the Product Requirements Document (PRD) for our upcoming project.

Your task is to analyze this PRD and draft a comprehensive Technical Specification Document.

Please structure the spec with the following sections:

1. High-Level Architecture: A conceptual overview of how the system components will interact.
2. Tech Stack & Tooling: Define the frontend, backend, and infrastructure.
3. Data Models & Database Schema: Define the core entities, their attributes, and relationships.
4. API Contracts: Outline the primary endpoints (methods, routes, request/response structures) needed to support the user flows.
5. Component & State Management: How data will flow through the application and how the UI will be structured.
6. Security & Edge Cases: Potential vulnerabilities, error handling, and performance bottlenecks.
7. Engineering Milestones: Break the implementation down into logical, phased deliverables.

Before writing the full document, please provide a brief bulleted summary of your proposed technical approach, and ask me up to 3 clarifying questions about any technical constraints or non-functional requirements that might be missing from the PRD."#;

#[tauri::command]
fn run_environment_scan(
    claude_path: Option<String>,
    codex_path: Option<String>,
) -> Result<EnvironmentStatus, String> {
    Ok(EnvironmentStatus {
        scanned_at: current_timestamp(),
        claude: inspect_binary("Claude CLI", "claude", claude_path.as_deref()),
        codex: inspect_binary("Codex CLI", "codex", codex_path.as_deref()),
        git: inspect_binary("Git", "git", None),
    })
}

#[tauri::command]
fn parse_document(file_path: String) -> Result<String, String> {
    let resolved_path = resolve_project_document_path(&file_path)?;
    parse_supported_document(&resolved_path)
}

#[tauri::command]
fn pick_document() -> Result<Option<WorkspaceDocument>, String> {
    let Some(file_path) = rfd::FileDialog::new()
        .add_filter("Documents", &["md", "pdf"])
        .pick_file()
    else {
        return Ok(None);
    };

    let resolved_path = canonicalize_existing_path(&file_path)
        .map_err(|error| format!("Unable to prepare selected document: {error}"))?;
    let content = parse_supported_document(&resolved_path)?;
    let file_name = resolved_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Document")
        .to_string();

    Ok(Some(WorkspaceDocument {
        content,
        source_path: resolved_path.display().to_string(),
        file_name,
    }))
}

#[tauri::command]
fn pick_project_folder(state: State<SharedState>) -> Result<Option<ProjectContextPayload>, String> {
    let Some(folder_path) = rfd::FileDialog::new().pick_folder() else {
        return Ok(None);
    };

    load_project_context_from_folder(&state, &folder_path).map(Some)
}

#[tauri::command]
fn load_project_context(
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
fn save_project_settings(
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

#[tauri::command]
fn open_workspace_folder(state: State<SharedState>) -> Result<Option<WorkspaceScanResult>, String> {
    let Some(folder_path) = rfd::FileDialog::new().pick_folder() else {
        return Ok(None);
    };

    let scanned_workspace = scan_workspace_folder(&folder_path)?;
    let mut active_workspace = state
        .workspace
        .lock()
        .map_err(|_| String::from("Workspace lock was poisoned."))?;
    *active_workspace = Some(scanned_workspace.context);
    Ok(Some(scanned_workspace.result))
}

#[tauri::command]
fn read_workspace_file(state: State<SharedState>, file_path: String) -> Result<String, String> {
    let resolved_path = resolve_workspace_file_path(&state, &file_path)?;

    fs::read_to_string(&resolved_path).map_err(|error| {
        format!(
            "Unable to read workspace file {}: {error}",
            resolved_path.display()
        )
    })
}

#[tauri::command]
fn get_workspace_snapshot() -> Result<Vec<WorkspaceEntry>, String> {
    let root = project_root();
    let directory = fs::read_dir(&root)
        .map_err(|error| format!("Unable to read workspace root {}: {error}", root.display()))?;
    let mut entries = directory
        .filter_map(Result::ok)
        .map(|entry| {
            let path = entry.path();
            let metadata = entry.metadata().ok();
            let kind = if metadata.as_ref().is_some_and(|item| item.is_dir()) {
                "directory"
            } else {
                "file"
            };

            WorkspaceEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path
                    .strip_prefix(&root)
                    .unwrap_or(path.as_path())
                    .to_string_lossy()
                    .replace('\\', "/"),
                kind: kind.to_string(),
                depth: 0,
            }
        })
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| left.kind.cmp(&right.kind).then(left.name.cmp(&right.name)));
    Ok(entries)
}

fn scan_workspace_folder(root: &Path) -> Result<ScannedWorkspace, String> {
    let canonical_root = canonicalize_existing_path(root).map_err(|error| {
        format!(
            "Unable to prepare workspace folder {}: {error}",
            root.display()
        )
    })?;
    let root_name = canonical_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Workspace")
        .to_string();
    let mut directory_entries = HashMap::<String, WorkspaceEntry>::new();
    let mut file_entries = Vec::<WorkspaceEntry>::new();
    let mut file_paths = HashMap::<String, PathBuf>::new();
    let mut file_documents = Vec::<(String, PathBuf)>::new();

    let walker = WalkBuilder::new(&canonical_root)
        .hidden(false)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .build();

    for item in walker {
        let entry = match item {
            Ok(entry) => entry,
            Err(error) => {
                return Err(format!(
                    "Unable to walk workspace folder {}: {error}",
                    canonical_root.display()
                ));
            }
        };
        let path = entry.path();

        if path == canonical_root.as_path() {
            continue;
        }

        let relative_path = path
            .strip_prefix(&canonical_root)
            .map_err(|error| {
                format!(
                    "Unable to normalize workspace path {}: {error}",
                    path.display()
                )
            })?
            .to_string_lossy()
            .replace('\\', "/");

        if relative_path.is_empty() {
            continue;
        }

        let depth = relative_path.split('/').count().saturating_sub(1);
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string();

        if entry
            .file_type()
            .map(|file_type| file_type.is_dir())
            .unwrap_or(false)
        {
            directory_entries.insert(
                relative_path.clone(),
                WorkspaceEntry {
                    name: file_name,
                    path: relative_path,
                    kind: String::from("directory"),
                    depth,
                },
            );
            continue;
        }

        for (index, segment) in relative_path
            .split('/')
            .collect::<Vec<_>>()
            .iter()
            .enumerate()
        {
            if index == relative_path.split('/').count() - 1 {
                break;
            }

            let directory_path = relative_path
                .split('/')
                .take(index + 1)
                .collect::<Vec<_>>()
                .join("/");

            directory_entries
                .entry(directory_path.clone())
                .or_insert_with(|| WorkspaceEntry {
                    name: (*segment).to_string(),
                    path: directory_path,
                    kind: String::from("directory"),
                    depth: index,
                });
        }

        file_entries.push(WorkspaceEntry {
            name: file_name.clone(),
            path: relative_path.clone(),
            kind: String::from("file"),
            depth,
        });
        file_paths.insert(relative_path.clone(), path.to_path_buf());
        file_documents.push((relative_path, path.to_path_buf()));
    }

    let mut entries = directory_entries
        .into_values()
        .chain(file_entries)
        .collect::<Vec<_>>();
    entries.sort_by(compare_workspace_entries);

    let prd_document = pick_workspace_document(&file_documents, &["prd.md", "prd.pdf"])?;
    let spec_document = pick_workspace_document(&file_documents, &["spec.md", "spec.pdf"])?;

    Ok(ScannedWorkspace {
        result: WorkspaceScanResult {
            root_name,
            entries,
            ignored_file_count: 0,
            prd_document,
            spec_document,
        },
        context: WorkspaceContext {
            root: canonical_root,
            files: file_paths,
        },
    })
}

fn load_project_context_from_folder(
    state: &State<SharedState>,
    folder_path: &Path,
) -> Result<ProjectContextPayload, String> {
    let scanned_workspace = scan_workspace_folder(folder_path)?;
    let settings_path = scanned_workspace
        .context
        .root
        .join(SPECFORGE_SETTINGS_RELATIVE_PATH);
    let default_settings = build_default_project_settings(
        &scanned_workspace.context.root,
        scanned_workspace.result.prd_document.as_ref(),
        scanned_workspace.result.spec_document.as_ref(),
    );
    let (settings, has_saved_settings) = read_project_settings(
        &settings_path,
        &scanned_workspace.context.root,
        default_settings,
    )?;
    let prd_document =
        load_configured_workspace_document(&scanned_workspace.context.root, &settings.prd_path)?;
    let spec_document =
        load_configured_workspace_document(&scanned_workspace.context.root, &settings.spec_path)?;
    let mut active_workspace = state
        .workspace
        .lock()
        .map_err(|_| String::from("Workspace lock was poisoned."))?;
    *active_workspace = Some(scanned_workspace.context);

    Ok(ProjectContextPayload {
        root_name: scanned_workspace.result.root_name,
        root_path: active_workspace
            .as_ref()
            .map(|workspace| workspace.root.display().to_string())
            .unwrap_or_default(),
        settings_path: settings_path.display().to_string(),
        has_saved_settings,
        settings,
        entries: scanned_workspace.result.entries,
        ignored_file_count: scanned_workspace.result.ignored_file_count,
        prd_document,
        spec_document,
    })
}

fn build_default_project_settings(
    workspace_root: &Path,
    prd_document: Option<&WorkspaceDocument>,
    spec_document: Option<&WorkspaceDocument>,
) -> ProjectSettings {
    ProjectSettings {
        selected_model: String::from("gpt-5.4"),
        selected_reasoning: String::from("medium"),
        prd_prompt: String::from(DEFAULT_PRD_PROMPT),
        spec_prompt: String::from(DEFAULT_SPEC_PROMPT),
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

fn normalize_project_settings(
    workspace_root: &Path,
    defaults: ProjectSettings,
    provided: Option<ProjectSettings>,
) -> Result<ProjectSettings, String> {
    let Some(provided) = provided else {
        return Ok(defaults);
    };

    let selected_model =
        normalize_project_model(&provided.selected_model, &defaults.selected_model);
    let selected_reasoning =
        normalize_project_reasoning(&provided.selected_reasoning, &defaults.selected_reasoning);
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
        prd_prompt: if provided.prd_prompt.trim().is_empty() {
            defaults.prd_prompt
        } else {
            provided.prd_prompt.trim().to_string()
        },
        spec_prompt: if provided.spec_prompt.trim().is_empty() {
            defaults.spec_prompt
        } else {
            provided.spec_prompt.trim().to_string()
        },
        prd_path: normalized_prd_path,
        spec_path: normalized_spec_path,
        supporting_document_paths,
    })
}

fn normalize_project_model(value: &str, fallback: &str) -> String {
    const VALID_MODELS: &[&str] = &[
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.3-codex",
        "gpt-5.2",
        "claude-opus-4-1-20250805",
        "claude-opus-4-20250514",
        "claude-sonnet-4-20250514",
        "claude-3-7-sonnet-20250219",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-sonnet-20240620",
        "claude-3-5-haiku-20241022",
        "claude-3-haiku-20240307",
    ];

    if VALID_MODELS.contains(&value.trim()) {
        return value.trim().to_string();
    }

    fallback.to_string()
}

fn normalize_project_reasoning(value: &str, fallback: &str) -> String {
    match value.trim() {
        "low" | "medium" | "high" | "max" => value.trim().to_string(),
        _ => fallback.to_string(),
    }
}

fn normalize_project_path_or_default(
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

fn derive_default_document_path(
    workspace_root: &Path,
    document: Option<&WorkspaceDocument>,
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

fn load_configured_workspace_document(
    workspace_root: &Path,
    relative_path: &str,
) -> Result<Option<WorkspaceDocument>, String> {
    let resolved_path = resolve_relative_path_under_root(workspace_root, relative_path)?;

    if !resolved_path.exists() {
        return Ok(None);
    }

    let content = parse_workspace_document(&resolved_path)?;
    let file_name = resolved_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Document")
        .to_string();

    Ok(Some(WorkspaceDocument {
        content,
        source_path: resolved_path.display().to_string(),
        file_name,
    }))
}

#[tauri::command]
fn git_get_diff() -> Result<String, String> {
    let repository = Repository::discover(project_root())
        .map_err(|error| format!("Unable to discover git repository: {error}"))?;
    let head_tree = repository
        .head()
        .ok()
        .and_then(|head| head.peel_to_tree().ok());
    let index = repository
        .index()
        .map_err(|error| format!("Unable to inspect git index: {error}"))?;
    let mut staged_options = DiffOptions::new();
    let staged_diff = repository
        .diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut staged_options))
        .map_err(|error| format!("Unable to inspect staged diff: {error}"))?;
    let mut workdir_options = DiffOptions::new();
    workdir_options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .show_untracked_content(true);
    let workdir_diff = repository
        .diff_index_to_workdir(Some(&index), Some(&mut workdir_options))
        .map_err(|error| format!("Unable to inspect worktree diff: {error}"))?;
    let staged_rendered = render_diff(&staged_diff)?;
    let workdir_rendered = render_diff(&workdir_diff)?;
    let rendered = match (staged_rendered.trim(), workdir_rendered.trim()) {
        ("", "") => String::new(),
        ("", _) => workdir_rendered,
        (_, "") => staged_rendered,
        _ => format!("{staged_rendered}\n{workdir_rendered}"),
    };

    if rendered.trim().is_empty() {
        return Ok(SAMPLE_DIFF.to_string());
    }

    Ok(rendered)
}

#[tauri::command]
fn generate_prd_document(
    workspace_root: String,
    output_path: String,
    prompt_template: String,
    user_prompt: String,
    provider: String,
    model: String,
    reasoning: String,
    claude_path: Option<String>,
    codex_path: Option<String>,
) -> Result<WorkspaceDocument, String> {
    let trimmed_prompt = user_prompt.trim();

    if trimmed_prompt.is_empty() {
        return Err(String::from(
            "Add the product context you want the AI to consider.",
        ));
    }

    let prompt_payload = build_generation_prompt(&prompt_template, trimmed_prompt, &[]);
    let generated_prd = run_generation_request(
        &provider,
        &model,
        &reasoning,
        claude_path.as_deref(),
        codex_path.as_deref(),
        &prompt_payload,
    )?;

    write_generated_workspace_document(
        &workspace_root,
        &output_path,
        generated_prd,
        "PRD output path",
    )
}

#[tauri::command]
fn generate_spec_document(
    workspace_root: String,
    output_path: String,
    prd_content: String,
    prompt_template: String,
    user_prompt: String,
    provider: String,
    model: String,
    reasoning: String,
    claude_path: Option<String>,
    codex_path: Option<String>,
) -> Result<WorkspaceDocument, String> {
    let trimmed_prd = prd_content.trim();
    let trimmed_prompt = user_prompt.trim();

    if trimmed_prd.is_empty() {
        return Err(String::from(
            "Load or write a PRD before generating a specification.",
        ));
    }

    if trimmed_prompt.is_empty() {
        return Err(String::from(
            "Add the technical guidance you want the AI to consider.",
        ));
    }

    let prompt_payload = build_generation_prompt(
        &prompt_template,
        trimmed_prompt,
        &[("Attached Product Requirements Document (PRD)", trimmed_prd)],
    );
    let generated_spec = run_generation_request(
        &provider,
        &model,
        &reasoning,
        claude_path.as_deref(),
        codex_path.as_deref(),
        &prompt_payload,
    )?;

    write_generated_workspace_document(
        &workspace_root,
        &output_path,
        generated_spec,
        "SPEC output path",
    )
}

#[tauri::command]
fn spawn_cli_agent(
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
        control.run_id
    };

    thread::spawn(move || {
        run_simulated_agent(app, runtime, run_id, spec_payload, mode, model, reasoning);
    });

    Ok(())
}

#[tauri::command]
fn approve_action(state: State<SharedState>) -> Result<(), String> {
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
fn kill_agent_process(state: State<SharedState>) -> Result<(), String> {
    let mut control = state
        .runtime
        .control
        .lock()
        .map_err(|_| String::from("Execution lock was poisoned."))?;
    control.stop_requested = true;
    control.awaiting_approval = false;
    state.runtime.signal.notify_all();
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(SharedState::default())
        .invoke_handler(tauri::generate_handler![
            run_environment_scan,
            parse_document,
            pick_document,
            pick_project_folder,
            load_project_context,
            save_project_settings,
            open_workspace_folder,
            read_workspace_file,
            get_workspace_snapshot,
            git_get_diff,
            generate_prd_document,
            generate_spec_document,
            spawn_cli_agent,
            approve_action,
            kill_agent_process
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn current_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| String::from("0"))
}

fn inspect_binary(display_name: &str, binary_name: &str, override_path: Option<&str>) -> CliStatus {
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

fn compare_workspace_entries(left: &WorkspaceEntry, right: &WorkspaceEntry) -> std::cmp::Ordering {
    let left_segments = left.path.split('/').collect::<Vec<_>>();
    let right_segments = right.path.split('/').collect::<Vec<_>>();
    let shared_length = left_segments.len().min(right_segments.len());

    for index in 0..shared_length {
        if left_segments[index] != right_segments[index] {
            let left_is_directory = index < left_segments.len() - 1 || left.kind == "directory";
            let right_is_directory = index < right_segments.len() - 1 || right.kind == "directory";

            if left_is_directory != right_is_directory {
                return if left_is_directory {
                    std::cmp::Ordering::Less
                } else {
                    std::cmp::Ordering::Greater
                };
            }

            return left_segments[index].cmp(right_segments[index]);
        }
    }

    if left_segments.len() != right_segments.len() {
        return left_segments.len().cmp(&right_segments.len());
    }

    if left.kind != right.kind {
        return if left.kind == "directory" {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        };
    }

    left.path.cmp(&right.path)
}

fn pick_workspace_document(
    files: &[(String, PathBuf)],
    expected_names: &[&str],
) -> Result<Option<WorkspaceDocument>, String> {
    let mut ranked_files = files
        .iter()
        .filter_map(|(relative_path, absolute_path)| {
            let file_name = absolute_path
                .file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.to_lowercase())?;

            expected_names
                .iter()
                .position(|expected_name| *expected_name == file_name)
                .map(|rank| (rank, relative_path, absolute_path))
        })
        .collect::<Vec<_>>();

    ranked_files.sort_by(|left, right| {
        left.0
            .cmp(&right.0)
            .then(relative_path_depth(left.1).cmp(&relative_path_depth(right.1)))
            .then(left.1.cmp(right.1))
    });

    ranked_files
        .into_iter()
        .next()
        .map(|(_, relative_path, absolute_path)| {
            parse_workspace_document(absolute_path).map(|content| WorkspaceDocument {
                content,
                source_path: absolute_path.display().to_string(),
                file_name: relative_path
                    .rsplit('/')
                    .next()
                    .unwrap_or(relative_path)
                    .to_string(),
            })
        })
        .transpose()
}

fn read_pdf_text(path: &Path) -> Result<String, String> {
    let document = Document::load(path)
        .map_err(|error| format!("Unable to open PDF document {}: {error}", path.display()))?;
    let mut page_numbers = document.get_pages().keys().copied().collect::<Vec<_>>();
    page_numbers.sort_unstable();

    document.extract_text(&page_numbers).map_err(|error| {
        format!(
            "Unable to extract PDF text from {}: {error}",
            path.display()
        )
    })
}

fn parse_workspace_document(path: &Path) -> Result<String, String> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("pdf") => read_pdf_text(path),
        _ => fs::read_to_string(path).map_err(|error| {
            format!(
                "Unable to read workspace document {}: {error}",
                path.display()
            )
        }),
    }
}

fn relative_path_depth(path: &str) -> usize {
    path.split('/').count()
}

fn project_root() -> PathBuf {
    let current_directory = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    if current_directory
        .file_name()
        .and_then(|segment| segment.to_str())
        .is_some_and(|segment| segment.eq_ignore_ascii_case("src-tauri"))
    {
        return current_directory
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or(current_directory);
    }

    current_directory
}

fn resolve_project_document_path(path_value: &str) -> Result<PathBuf, String> {
    let normalized_path = normalize_relative_path(path_value)?;
    let project_root = canonicalize_existing_path(&project_root())
        .map_err(|error| format!("Unable to resolve project root: {error}"))?;
    let candidate = project_root.join(&normalized_path);
    let resolved_path = canonicalize_existing_path(&candidate).map_err(|error| {
        format!("Unable to resolve project document {normalized_path}: {error}")
    })?;

    if !resolved_path.starts_with(&project_root) {
        return Err(String::from(
            "Project document imports must stay inside the repository root.",
        ));
    }

    Ok(resolved_path)
}

fn resolve_workspace_file_path(
    state: &State<SharedState>,
    file_path: &str,
) -> Result<PathBuf, String> {
    let normalized_path = normalize_relative_path(file_path)?;
    let workspace = state
        .workspace
        .lock()
        .map_err(|_| String::from("Workspace lock was poisoned."))?;
    let active_workspace = workspace
        .as_ref()
        .ok_or_else(|| String::from("No workspace folder is currently open."))?;
    let resolved_path = active_workspace
        .files
        .get(&normalized_path)
        .ok_or_else(|| {
            format!("The file {normalized_path} is not part of the active workspace.")
        })?;
    let canonical_path = canonicalize_existing_path(resolved_path)
        .map_err(|error| format!("Unable to resolve workspace file {normalized_path}: {error}"))?;

    if !canonical_path.starts_with(&active_workspace.root) {
        return Err(format!(
            "Workspace file {normalized_path} resolved outside the active workspace root."
        ));
    }

    Ok(canonical_path)
}

fn resolve_relative_path_under_root(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let normalized_path = normalize_relative_path(relative_path)?;
    Ok(root.join(normalized_path))
}

fn write_generated_workspace_document(
    workspace_root: &str,
    output_path: &str,
    generated_content: String,
    field_name: &str,
) -> Result<WorkspaceDocument, String> {
    let trimmed_root = workspace_root.trim();

    if trimmed_root.is_empty() {
        return Err(String::from("A workspace root is required."));
    }

    let canonical_root = canonicalize_existing_path(&PathBuf::from(trimmed_root))
        .map_err(|error| format!("Unable to resolve workspace root {}: {error}", trimmed_root))?;
    let resolved_output_path = resolve_relative_path_under_root(&canonical_root, output_path)
        .map_err(|error| format!("{field_name} is invalid: {error}"))?;
    let rendered_document = format!(
        "{}\n",
        strip_wrapping_code_fence(generated_content.trim()).trim()
    );

    if rendered_document.trim().is_empty() {
        return Err(String::from(
            "The AI returned an empty document. Adjust the prompt and try again.",
        ));
    }

    if resolved_output_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| !value.eq_ignore_ascii_case("md"))
        .unwrap_or(true)
    {
        return Err(format!(
            "{field_name} must point to a Markdown file inside the selected workspace."
        ));
    }

    if let Some(parent_directory) = resolved_output_path.parent() {
        fs::create_dir_all(parent_directory).map_err(|error| {
            format!(
                "Unable to create the document folder {}: {error}",
                parent_directory.display()
            )
        })?;
    }

    fs::write(&resolved_output_path, rendered_document.as_bytes()).map_err(|error| {
        format!(
            "Unable to save the generated document to {}: {error}",
            resolved_output_path.display()
        )
    })?;

    Ok(WorkspaceDocument {
        content: rendered_document,
        source_path: resolved_output_path.display().to_string(),
        file_name: resolved_output_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Document.md")
            .to_string(),
    })
}

fn resolve_override_path(path_value: &str) -> PathBuf {
    let candidate = PathBuf::from(path_value.trim());

    if candidate.is_absolute() {
        return candidate;
    }

    project_root().join(candidate)
}

fn normalize_relative_path(path_value: &str) -> Result<String, String> {
    let trimmed_value = path_value.trim();

    if trimmed_value.is_empty() {
        return Err(String::from("A relative path is required."));
    }

    let candidate = PathBuf::from(trimmed_value);
    let mut normalized_path = PathBuf::new();

    for component in candidate.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(segment) => normalized_path.push(segment),
            Component::ParentDir => {
                return Err(String::from(
                    "Parent directory traversal is not allowed for document or workspace reads.",
                ));
            }
            Component::Prefix(_) | Component::RootDir => {
                return Err(String::from("Absolute paths are not allowed here."));
            }
        }
    }

    if normalized_path.as_os_str().is_empty() {
        return Err(String::from("A relative path is required."));
    }

    Ok(normalized_path.to_string_lossy().replace('\\', "/"))
}

fn canonicalize_existing_path(path: &Path) -> std::io::Result<PathBuf> {
    fs::canonicalize(path)
}

fn parse_supported_document(path: &Path) -> Result<String, String> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("md") => fs::read_to_string(path).map_err(|error| {
            format!(
                "Unable to read markdown document {}: {error}",
                path.display()
            )
        }),
        Some("pdf") => read_pdf_text(path),
        _ => Err(String::from("Only .md and .pdf documents are supported.")),
    }
}

fn render_diff(diff: &git2::Diff<'_>) -> Result<String, String> {
    let mut rendered = String::new();
    diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        let text = String::from_utf8_lossy(line.content());
        rendered.push_str(&text);
        true
    })
    .map_err(|error| format!("Unable to render diff: {error}"))?;
    Ok(rendered)
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

fn resolve_cli_binary(binary_name: &str, override_path: Option<&str>) -> Result<PathBuf, String> {
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

fn build_generation_prompt(
    prompt_template: &str,
    user_prompt: &str,
    attachments: &[(&str, &str)],
) -> String {
    let mut prompt = String::new();
    prompt.push_str(prompt_template.trim());
    prompt.push_str("\n\n");
    prompt.push_str("Additional operator context:\n");
    prompt.push_str(user_prompt.trim());

    for (label, content) in attachments {
        let trimmed_content = content.trim();

        if trimmed_content.is_empty() {
            continue;
        }

        prompt.push_str("\n\n");
        prompt.push_str(label);
        prompt.push_str(":\n");
        prompt.push_str(trimmed_content);
    }

    prompt
}

fn run_generation_request(
    provider: &str,
    model: &str,
    reasoning: &str,
    claude_path: Option<&str>,
    codex_path: Option<&str>,
    prompt_payload: &str,
) -> Result<String, String> {
    match provider {
        "codex" => run_codex_generation(
            &resolve_cli_binary("codex", codex_path)?,
            model,
            reasoning,
            prompt_payload,
        ),
        "claude" => run_claude_generation(
            &resolve_cli_binary("claude", claude_path)?,
            model,
            reasoning,
            prompt_payload,
        ),
        _ => Err(format!("Unsupported model provider: {provider}")),
    }
}

fn run_codex_generation(
    binary_path: &Path,
    model: &str,
    reasoning: &str,
    prompt_payload: &str,
) -> Result<String, String> {
    let temp_dir = create_spec_generation_temp_dir("codex")?;
    let output_path = temp_dir.join("generated-spec.md");
    let reasoning_effort = map_codex_reasoning(reasoning);

    let mut command = Command::new(binary_path);
    command
        .current_dir(&temp_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("exec")
        .arg("--color")
        .arg("never")
        .arg("--skip-git-repo-check")
        .arg("--sandbox")
        .arg("read-only")
        .arg("--model")
        .arg(model)
        .arg("--config")
        .arg(format!("model_reasoning_effort=\"{reasoning_effort}\""))
        .arg("--output-last-message")
        .arg(&output_path);

    let result = run_command_with_stdin(&mut command, "Codex CLI", prompt_payload)
        .and_then(|output| {
            if !output.status.success() {
                return Err(format_process_failure("Codex CLI", &output));
            }

            match fs::read_to_string(&output_path) {
                Ok(content) => Ok(content),
                Err(read_error) => {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

                    if !stdout.trim().is_empty() {
                        Ok(stdout)
                    } else {
                        Err(format!(
                            "Codex CLI completed, but the generated spec could not be read: {read_error}"
                        ))
                    }
                }
            }
        });

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

fn run_claude_generation(
    binary_path: &Path,
    model: &str,
    reasoning: &str,
    prompt_payload: &str,
) -> Result<String, String> {
    let temp_dir = create_spec_generation_temp_dir("claude")?;
    let mut command = Command::new(binary_path);
    command
        .current_dir(&temp_dir)
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
        .arg("bypassPermissions")
        .arg("--tools")
        .arg("")
        .arg("--max-turns")
        .arg("1")
        .arg("--no-session-persistence")
        .arg("--effort")
        .arg(map_claude_reasoning(reasoning));

    let result =
        run_command_with_stdin(&mut command, "Claude CLI", prompt_payload).and_then(|output| {
            if !output.status.success() {
                return Err(format_process_failure("Claude CLI", &output));
            }

            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        });

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

fn create_spec_generation_temp_dir(prefix: &str) -> Result<PathBuf, String> {
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

fn run_command_with_stdin(
    command: &mut Command,
    display_name: &str,
    stdin_payload: &str,
) -> Result<std::process::Output, String> {
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

    child
        .wait_with_output()
        .map_err(|error| format!("{display_name} exited unexpectedly: {error}"))
}

fn format_process_failure(display_name: &str, output: &std::process::Output) -> String {
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

fn map_codex_reasoning(reasoning: &str) -> &str {
    match reasoning {
        "max" => "xhigh",
        "high" => "high",
        "low" => "low",
        _ => "medium",
    }
}

fn map_claude_reasoning(reasoning: &str) -> &str {
    match reasoning {
        "max" => "high",
        "high" => "high",
        "low" => "low",
        _ => "medium",
    }
}

fn strip_wrapping_code_fence(content: &str) -> String {
    let trimmed = content.trim();

    if !trimmed.starts_with("```") {
        return trimmed.to_string();
    }

    let mut lines = trimmed.lines();
    let Some(first_line) = lines.next() else {
        return String::new();
    };

    if !first_line.trim_start().starts_with("```") {
        return trimmed.to_string();
    }

    let remaining_lines = lines.collect::<Vec<_>>();

    if remaining_lines
        .last()
        .map(|line| !line.trim_start().starts_with("```"))
        .unwrap_or(true)
    {
        return trimmed.to_string();
    }

    remaining_lines[..remaining_lines.len().saturating_sub(1)].join("\n")
}

fn run_simulated_agent(
    app: AppHandle,
    runtime: Arc<ExecutionRuntime>,
    run_id: u64,
    spec_payload: String,
    mode: String,
    model: String,
    reasoning: String,
) {
    let heading_count = spec_payload
        .lines()
        .filter(|line| line.trim_start().starts_with('#'))
        .count();
    let steps = build_simulated_steps(heading_count, &mode, &model, &reasoning);
    emit_state(&app, "executing", Some("Pre-flight Check"), None, None);

    for step in steps {
        match stop_state(&runtime, run_id) {
            StopState::Continue => {}
            StopState::StopRequested => {
                emit_line(
                    &app,
                    "Execution interrupted before the next step could run.",
                );
                emit_state(
                    &app,
                    "halted",
                    Some(step.milestone),
                    None,
                    Some("Execution interrupted by the operator."),
                );
                return;
            }
            StopState::Replaced => return,
        }

        thread::sleep(Duration::from_millis(step.delay_ms));
        match stop_state(&runtime, run_id) {
            StopState::Continue => {}
            StopState::StopRequested => {
                emit_line(
                    &app,
                    "Execution interrupted before the next step could run.",
                );
                emit_state(
                    &app,
                    "halted",
                    Some(step.milestone),
                    None,
                    Some("Execution interrupted by the operator."),
                );
                return;
            }
            StopState::Replaced => return,
        }
        emit_state(&app, "executing", Some(step.milestone), None, None);
        emit_line(&app, &step.line);

        if step.gate {
            let summary = if mode == "stepped" {
                "Stepped approval required before the next write action."
            } else {
                "Milestone boundary reached. Review the diff before execution resumes."
            };

            match wait_for_approval(&app, &runtime, run_id, step.milestone, summary) {
                Ok(ApprovalWaitOutcome::Approved) => {}
                Ok(ApprovalWaitOutcome::StopRequested) => {
                    emit_line(&app, "Execution interrupted during approval gate.");
                    emit_state(
                        &app,
                        "halted",
                        Some(step.milestone),
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
                        Some(step.milestone),
                        None,
                        Some("Approval synchronization failed."),
                    );
                    return;
                }
            }

            emit_line(&app, "Approval received. Resuming the agent loop.");
        }
    }

    if !matches!(stop_state(&runtime, run_id), StopState::Continue) {
        return;
    }

    emit_line(
        &app,
        "Execution complete. Final diff is ready for inspection.",
    );
    emit_state(
        &app,
        "completed",
        Some("Execution Complete"),
        Some(SAMPLE_DIFF),
        Some("Simulated agent execution completed successfully."),
    );
}

fn build_simulated_steps(
    heading_count: usize,
    mode: &str,
    model: &str,
    reasoning: &str,
) -> Vec<SimulatedStep> {
    let mut steps = vec![
        SimulatedStep {
            delay_ms: 450,
            line: format!(
                "Loaded approved specification with {heading_count} markdown headings into {model} using the {reasoning} reasoning profile."
            ),
            milestone: "Pre-flight Check",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 650,
            line: String::from(
                "Scanning CLI availability and staging the current repository diff.",
            ),
            milestone: "Pre-flight Check",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 750,
            line: String::from(
                "Mapping milestones for review UI, Zustand stores, and Tauri commands.",
            ),
            milestone: "Milestone Planning",
            gate: false,
        },
    ];

    if mode == "stepped" {
        steps.push(SimulatedStep {
            delay_ms: 650,
            line: String::from(
                "A write action is ready to execute against the approved specification.",
            ),
            milestone: "Stepped Approval",
            gate: true,
        });
    }

    steps.extend([
        SimulatedStep {
            delay_ms: 700,
            line: String::from(
                "Applying Dracula theme tokens and composing the review workspace shell.",
            ),
            milestone: "Compose Review Workspace",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 650,
            line: String::from(
                "Wiring project, settings, and agent stores into the execution dashboard.",
            ),
            milestone: "Compose Review Workspace",
            gate: false,
        },
    ]);

    if mode == "milestone" {
        steps.push(SimulatedStep {
            delay_ms: 650,
            line: String::from("The first milestone is complete and ready for diff review."),
            milestone: "Milestone Approval",
            gate: true,
        });
    }

    steps.extend([
        SimulatedStep {
            delay_ms: 650,
            line: String::from("Streaming terminal telemetry and enabling approval controls."),
            milestone: "Execution Dashboard",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 550,
            line: String::from("Packaging a final summary for IDE handoff."),
            milestone: "Execution Dashboard",
            gate: false,
        },
    ]);

    steps
}

fn wait_for_approval(
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

fn stop_state(runtime: &Arc<ExecutionRuntime>, run_id: u64) -> StopState {
    runtime
        .control
        .lock()
        .map(|control| {
            if control.stop_requested {
                StopState::StopRequested
            } else if control.run_id != run_id {
                StopState::Replaced
            } else {
                StopState::Continue
            }
        })
        .unwrap_or(StopState::StopRequested)
}

fn emit_line(app: &AppHandle, line: &str) {
    let _ = app.emit("cli-output", line.to_string());
}

fn emit_state(
    app: &AppHandle,
    status: &str,
    current_milestone: Option<&str>,
    pending_diff: Option<&str>,
    summary: Option<&str>,
) {
    let payload = AgentStateEvent {
        status: status.to_string(),
        current_milestone: current_milestone.map(ToOwned::to_owned),
        pending_diff: pending_diff.map(ToOwned::to_owned),
        summary: summary.map(ToOwned::to_owned),
    };
    let _ = app.emit("agent-state", payload);
}
