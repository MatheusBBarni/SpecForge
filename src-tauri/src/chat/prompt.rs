use crate::{
    documents::parse_workspace_document,
    models::ChatSessionSnapshot,
    paths::resolve_relative_path_under_root,
    state::WorkspaceContext,
};

use super::execution::ChatExecutionPhase;

pub(super) const CAVEMAN_PREAMBLE: &str =
    "Default response style: caveman. Keep prose terse and direct while leaving code blocks, commands, and diffs fully normal.";

pub(super) fn build_context_blocks(
    workspace: &WorkspaceContext,
    snapshot: &ChatSessionSnapshot,
) -> Result<Vec<(String, String)>, String> {
    let mut blocks = Vec::new();

    for item in &snapshot.context_items {
        let content = match item.kind.as_str() {
            "workspace_summary" => build_workspace_summary(workspace),
            _ => {
                let Some(path) = item.path.as_deref() else {
                    continue;
                };
                let resolved_path = resolve_relative_path_under_root(&workspace.root, path)?;

                if !resolved_path.exists() {
                    format!("Missing file at {path}.")
                } else {
                    parse_workspace_document(&resolved_path)?
                }
            }
        };

        if content.trim().is_empty() {
            continue;
        }

        blocks.push((item.label.clone(), content));
    }

    Ok(blocks)
}

pub(super) fn build_chat_prompt(
    snapshot: &ChatSessionSnapshot,
    context_blocks: &[(String, String)],
    user_message: &str,
    phase: ChatExecutionPhase,
) -> String {
    let mut prompt = String::new();
    prompt.push_str(CAVEMAN_PREAMBLE);
    prompt.push_str("\n\n");
    prompt.push_str(
        "You are SpecForge Chat, a desktop coding assistant operating on a project-scoped topic.\n",
    );
    prompt.push_str(
        "Keep responses direct. Preserve technical accuracy. Use the attached project context.\n",
    );
    prompt.push_str("Current topic: ");
    prompt.push_str(&snapshot.title);
    prompt.push_str("\nAutonomy mode: ");
    prompt.push_str(&snapshot.autonomy_mode.to_string());
    prompt.push_str("\nExecution phase: ");
    prompt.push_str(phase.label());
    prompt.push('\n');
    prompt.push_str(phase.instructions());

    if !context_blocks.is_empty() {
        prompt.push_str("\n\nAttached context:\n");

        for (label, content) in context_blocks {
            prompt.push_str("\n### ");
            prompt.push_str(label);
            prompt.push('\n');
            prompt.push_str(content.trim());
            prompt.push('\n');
        }
    }

    if !snapshot.messages.is_empty() {
        prompt.push_str("\nConversation so far:\n");

        for message in &snapshot.messages {
            prompt.push_str("\n");
            prompt.push_str(message.role.display_label());
            prompt.push_str(": ");
            prompt.push_str(message.content.trim());
            prompt.push('\n');
        }
    } else {
        prompt.push_str("\nConversation so far:\n\nNo prior turns yet.\n");
    }

    prompt.push_str("\n--- BEGIN USER REQUEST ---\n");
    prompt.push_str(user_message.trim());
    prompt.push_str("\n--- END USER REQUEST ---\n");
    prompt
}

pub(super) fn build_workspace_summary(workspace: &WorkspaceContext) -> String {
    let mut paths = workspace.files.keys().cloned().collect::<Vec<_>>();
    paths.sort();

    if paths.is_empty() {
        return String::from("No workspace files were discovered for this project.");
    }

    let mut summary = String::from("Workspace files:\n");

    for path in paths.iter().take(180) {
        summary.push_str("- ");
        summary.push_str(path);
        summary.push('\n');
    }

    if paths.len() > 180 {
        summary.push_str(&format!(
            "- ... and {} more files not shown in this summary.\n",
            paths.len() - 180
        ));
    }

    summary
}
