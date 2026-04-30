# Product Requirements Document: SpecForge

## 1. Product Overview

**SpecForge** is a setup-first desktop workspace for spec-driven development. After a project is configured, the primary product flow helps users generate, review, and refine PRD and technical spec documents with Cursor SDK agents while keeping local project data under the desktop app's control.

The product combines five responsibilities in one desktop shell:

* project setup and saved workspace defaults
* Cursor SDK-backed PRD/spec generation
* PRD/spec review and editing
* secure local Cursor API key storage
* approval-aware diff and terminal visibility

## 2. Target Audience

* **Solo engineers:** Wanting a desktop-native workspace for turning rough product intent into usable PRD/spec artifacts.
* **Technical leads and PMs:** Wanting editable agent descriptions and repeatable PRD/spec generation without leaking secrets into project settings.
* **AI-assisted developers:** Wanting Cursor SDK agents for product/spec planning while preserving local review, diff, and approval visibility.

## 3. Primary User Flow

1. **Open Projects:** The app starts on the Projects / Workspace Initialization screen until a workspace is chosen. The Projects screen is limited to workspace selection, recent projects, and the disabled clone placeholder.
2. **Choose the project folder:** SpecForge scans the workspace, creates `.specforge/settings.json` from defaults when it is missing, restores saved project settings, restores the most recent chat topic when available, and opens the review workspace.
3. **Review Settings when needed:** If default project settings were created, SpecForge prompts the user to open Settings. Cursor API key, model/reasoning defaults, editable PRD/spec/execution agent descriptions, PRD/spec paths, and optional supporting documents are configured from `/settings`.
4. **Connect Cursor:** The user saves a Cursor API key through the desktop runtime. The key is stored in the OS credential store and never in `.specforge/settings.json`.
5. **Refine or generate a PRD:** The user can run the built-in Grill PRD action to ask one focused follow-up question with a recommended answer, or generate the PRD directly. PRD generation sends the PRD agent description plus the user prompt to Cursor SDK, then asks Rust to save the generated Markdown.
6. **Refine or generate a spec:** The user can run the built-in Grill Spec action against the current PRD and spec brief to ask one focused follow-up question with a recommended answer, or generate the spec directly. Spec generation sends the spec agent description, user prompt, and chosen PRD content to Cursor SDK, then asks Rust to save the generated Markdown.
7. **Review output:** The `/review` screen remains available for PRD/spec/file editing and diff visibility.
8. **Continue in chat when needed:** `/chat` remains available below review in navigation, but chat execution is outside the current Cursor SDK refactor scope.

## 4. Functional Requirements

### 4.1. Project Setup And Persistence

* **Project-scoped settings:** Opening a workspace without `.specforge/settings.json` must create that file from default settings, and saving setup must update it inside the selected workspace.
* **Secret separation:** Cursor API keys must be stored through the OS credential store and must not be written to `.specforge/settings.json`.
* **Editable agent descriptions:** Settings must persist user-editable descriptions for PRD, spec, and execution agents.
* **Cursor defaults:** Model and reasoning defaults must use Cursor SDK-compatible options.
* **Project-scoped sessions:** Chat metadata must be stored in `.specforge/sessions/index.json`.
* **Per-topic snapshots:** Each topic must be persisted in `.specforge/sessions/<sessionId>.json`.
* **Last-active restore:** Reopening the app should restore the last active project and the last active topic when available.
* **Recent projects:** The Projects screen must show recently opened project folders from browser `localStorage` and allow reopening them through the desktop runtime. Reopening a project without `.specforge/settings.json` must create default settings and prompt the user to review Settings.
* **Git clone placeholder:** Setup may show a repository URL clone option as a disabled/presentational control. It must not invoke Git or write files until the desktop clone flow is implemented.

### 4.2. PRD And Spec Generation

* **Cursor SDK runtime:** PRD/spec generation must run through `@cursor/sdk` from the TypeScript side.
* **Rust desktop boundary:** Rust must not call Codex or Claude ACP for PRD/spec generation; it reads local inputs, stores secrets, delegates Cursor SDK execution to the Bun TypeScript runner, and saves generated documents.
* **Existing UX preservation:** The user flow for choosing a PRD and generating a spec must remain unchanged except for the underlying Cursor SDK runtime.
* **PRD agent:** PRD generation must send the editable PRD agent description and the user's PRD prompt.
* **Spec agent:** Spec generation must send the editable spec agent description, the user's spec prompt, and the selected PRD content.
* **Built-in Grill Me:** PRD and spec empty states must expose secondary Grill actions that run the same Cursor SDK model with SpecForge's built-in grill-me instruction, ask exactly one next question, include a recommended answer, and append the response back into the generation prompt for user editing.
* **Execution agent description:** Settings must expose the execution agent description now, even though execution migration is not part of this slice.

### 4.3. Chat Workspace

* **Secondary route:** `/chat` must remain available after setup, but review is the primary destination while document review is the active focus.
* **Three-zone desktop layout:** The chat screen must provide a topic list, transcript/composer workspace, and context/artifacts panel.
* **Topic management:** Users must be able to create, search, select, rename, and delete topics.
* **Per-topic isolation:** Messages, context items, runtime state, pending approvals, pending diff, and terminal output must remain scoped to a single topic.
* **Per-topic drafts:** Composer drafts must be preserved per topic while switching between topics.
* **Context seeding:** New topics must start with PRD, SPEC, supporting docs, and a workspace tree summary.
* **Explicit file attachment:** Workspace files can be attached manually from the chat UI and only affect the active topic.
* **Inline controls:** Send, approve, and stop actions must live directly in the chat composer area rather than in modal flows.

### 4.4. Runtime And Approval Semantics

* **Chat runtime scope:** Chat turns still run through the legacy desktop backend path in this release and are not part of the current Cursor SDK PRD/spec migration.
* **Stepped mode:** The first pass must be proposal-first or read-only, then require explicit approval before a write-capable rerun.
* **Milestone mode:** One assistant turn may make changes, but it must pause on the resulting real git diff before the next turn.
* **God mode:** The assistant may complete the turn without an approval pause while still surfacing output and diff history afterward.
* **Session-scoped stop behavior:** Stop requests must only affect the active topic run and preserve existing emergency-stop semantics.
* **Visible artifacts:** Terminal output and diff history must remain visible for each topic after the run.

### 4.5. Caveman Requirement

* **Always-on mode:** Chat must always apply Caveman-style response guidance automatically for every topic.
* **No chat-entry verification:** Entering `/chat` must not trigger a blocking install or verification step.
* **Built-in prompt behavior:** The Caveman behavior must be injected by SpecForge's own system prompt so users do not need to spend turn tokens enabling it.
* **Never gate navigation or settings:** Caveman activation must not stop topic switching, route changes, or model/autonomy edits.

### 4.6. Review And Settings

* **Review remains available:** `/review` must still support PRD/spec/file editing and document generation.
* **Primary post-setup route:** `/review` is the default destination after setup and is ordered above chat in the main sidebar.
* **Projects remains available:** `/` must remain accessible after a project is configured and must not auto-redirect away during last-project restore.
* **Top-bar model controls:** Review must expose model, reasoning, and approval mode controls in the top app bar beside the File/Edit/Selection/Terminal/Help menu, not in a separate left control column.
* **Read-only execution mirror:** The execute panel in review must reflect the active chat topic runtime and diff, but must not start, approve, or stop a separate execution engine.
* **Projects is selection-only:** Workspace configuration controls must live in Settings, not on the Projects screen.
* **Settings remain project-scoped:** Model/reasoning defaults, agent descriptions, document paths, and supporting docs remain editable from Settings.

## 5. Non-Goals

* Multi-user collaboration or cloud sync
* Browser-only chat execution without the desktop runtime
* Automatic saving of edited workspace file tabs back to disk
* OpenCode runtime integration as a provider; it is only a UX reference for this release
