# Runtime And API Conventions

## Tauri Boundary
- React MUST call desktop functionality through `src/lib/runtime.ts`.
- Rust MUST expose snake_case Tauri commands and serialize payloads with camelCase fields for TypeScript.
- Shared payload changes require coordinated edits in:
  - `src-tauri/src/lib.rs`
  - `src/lib/runtime.ts`
  - `src/types.ts`

## Command Inventory
- `run_environment_scan` reports Cursor key availability and Git health.
- `get_cursor_api_key`, `save_cursor_api_key`, and `delete_cursor_api_key` use the OS credential store. Cursor keys are never written to `.specforge/settings.json`.
- `parse_document` reads Markdown directly and extracts text from PDFs.
- `open_workspace_folder` and `read_workspace_file` back the workspace import flow.
- `save_workspace_document` validates and writes generated PRD/spec Markdown inside the selected workspace.
- `get_workspace_snapshot` returns a shallow repo snapshot for diagnostics.
- `git_get_diff` returns the real working diff or a sample diff when empty.
- `spawn_cli_agent`, `approve_action`, and `kill_agent_process` drive the legacy simulated execution loop.

## Workspace Rules
- Imported workspace paths are normalized to forward slashes before they reach the webview.
- `.gitignore` is part of the workspace contract. Both the Rust walker and browser file import flow preserve that behavior.
- Only openable text/code files should be loaded into editor tabs. Binary assets stay out of the editor surface.

## UX Contracts
- `stepped` and `milestone` modes both require a visible diff and an interrupt path.
- `god_mode` is allowed in the UI, but the review/execution shell still needs status, diff, and halt surfaces.
- Browser mode is a fallback/demo path. It is allowed to show sample data, but production desktop data access must use the Rust backend.
