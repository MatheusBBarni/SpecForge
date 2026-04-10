use git2::{DiffFormat, Repository};
use ignore::WalkBuilder;
use lopdf::Document;
use serde::Serialize;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Condvar, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
struct SharedState {
    runtime: Arc<ExecutionRuntime>,
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceScanResult {
    root_name: String,
    entries: Vec<WorkspaceEntry>,
    ignored_file_count: usize,
    file_paths: HashMap<String, String>,
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

const SAMPLE_DIFF: &str = r#"diff --git a/src/App.tsx b/src/App.tsx
index 0000000..forge42 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@
- Render placeholder starter card
+ Introduce PRD/spec review workspace with execution controls
+ Add Dracula-first theme tokens and persisted preferences
+ Surface CLI health, diff approvals, and terminal streaming"#;

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
    let resolved_path = resolve_path(&file_path);

    if !resolved_path.exists() {
        return Err(format!("Document not found: {}", resolved_path.display()));
    }

    match resolved_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_lowercase())
        .as_deref()
    {
        Some("md") => fs::read_to_string(&resolved_path)
            .map_err(|error| format!("Unable to read markdown document: {error}")),
        Some("pdf") => read_pdf_text(&resolved_path),
        _ => Err(String::from("Only .md and .pdf documents are supported.")),
    }
}

#[tauri::command]
fn open_workspace_folder() -> Result<Option<WorkspaceScanResult>, String> {
    let Some(folder_path) = rfd::FileDialog::new().pick_folder() else {
        return Ok(None);
    };

    scan_workspace_folder(&folder_path).map(Some)
}

#[tauri::command]
fn read_workspace_file(file_path: String) -> Result<String, String> {
    let resolved_path = resolve_path(&file_path);

    fs::read_to_string(&resolved_path)
        .map_err(|error| format!("Unable to read workspace file {}: {error}", resolved_path.display()))
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

fn scan_workspace_folder(root: &Path) -> Result<WorkspaceScanResult, String> {
    let root_name = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Workspace")
        .to_string();
    let mut directory_entries = HashMap::<String, WorkspaceEntry>::new();
    let mut file_entries = Vec::<WorkspaceEntry>::new();
    let mut file_paths = HashMap::<String, String>::new();
    let mut file_documents = Vec::<(String, PathBuf)>::new();

    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .build();

    for item in walker {
        let entry = match item {
            Ok(entry) => entry,
            Err(error) => {
                return Err(format!("Unable to walk workspace folder {}: {error}", root.display()));
            }
        };
        let path = entry.path();

        if path == root {
            continue;
        }

        let relative_path = path
            .strip_prefix(root)
            .map_err(|error| format!("Unable to normalize workspace path {}: {error}", path.display()))?
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

        for (index, segment) in relative_path.split('/').collect::<Vec<_>>().iter().enumerate() {
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
        file_paths.insert(relative_path.clone(), path.display().to_string());
        file_documents.push((relative_path, path.to_path_buf()));
    }

    let mut entries = directory_entries
        .into_values()
        .chain(file_entries)
        .collect::<Vec<_>>();
    entries.sort_by(compare_workspace_entries);

    let prd_document = pick_workspace_document(&file_documents, &["prd.md", "prd.pdf"])?;
    let spec_document = pick_workspace_document(&file_documents, &["spec.md", "spec.pdf"])?;

    Ok(WorkspaceScanResult {
        root_name,
        entries,
        ignored_file_count: 0,
        file_paths,
        prd_document,
        spec_document,
    })
}

#[tauri::command]
fn git_get_diff() -> Result<String, String> {
    let repository = Repository::discover(project_root())
        .map_err(|error| format!("Unable to discover git repository: {error}"))?;
    let diff = repository
        .diff_index_to_workdir(None, None)
        .map_err(|error| format!("Unable to inspect git diff: {error}"))?;
    let mut rendered = String::new();

    diff.print(DiffFormat::Patch, |_delta, _hunk, line| {
        let text = String::from_utf8_lossy(line.content());
        rendered.push_str(&text);
        true
    })
    .map_err(|error| format!("Unable to render diff: {error}"))?;

    if rendered.trim().is_empty() {
        return Ok(SAMPLE_DIFF.to_string());
    }

    Ok(rendered)
}

#[tauri::command]
fn spawn_cli_agent(
    app: AppHandle,
    state: State<SharedState>,
    spec_payload: String,
    mode: String,
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
        run_simulated_agent(app, runtime, run_id, spec_payload, mode);
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
            open_workspace_folder,
            read_workspace_file,
            get_workspace_snapshot,
            git_get_diff,
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
            let candidate = resolve_path(value);
            candidate.exists().then_some(candidate)
        })
        .or_else(|| which::which(binary_name).ok());

    if let Some(path) = resolved_path {
        let version_detail = Command::new(&path)
            .arg("--version")
            .output()
            .ok()
            .and_then(|output| {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

                if !stdout.is_empty() {
                    Some(stdout)
                } else if !stderr.is_empty() {
                    Some(stderr)
                } else {
                    None
                }
            })
            .unwrap_or_else(|| String::from("Binary detected. Version probe returned no output."));

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
            let right_is_directory =
                index < right_segments.len() - 1 || right.kind == "directory";

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

    document
        .extract_text(&page_numbers)
        .map_err(|error| format!("Unable to extract PDF text from {}: {error}", path.display()))
}

fn parse_workspace_document(path: &Path) -> Result<String, String> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("pdf") => read_pdf_text(path),
        _ => fs::read_to_string(path)
            .map_err(|error| format!("Unable to read workspace document {}: {error}", path.display())),
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

fn resolve_path(path_value: &str) -> PathBuf {
    let candidate = PathBuf::from(path_value.trim());

    if candidate.is_absolute() {
        return candidate;
    }

    project_root().join(candidate)
}

fn run_simulated_agent(
    app: AppHandle,
    runtime: Arc<ExecutionRuntime>,
    run_id: u64,
    spec_payload: String,
    mode: String,
) {
    let heading_count = spec_payload
        .lines()
        .filter(|line| line.trim_start().starts_with('#'))
        .count();
    let steps = build_simulated_steps(heading_count, &mode);
    emit_state(&app, "executing", Some("Pre-flight Check"), None, None);

    for step in steps {
        if should_stop(&runtime, run_id) {
            emit_line(&app, "Execution interrupted before the next step could run.");
            emit_state(
                &app,
                "halted",
                Some(step.milestone),
                None,
                Some("Execution interrupted by the operator."),
            );
            return;
        }

        thread::sleep(Duration::from_millis(step.delay_ms));
        emit_state(&app, "executing", Some(step.milestone), None, None);
        emit_line(&app, &step.line);

        if step.gate {
            let summary = if mode == "stepped" {
                "Stepped approval required before the next write action."
            } else {
                "Milestone boundary reached. Review the diff before execution resumes."
            };

            if let Err(message) = wait_for_approval(&app, &runtime, run_id, step.milestone, summary) {
                emit_line(&app, &message);
                emit_state(
                    &app,
                    "halted",
                    Some(step.milestone),
                    None,
                    Some("Execution interrupted by the operator."),
                );
                return;
            }

            emit_line(&app, "Approval received. Resuming the agent loop.");
        }
    }

    emit_line(&app, "Execution complete. Final diff is ready for inspection.");
    emit_state(
        &app,
        "completed",
        Some("Execution Complete"),
        Some(SAMPLE_DIFF),
        Some("Simulated agent execution completed successfully."),
    );
}

fn build_simulated_steps(heading_count: usize, mode: &str) -> Vec<SimulatedStep> {
    let mut steps = vec![
        SimulatedStep {
            delay_ms: 450,
            line: format!(
                "Loaded approved specification with {heading_count} markdown headings into the planner."
            ),
            milestone: "Pre-flight Check",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 650,
            line: String::from("Scanning CLI availability and staging the current repository diff."),
            milestone: "Pre-flight Check",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 750,
            line: String::from("Mapping milestones for review UI, Zustand stores, and Tauri commands."),
            milestone: "Milestone Planning",
            gate: false,
        },
    ];

    if mode == "stepped" {
        steps.push(SimulatedStep {
            delay_ms: 650,
            line: String::from("A write action is ready to execute against the approved specification."),
            milestone: "Stepped Approval",
            gate: true,
        });
    }

    steps.extend([
        SimulatedStep {
            delay_ms: 700,
            line: String::from("Applying Dracula theme tokens and composing the review workspace shell."),
            milestone: "Compose Review Workspace",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 650,
            line: String::from("Wiring project, settings, and agent stores into the execution dashboard."),
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
) -> Result<(), String> {
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

    if control.stop_requested || control.run_id != run_id {
        return Err(String::from("Execution interrupted during approval gate."));
    }

    Ok(())
}

fn should_stop(runtime: &Arc<ExecutionRuntime>, run_id: u64) -> bool {
    runtime
        .control
        .lock()
        .map(|control| control.stop_requested || control.run_id != run_id)
        .unwrap_or(true)
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
