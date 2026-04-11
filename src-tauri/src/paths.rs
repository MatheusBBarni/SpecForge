use std::{
    fs,
    path::{Component, Path, PathBuf},
};

pub(crate) fn project_root() -> PathBuf {
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

pub(crate) fn resolve_override_path(path_value: &str) -> PathBuf {
    let candidate = PathBuf::from(path_value.trim());

    if candidate.is_absolute() {
        return candidate;
    }

    project_root().join(candidate)
}

pub(crate) fn normalize_relative_path(path_value: &str) -> Result<String, String> {
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

pub(crate) fn canonicalize_existing_path(path: &Path) -> std::io::Result<PathBuf> {
    fs::canonicalize(path)
}

pub(crate) fn resolve_relative_path_under_root(
    root: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let normalized_path = normalize_relative_path(relative_path)?;
    Ok(root.join(normalized_path))
}

pub(crate) fn resolve_project_document_path(path_value: &str) -> Result<PathBuf, String> {
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
