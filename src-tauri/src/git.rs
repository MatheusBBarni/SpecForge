use git2::{DiffFormat, DiffOptions, Repository};

use crate::{constants::SAMPLE_DIFF, paths::project_root};

#[tauri::command]
pub(crate) fn git_get_diff() -> Result<String, String> {
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
