use crate::{
    models::WorkspaceDocument,
    paths::{
        canonicalize_existing_path, resolve_project_document_path, resolve_relative_path_under_root,
    },
};
use lopdf::Document;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[tauri::command]
pub(crate) fn parse_document(file_path: String) -> Result<String, String> {
    let resolved_path = resolve_project_document_path(&file_path)?;
    parse_supported_document(&resolved_path)
}

#[tauri::command]
pub(crate) fn pick_document() -> Result<Option<WorkspaceDocument>, String> {
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
pub(crate) fn save_workspace_document(
    workspace_root: String,
    output_path: String,
    content: String,
    field_name: String,
) -> Result<WorkspaceDocument, String> {
    write_generated_workspace_document(&workspace_root, &output_path, content, &field_name)
}

pub(crate) fn load_configured_workspace_document(
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

pub(crate) fn write_generated_workspace_document(
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

pub(crate) fn parse_workspace_document(path: &Path) -> Result<String, String> {
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

pub(crate) fn parse_supported_document(path: &Path) -> Result<String, String> {
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
