# Technical Specification: SpecForge

## 1. Architecture

SpecForge is a split desktop application:

* **React webview:** Owns routing, document editing, pane-local load actions, workspace presentation, settings UI, empty-state spec generation UX, and simulated execution UX.
* **Tauri/Rust backend:** Owns environment scanning, filesystem access, PDF parsing, workspace walking, git diff generation, native file dialogs, CLI-backed spec generation, and simulated agent coordination.

The webview must never execute shell commands or arbitrary file reads directly. All desktop-side operations go through `src/lib/runtime.ts` and Tauri commands in `src-tauri/src/lib.rs`.

## 2. Implemented Stack

### 2.1. Frontend

* React 19
* React Router 7
* Zustand
* HeroUI
* Tailwind v4
* TypeScript

### 2.2. Backend

* Tauri 2
* Rust 2024 edition
* `git2` for repository diffing
* `ignore` for `.gitignore`-aware workspace walking
* `lopdf` for PDF text extraction
* `rfd` for native file and folder pickers
* `which` for CLI discovery

## 3. Default State And Stores

### 3.1. Setup-first startup

On startup, the app routes to a project configuration screen. The user selects a workspace folder, and the desktop runtime either loads an existing `.specforge/settings.json` or prepares default project settings that can be saved into that file.

The review workspace no longer boots with bundled `docs/PRD.md` / `docs/SPEC.md` content by default.

### 3.2. Zustand stores

* **`useProjectStore`:** PRD/spec content, approval mode, selected model/reasoning, saved prompt templates, configured document paths, annotations, and open workspace file tabs.
* **`useAgentStore`:** Simulated run status, streamed output, current milestone, pending diff, and summary text.
* **`useSettingsStore`:** Theme, CLI override paths, last opened project path, environment scan results, and the current workspace tree entries.

## 4. Import And Workspace Flows

### 4.1. Desktop document import

The desktop runtime currently exposes two import paths:

* **User-facing import:** `pick_document()` opens a native file picker for `.md` and `.pdf`, parses the chosen file in Rust, and returns a `WorkspaceDocument`. The PRD and spec panes trigger this from their own header controls.
* **Reserved path import:** `parse_document(filePath)` still accepts only repository-relative paths that stay inside the project root, but it is not currently surfaced in the main review UI.

### 4.2. Project setup, workspace scan, and file opens

* `pick_project_folder()` opens a native folder picker, walks the chosen directory with `.gitignore` awareness, loads `.specforge/settings.json` when it exists, and returns a project-context payload for the setup flow.
* `load_project_context(folderPath)` reloads an already-known project folder and rehydrates the workspace plus saved project settings.
* `save_project_settings(folderPath, settings)` writes `.specforge/settings.json` inside the selected project.
* The backend stores the active workspace root and its relative-path-to-file map in shared state.
* `read_workspace_file(filePath)` now treats `filePath` as a **workspace-relative path only** and resolves it through the active workspace map.
* Files outside the active workspace must be rejected even if the frontend passes an absolute path or traversal sequence.
* When the configured PRD/spec files do not exist yet, the frontend clears the prior document content instead of leaving stale content visible.

### 4.4. Empty document and spec generation flow

* When `prdContent` is empty and the PRD pane is in preview mode, the left pane swaps to a dedicated PRD empty state while preserving preview/load/edit controls in the header.
* The PRD empty state includes a note field, shows the saved default PRD prompt from `.specforge/settings.json`, and explains that the note is appended after that prompt before generation.
* `generate_prd_document(...)` writes Markdown to the configured PRD path inside the workspace.
* When `specContent` is empty, the spec pane keeps the same preview/load/edit controls in its header area.
* If `specContent` is empty and `prdContent` is present, the spec pane swaps to a dedicated generation state with a prompt textarea and generate button.
* If both `prdContent` and `specContent` are empty in preview mode, the spec pane shows a blocked state that asks for a PRD before generation while still allowing `Load Spec`.
* The spec empty state shows the saved default spec prompt from `.specforge/settings.json` and explains that the note is appended after that prompt before generation.
* The generate actions send the current prompt template, note, selected model, selected reasoning profile, and configured output path through `src/lib/runtime.ts`.
* `generate_spec_document(...)` runs the selected Claude CLI or Codex CLI in non-interactive mode from a temporary folder and writes the returned markdown into the configured spec path inside the workspace.
* The saved spec document metadata is returned to the frontend so the spec pane reflects the on-disk path immediately; execution remains a separate simulated flow.

## 5. Tauri Command Surface

The current Tauri commands are:

* `run_environment_scan(claudePath?: string, codexPath?: string)`
* `parse_document(filePath: string)`
* `pick_document()`
* `pick_project_folder()`
* `load_project_context(folderPath: string)`
* `save_project_settings(folderPath: string, settings: ProjectSettings)`
* `open_workspace_folder()`
* `read_workspace_file(filePath: string)`
* `get_workspace_snapshot()`
* `git_get_diff()`
* `generate_prd_document(workspaceRoot: string, outputPath: string, promptTemplate: string, userPrompt: string, provider: string, model: string, reasoning: string, claudePath?: string, codexPath?: string)`
* `generate_spec_document(workspaceRoot: string, outputPath: string, prdContent: string, promptTemplate: string, userPrompt: string, provider: string, model: string, reasoning: string, claudePath?: string, codexPath?: string)`
* `spawn_cli_agent(specPayload: string, mode: string, model: string, reasoning: string)`
* `approve_action()`
* `kill_agent_process()`

Payloads crossing the Tauri boundary remain camelCase.

## 6. Diff And Execution Behavior

### 6.1. Git diff

`git_get_diff()` uses `git2` to render:

* staged changes (`HEAD -> index`)
* unstaged changes (`index -> worktree`)
* untracked file content

If the repository renders no pending diff, the app falls back to the bundled sample patch for demo purposes.

### 6.2. Execution runtime

The current execution runtime is **simulated**:

* `spawn_cli_agent()` starts a Rust thread that emits milestone and terminal events.
* `approve_action()` resumes a paused simulated gate.
* `kill_agent_process()` stops the active simulated run.
* Run IDs are tracked so stale runs do not leak output into newer runs.

This is a review-and-approval shell, not a real CLI orchestration engine yet.

The PRD/spec generation flows are separate from execution: they use the configured Claude/Codex CLI to draft markdown, save that markdown to the configured project-relative Markdown targets, and load the saved file into the review pane. They do not replace the simulated execution loop.

## 7. Environment And Settings

* CLI health is derived from executable probing, not just path existence.
* Manual override paths can be relative to the repo or absolute on disk.
* Theme preference plus CLI override paths are stored in browser local storage.
* The last opened project path is stored in browser local storage so the desktop app can restore project setup on the next launch.
* Project-specific model/reasoning defaults, prompt templates, and document paths are stored in `.specforge/settings.json` inside the selected workspace.
* The review sidebar now presents only agent configuration controls plus an MCP summary list derived from the current runtime/tool health.

## 8. Known Limits

* Opened workspace file tabs are editable in-memory only; there is no save-to-disk flow.
* The current project-setup flow expects the desktop runtime for real `.specforge/settings.json` persistence.
* The app presents model and approval controls, but the current run loop is simulated rather than connected to real workspace-mutating Claude/Codex execution.
