# Technical Specification: SpecForge

## 1. Architecture

SpecForge is a split desktop application:

* **React webview:** Owns routing, topic/session management UI, PRD/spec editing, workspace browsing, settings, and passive rendering of runtime output.
* **Tauri/Rust backend:** Owns filesystem access, workspace scanning, session persistence, git diffing, native dialogs, PDF parsing, CLI process execution, Caveman verification, and chat event streaming.

The webview never executes shell commands or writes workspace files directly. All desktop work continues to flow through `src/lib/runtime.ts` into Tauri commands exposed from `src-tauri/src/lib.rs`.

## 2. Routes

* `/` is the project configuration flow.
* `/chat` is the primary post-setup workspace.
* `/review` is the document and file editing workspace.
* `/settings` holds project-scoped and local runtime configuration.

When a saved project is restored, the app routes to `/chat` by default.

## 3. State Model

### 3.1. Frontend stores

* **`useProjectStore`:** PRD/spec content, document paths, prompt templates, selected project defaults, annotations, and open workspace file tabs.
* **`useChatStore`:** Chat session summaries, `activeSessionId`, loaded per-topic snapshots, per-topic drafts, and Caveman readiness state.
* **`useAgentStore`:** A lightweight runtime mirror used by review and shared execution UI. In chat-first flows it mirrors the active chat topic runtime rather than owning an independent executor.
* **`useSettingsStore`:** Theme, CLI override paths, last opened project path, environment scan results, and workspace entries.

### 3.2. Persistence

Project settings live in:

* `.specforge/settings.json`

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

Chat turns are executed in Rust as headless CLI invocations:

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

## 5. Tauri Command Surface

The desktop runtime currently exposes:

* `run_environment_scan`
* `pick_document`
* `pick_project_folder`
* `load_project_context`
* `save_project_settings`
* `read_workspace_file`
* `get_workspace_snapshot`
* `git_get_diff`
* `generate_prd_document`
* `generate_spec_document`
* `create_chat_session`
* `load_chat_session`
* `save_chat_session`
* `rename_chat_session`
* `delete_chat_session`
* `send_chat_message`
* `approve_chat_session`
* `stop_chat_session`
* `ensure_caveman_skill`

Chat runtime updates are streamed through a typed `chat-session-event` payload carrying the session id plus the current session snapshot or summary update.

## 6. Caveman Integration

Entering `/chat` triggers backend verification of the Caveman skill. If it is missing, the backend attempts installation with:

* `npx skills add JuliusBrussee/caveman`

If verification or installation fails:

* the frontend stores a failed Caveman state in `useChatStore`
* the composer send action remains disabled
* the user sees a blocking but recoverable banner in chat

Each outgoing chat turn prepends a Caveman activation preamble before the normal SpecForge system prompt so the skill is active on every turn, not merely installed on disk.

## 7. Review Workspace

The review screen still provides:

* PRD/spec editing
* workspace file browsing
* PRD/spec generation

Its execute panel is now a read-only mirror of the active chat topic:

* terminal output mirrors the active topic runtime
* diff output mirrors the active topic pending diff
* approval and stop controls are hidden

This prevents review from launching a second execution engine that could diverge from chat state.

## 8. Known Limits

* Opened workspace file tabs remain in-memory only; there is still no save-to-disk flow.
* The desktop runtime is required for real project persistence, chat sessions, and CLI-backed turns.
* The provider set remains limited to Codex CLI and Claude Code for this version.
