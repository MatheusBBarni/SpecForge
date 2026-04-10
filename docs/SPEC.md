# Technical Specification: SpecForge

## 1. Architecture

SpecForge is a split desktop application:

* **React webview:** Owns routing, document editing, workspace presentation, settings UI, empty-state spec generation UX, and simulated execution UX.
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

### 3.1. Bundled review docs

On startup, the app loads:

* `docs/PRD.md`
* `docs/SPEC.md`

These bundled documents are the default contents of the PRD and spec panes until the user imports replacements or opens a workspace that clears one of those documents.

### 3.2. Zustand stores

* **`useProjectStore`:** PRD/spec content, approval mode, selected model, selected range, annotations, and open workspace file tabs.
* **`useAgentStore`:** Simulated run status, streamed output, current milestone, pending diff, and summary text.
* **`useSettingsStore`:** Theme, CLI override paths, environment scan results, and the current workspace tree entries.

## 4. Import And Workspace Flows

### 4.1. Desktop document import

The desktop runtime supports two import paths:

* **Project-relative path import:** `parse_document(filePath)` accepts only repository-relative paths that stay inside the project root.
* **Native picker import:** `pick_document()` opens a native file picker for `.md` and `.pdf`, parses the chosen file in Rust, and returns a `WorkspaceDocument`.

### 4.2. Browser import fallback

Browser mode keeps a file-input fallback:

* Direct document import supports **Markdown only**.
* Browser-side folder import can discover PRD/spec matches, but PDF parsing is intentionally unavailable there.

### 4.3. Workspace scan and file opens

* `open_workspace_folder()` opens a native folder picker, walks the chosen directory with `.gitignore` awareness, and returns workspace entries plus detected PRD/spec documents.
* The backend stores the active workspace root and its relative-path-to-file map in shared state.
* `read_workspace_file(filePath)` now treats `filePath` as a **workspace-relative path only** and resolves it through the active workspace map.
* Files outside the active workspace must be rejected even if the frontend passes an absolute path or traversal sequence.
* When a scanned workspace does not contain `PRD.md`/`PRD.pdf` or `spec.md`/`spec.pdf`, the frontend must clear the prior document content instead of leaving stale content visible.

### 4.4. Empty-spec generation flow

* When `specContent` is empty, the spec pane swaps to a dedicated empty state with a prompt textarea and generate button.
* The generate action sends the current PRD, the user's note, the selected model, and the selected reasoning profile through `src/lib/runtime.ts`.
* `generate_spec_document(...)` runs the selected Claude CLI or Codex CLI in non-interactive mode from a temporary folder and returns markdown only.
* Generated output is loaded back into the spec pane as unsaved `spec.md` content; execution remains a separate simulated flow.

### 4.4. Browser `.gitignore` behavior

Browser folder imports normalize root-prefixed paths and apply root plus nested `.gitignore` rules before building the workspace tree.

## 5. Tauri Command Surface

The current Tauri commands are:

* `run_environment_scan(claudePath?: string, codexPath?: string)`
* `parse_document(filePath: string)`
* `pick_document()`
* `open_workspace_folder()`
* `read_workspace_file(filePath: string)`
* `get_workspace_snapshot()`
* `git_get_diff()`
* `generate_spec_document(prdContent: string, userPrompt: string, provider: string, model: string, reasoning: string, claudePath?: string, codexPath?: string)`
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

The spec generation flow is separate: it uses the configured Claude/Codex CLI to return markdown for the spec pane, but it does not mutate workspace files or replace the simulated execution loop.

## 7. Environment And Settings

* CLI health is derived from executable probing, not just path existence.
* Manual override paths can be relative to the repo or absolute on disk.
* Theme preference is stored in browser local storage and resolved into Dracula, Light, or System behavior in the webview.

## 8. Known Limits

* Opened workspace file tabs are editable in-memory only; there is no save-to-disk flow.
* Browser mode does not parse PDFs.
* Browser mode does not support AI-backed spec generation.
* The app presents model and approval controls, but the current run loop is simulated rather than connected to real workspace-mutating Claude/Codex execution.
