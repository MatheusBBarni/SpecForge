# Technical Specification: SpecForge

## 1. Architecture

SpecForge is a split desktop application:

* **React webview:** Owns routing, topic/session management UI, PRD/spec editing, workspace browsing, settings, passive rendering of runtime output, and PRD/spec prompt orchestration.
* **Bun TypeScript runner:** Owns `@cursor/sdk` execution for PRD/spec generation because the SDK local runtime requires a Node-compatible process and cannot be bundled into the browser webview.
* **Tauri/Rust backend:** Owns filesystem access, workspace scanning, session persistence, git diffing, native dialogs, PDF parsing, OS credential storage for the Cursor API key, generated document saving, Bun runner delegation, and chat event streaming.

The webview never writes workspace files directly. All desktop data access continues to flow through `src/lib/runtime.ts` into Tauri commands exposed from `src-tauri/src/lib.rs`. PRD/spec model calls run through `src/cursorAgentRunner.ts` using Bun and `@cursor/sdk`; Rust does not implement provider-specific prompt logic.

## 2. Routes

* `/` is the project configuration flow.
* `/review` is the primary post-setup document and file editing workspace.
* `/chat` is the secondary agent conversation workspace.
* `/settings` holds project-scoped and local runtime configuration.

After setup completion, the app routes to `/review` by default. Chat remains available from the sidebar below Review.

## 3. State Model

### 3.1. Frontend stores

* **`useProjectStore`:** PRD/spec content, document paths, editable agent descriptions, selected project defaults, annotations, and open workspace file tabs.
* **`useChatStore`:** Chat session summaries, `activeSessionId`, loaded per-topic snapshots, per-topic drafts, and Caveman readiness state.
* **`useAgentStore`:** A lightweight runtime mirror used by review and shared execution UI. In chat-first flows it mirrors the active chat topic runtime rather than owning an independent executor.
* **`useSettingsStore`:** Theme, in-memory Cursor API key input, last opened project path, environment scan results, and workspace entries.

### 3.2. Persistence

Project settings live in:

* `.specforge/settings.json`

The Cursor API key is not part of project settings. It is stored by Rust through the OS credential store and exposed to the frontend only when Cursor SDK generation needs it.

Chat data lives in:

* `.specforge/sessions/index.json`
* `.specforge/sessions/<sessionId>.json`

`index.json` stores topic summaries plus `lastActiveSessionId`. Each session snapshot stores:

* `id`
* `title`
* `createdAt`
* `updatedAt`
* `selectedModel`
* `selectedReasoning`
* `autonomyMode`
* `status`
* `contextItems`
* `messages`
* `runtime`
* `lastError`

## 4. Chat Session Behavior

### 4.1. Default context

When a new topic is created, the backend seeds the session with:

* the configured PRD document
* the configured SPEC document
* any configured supporting documents
* a workspace tree summary

Additional workspace files are attached explicitly per topic from the chat UI. Session context does not bleed across topics.

### 4.2. Runtime orchestration

Chat turns are still executed in Rust as the legacy headless CLI path:

* **Codex provider:** mapped to suggest, auto-edit, or full-auto style permissions depending on the selected autonomy mode
* **Claude provider:** mapped to default, accept-edits, or bypass-permissions style permissions

Rust keeps a session-keyed runtime map so the following remain isolated by `sessionId`:

* current status
* terminal output
* pending approval state
* pending diff
* stop requests

### 4.3. Approval semantics

* **`stepped`:** first run in proposal/read-only mode, then require explicit approval before the write-capable pass
* **`milestone`:** run one assistant turn, capture the real git diff, and pause before the next turn
* **`god_mode`:** allow a full-permission turn without an approval pause

Review mode does not expose these controls directly; it only mirrors the active topic state.

## 5. PRD/Spec Generation

PRD/spec generation now runs in the TypeScript layer with `@cursor/sdk`, isolated in a Bun runner so Vite does not bundle Node-only SDK dependencies into the webview.

* `src/lib/cursorAgentRuntime.ts` composes Cursor prompts and invokes the desktop Cursor runner command.
* `src/cursorAgentRunner.ts` creates the local Cursor SDK agent, streams run events, waits for completion, and extracts final Markdown.
* `src/hooks/useDocumentHandlers.ts` keeps the existing PRD/spec button and prompt flow, but fetches the Cursor API key from Rust before invoking the Cursor generation path.
* Rust does not call Codex or Claude ACP for PRD/spec generation.
* Rust launches the Bun runner, validates the workspace root, and parses the runner's structured JSON-line output.
* Rust validates the workspace root and Markdown output path through `save_workspace_document`, strips wrapping Markdown code fences, creates parent directories, and writes the generated document.
* The PRD agent receives the editable PRD agent description plus the user's PRD prompt.
* The spec agent receives the editable spec agent description, the user's spec prompt, and the selected PRD content.
* The execution agent description is persisted in project settings for the upcoming execution migration.

## 6. Tauri Command Surface

The desktop runtime currently exposes:

* `run_environment_scan`
* `run_cursor_agent_prompt`
* `get_cursor_api_key`
* `save_cursor_api_key`
* `delete_cursor_api_key`
* `pick_document`
* `pick_project_folder`
* `load_project_context`
* `save_project_settings`
* `read_workspace_file`
* `get_workspace_snapshot`
* `git_get_diff`
* `save_workspace_document`
* `create_chat_session`
* `load_chat_session`
* `save_chat_session`
* `rename_chat_session`
* `delete_chat_session`
* `send_chat_message`
* `approve_chat_session`
* `stop_chat_session`

Chat runtime updates are streamed through a typed `chat-session-event` payload carrying the session id plus the current session snapshot or summary update.

## 7. Caveman Integration

SpecForge now treats Caveman as a built-in chat response mode instead of a runtime-installed dependency.

Each outgoing chat turn prepends a compact Caveman-style instruction before the normal SpecForge system prompt, so the behavior stays active without making the user spend tokens enabling it manually.

There is no chat-entry verification or installation path tied to navigation, and Caveman state must never block topic changes, route changes, or session configuration edits.

## 8. Review Workspace

The main sidebar follows the full-height review-screen pattern from the Stitch design: fixed-width desktop navigation, Projects, Review, Chat, and Settings ordering, Dracula Enterprise colors, and Review above Chat. The review screen still provides:

* PRD/spec editing
* workspace file browsing
* PRD/spec generation

Its execute panel is now a read-only mirror of the active chat topic:

* terminal output mirrors the active topic runtime
* diff output mirrors the active topic pending diff
* approval and stop controls are hidden

This prevents review from launching a second execution engine that could diverge from chat state.

## 9. Setup Clone Placeholder

The setup screen includes a presentational Git clone card beside the local folder picker. The repository URL input and Clone button are disabled and must not call Git, Tauri commands, filesystem writes, or network operations until a dedicated clone implementation is added.

## 10. Known Limits

* Opened workspace file tabs remain in-memory only; there is still no save-to-disk flow.
* The desktop runtime is required for real project persistence, chat sessions, and CLI-backed turns.
* Chat execution still uses the legacy Codex CLI and Claude Code path; the current Cursor SDK refactor is limited to PRD/spec generation.
* **Planned dependencies not yet installed:** `react-markdown`, `react-syntax-highlighter`, and `tauri-plugin-store` are referenced in design documents but are not currently in `package.json` or `Cargo.toml`. Features that depend on them (rich markdown rendering, syntax-highlighted code blocks, native key-value persistence) are aspirational and should not be assumed functional until the dependencies are added.
