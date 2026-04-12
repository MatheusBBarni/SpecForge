# Product Requirements Document: SpecForge

## 1. Product Overview

**SpecForge** is a setup-first desktop workspace for project-scoped agent chat. After a project is configured, the primary surface is a multi-topic chat workspace where each topic keeps its own transcript, context attachments, runtime state, approvals, and diff history.

The product combines four responsibilities in one desktop shell:

* project setup and saved workspace defaults
* multi-session agent chat with real CLI-backed turns
* PRD/spec review and editing
* approval-aware diff and terminal visibility

## 2. Target Audience

* **Solo engineers:** Wanting a desktop-native agent workspace with multiple project topics instead of a single disposable prompt thread.
* **Technical leads and PMs:** Wanting to keep PRD/spec work visible while letting implementation happen in isolated chat topics.
* **AI-assisted developers:** Wanting Codex CLI or Claude Code orchestration with per-topic context and explicit approval controls.

## 3. Primary User Flow

1. **Open setup:** The app starts on configuration until a workspace is chosen and `.specforge/settings.json` exists.
2. **Choose the project folder:** SpecForge scans the workspace, restores saved project settings, and restores the most recent chat topic when available.
3. **Save configuration:** The user sets model/reasoning defaults, PRD/spec paths, and optional supporting documents, then continues into `/chat`.
4. **Land in chat:** `/chat` is the primary post-setup workspace. If the project has no saved topics yet, SpecForge creates the first one automatically.
5. **Work inside topics:** Each topic keeps isolated transcript, isolated selected context, isolated runtime state, and isolated approval/diff history.
6. **Use seeded context:** New topics start with PRD, SPEC, configured supporting docs, and a workspace summary already attached.
7. **Attach more files explicitly:** Additional workspace files can be attached per topic and never bleed into other topics.
8. **Review output:** The `/review` screen remains available for PRD/spec/file editing, while its execute view mirrors the active chat topic instead of launching a separate run.

## 4. Functional Requirements

### 4.1. Project Setup And Persistence

* **Project-scoped settings:** Saving setup must create or update `.specforge/settings.json` inside the selected workspace.
* **Project-scoped sessions:** Chat metadata must be stored in `.specforge/sessions/index.json`.
* **Per-topic snapshots:** Each topic must be persisted in `.specforge/sessions/<sessionId>.json`.
* **Last-active restore:** Reopening the app should restore the last active project and the last active topic when available.

### 4.2. Chat Workspace

* **Primary route:** `/chat` must be the default destination after setup or project restore.
* **Three-zone desktop layout:** The chat screen must provide a topic list, transcript/composer workspace, and context/artifacts panel.
* **Topic management:** Users must be able to create, search, select, rename, and delete topics.
* **Per-topic isolation:** Messages, context items, runtime state, pending approvals, pending diff, and terminal output must remain scoped to a single topic.
* **Per-topic drafts:** Composer drafts must be preserved per topic while switching between topics.
* **Context seeding:** New topics must start with PRD, SPEC, supporting docs, and a workspace tree summary.
* **Explicit file attachment:** Workspace files can be attached manually from the chat UI and only affect the active topic.
* **Inline controls:** Send, approve, and stop actions must live directly in the chat composer area rather than in modal flows.

### 4.3. Runtime And Approval Semantics

* **Real CLI-backed turns:** Chat turns must run through the desktop backend using headless Codex CLI or Claude Code invocations.
* **Stepped mode:** The first pass must be proposal-first or read-only, then require explicit approval before a write-capable rerun.
* **Milestone mode:** One assistant turn may make changes, but it must pause on the resulting real git diff before the next turn.
* **God mode:** The assistant may complete the turn without an approval pause while still surfacing output and diff history afterward.
* **Session-scoped stop behavior:** Stop requests must only affect the active topic run and preserve existing emergency-stop semantics.
* **Visible artifacts:** Terminal output and diff history must remain visible for each topic after the run.

### 4.4. Caveman Requirement

* **Always-on mode:** Chat must always apply Caveman-style response guidance automatically for every topic.
* **No chat-entry verification:** Entering `/chat` must not trigger a blocking install or verification step.
* **Built-in prompt behavior:** The Caveman behavior must be injected by SpecForge's own system prompt so users do not need to spend turn tokens enabling it.
* **Never gate navigation or settings:** Caveman activation must not stop topic switching, route changes, or model/autonomy edits.

### 4.5. Review And Settings

* **Review remains available:** `/review` must still support PRD/spec/file editing and document generation.
* **Read-only execution mirror:** The execute panel in review must reflect the active chat topic runtime and diff, but must not start, approve, or stop a separate execution engine.
* **Settings remain project-scoped:** Model/reasoning defaults, prompt templates, document paths, and supporting docs remain editable from setup and settings.

## 5. Non-Goals

* Multi-user collaboration or cloud sync
* Browser-only chat execution without the desktop runtime
* Automatic saving of edited workspace file tabs back to disk
* OpenCode runtime integration as a provider; it is only a UX reference for this release
