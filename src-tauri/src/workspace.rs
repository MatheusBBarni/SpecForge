use crate::{
    documents::parse_workspace_document,
    models::{WorkspaceDocument, WorkspaceEntry, WorkspaceScanResult},
    paths::{canonicalize_existing_path, normalize_relative_path, project_root},
    state::{ScannedWorkspace, SharedState, WorkspaceContext},
};
use ignore::WalkBuilder;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
use tauri::State;

#[tauri::command]
pub(crate) fn open_workspace_folder(
    state: State<SharedState>,
) -> Result<Option<WorkspaceScanResult>, String> {
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
pub(crate) fn read_workspace_file(
    state: State<SharedState>,
    file_path: String,
) -> Result<String, String> {
    let resolved_path = resolve_workspace_file_path(&state, &file_path)?;

    fs::read_to_string(&resolved_path).map_err(|error| {
        format!(
            "Unable to read workspace file {}: {error}",
            resolved_path.display()
        )
    })
}

#[tauri::command]
pub(crate) fn get_workspace_snapshot() -> Result<Vec<WorkspaceEntry>, String> {
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

pub(crate) fn scan_workspace_folder(root: &Path) -> Result<ScannedWorkspace, String> {
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

pub(crate) fn compare_workspace_entries(
    left: &WorkspaceEntry,
    right: &WorkspaceEntry,
) -> std::cmp::Ordering {
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

pub(crate) fn pick_workspace_document(
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

pub(crate) fn resolve_workspace_file_path(
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

pub(crate) fn relative_path_depth(path: &str) -> usize {
    path.split('/').count()
}
