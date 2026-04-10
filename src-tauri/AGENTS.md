# Rust Scope

## Commands
- `cargo check --manifest-path .\src-tauri\Cargo.toml`
- `cargo fmt --manifest-path .\src-tauri\Cargo.toml`

## Always
- MUST keep Tauri command names stable unless the frontend is updated in the same change.
- MUST preserve `#[serde(rename_all = "camelCase")]` on payloads that cross into TypeScript.
- MUST keep workspace walking `.gitignore`-aware through the `ignore` crate.
- MUST keep `project_root()` and `resolve_path()` working from both the repo root and `src-tauri/`.

## Ask First
- Ask before changing Tauri security settings, capabilities, bundle identifiers, or window constraints.
- Ask before replacing `git2`, `lopdf`, `ignore`, or the current document/CLI execution approach.

## Never
- NEVER move Rust-side file parsing, diffing, or process control into the webview.
- NEVER remove the simulated agent path without replacing the browser fallback UX.

## Landmines
- `git_get_diff()` intentionally returns a sample patch when the real diff is empty.
- `run_simulated_agent()` is a demo path, not a real CLI orchestration engine.
- `scan_workspace_folder()` and `pick_workspace_document()` normalize paths to forward slashes because the frontend expects that shape.
