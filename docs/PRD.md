# Product Requirements Document: SpecForge

## 1. Product Overview

**SpecForge** is a setup-first review workspace for desktop-first development. It helps a user choose a project folder, persist project-scoped AI/document settings in `.specforge/settings.json`, inspect CLI readiness, draft missing PRD/spec documents from AI when needed, review workspace files, and step through an execution-style dashboard before handing work off to a real IDE or CLI workflow.

Today the product focuses on **review, import, diff inspection, and approval UX**. The execution loop shown in the app is currently a **simulated agent run**, not a real Claude CLI or Codex CLI orchestration engine.

## 2. Target Audience

* **Solo engineers:** Wanting a structured review surface for PRDs, specs, diffs, and workspace files before implementation.
* **Technical leads and PMs:** Wanting a lightweight way to refine a technical spec and verify execution gates without editing code directly.
* **AI-assisted developers:** Wanting a desktop shell that keeps document loading, workspace inspection, and approval controls in one place.

## 3. Current User Flow

1. **Open the setup screen:** The app starts on a configuration flow instead of dropping directly into review.
2. **Choose the project folder:** The user picks a workspace folder. If `.specforge/settings.json` already exists, SpecForge loads it immediately.
3. **Review CLI status:** The user sees Claude CLI, Codex CLI, and Git health plus optional machine-local override paths.
4. **Configure AI defaults:** The user chooses the default model/reasoning profile and edits the saved PRD/spec prompt templates for this project.
5. **Configure document locations:** The user sets the PRD path, spec path, and optional supporting document paths relative to the selected workspace, then saves the setup to create or update `.specforge/settings.json`.
6. **Review and adjust:** The review workspace loads the configured PRD/spec files when they exist. Missing files surface dedicated empty states instead of fallback bundled docs.
7. **Approve and run:** Once the spec is approved, the user can launch the execution dashboard in stepped, milestone, or god mode.
8. **Inspect the result:** The app streams simulated terminal output, shows approval gates, and renders a diff based on the current git state when available.

## 4. Functional Requirements

### 4.1. Document Ingestion

* **Desktop native picker:** Must support `.md` and `.pdf` imports for PRD and spec documents.
* **Pane-local controls:** The PRD and spec panes must own their own load actions instead of relying on a separate sidebar ingestion panel.
* **Project configuration file:** Saving setup must create or update `.specforge/settings.json` inside the selected workspace.
* **Configured document paths:** The review panes should use the PRD/spec paths stored in `.specforge/settings.json`, not bundled defaults.
* **Missing document reset:** Loading a project must clear stale PRD/spec content when the configured files do not exist yet.
* **PRD empty state:** When the active PRD content is empty in preview mode, the PRD pane must show a dedicated empty state with a textbox, helper copy describing the saved default PRD prompt, and a generate action that appends the textbox note after that saved prompt.
* **Empty spec generation:** When the active spec content is empty and a PRD is available, the spec pane must show a textbox and generate button that append the user's note after the saved default spec prompt and include the current PRD content.
* **Blocked spec state:** When both the PRD and spec are empty in preview mode, the spec pane must explain that a PRD is required before generation while still allowing an existing spec to be loaded.
* **Generated document persistence:** After PRD/spec generation succeeds in the desktop runtime, the markdown must be saved into the configured project-relative Markdown path from `.specforge/settings.json` before the pane updates.

### 4.2. Workspace Review

* **Split review panes:** PRD and spec must be visible side-by-side in preview or edit mode.
* **Sidebar focus:** The left sidebar must be limited to agent configuration plus an MCP list summary.
* **Workspace explorer:** The right rail must show files discovered from the active workspace and allow safe text/code file opening.
* **Workspace safety:** Frontend file opens must be limited to the currently scanned workspace. Opening a new workspace should clear file tabs from the previous workspace.
* **Search:** The file tree must support in-app filtering through the floating search UI.
* **Spec empty state:** The spec pane must replace the normal preview view with a generation-oriented empty state whenever the spec content is blank and a PRD is available.
* **Spec prerequisite state:** The spec pane must show a PRD-required message instead of the generation UI when the PRD is still blank.
* **Saved-path visibility:** Once a spec is generated, the spec pane should reflect the saved file path rather than an unsaved placeholder path.

### 4.3. Settings and Diagnostics

* **Environment scan:** The app must surface Claude CLI, Codex CLI, and Git availability plus optional manual override paths.
* **Manual override behavior:** A manual path is only considered healthy after the backend successfully probes it as an executable.
* **Theme controls:** The workspace must support Dracula, Light, and System themes.
* **Project-scoped AI settings:** Model selection, reasoning profile, PRD prompt, spec prompt, and configured document paths must be saved per project in `.specforge/settings.json`.
* **Git diff visibility:** The review diff should include staged, unstaged, and untracked changes when a repository is available. Sample diff content is acceptable only when the repository is effectively clean or when running in browser fallback mode.

### 4.4. Approval and Execution UX

* **Approval modes:** The user can pick stepped, milestone, or god mode before starting a run.
* **Execution stream:** The dashboard must stream status lines and milestone changes.
* **Approval gates:** Stepped and milestone modes must pause and wait for explicit approval before continuing.
* **Emergency stop:** The user must be able to halt the active run from the dashboard.
* **Truthful execution copy:** The app must not imply that real code mutation or CLI orchestration is happening when the current implementation is simulated.

## 5. Non-Goals For The Current Build

* Real Claude CLI or Codex CLI execution that mutates or builds the opened workspace.
* Automatic file mutation, test execution, or dependency repair driven by the agent.
* Multi-user collaboration, cloud sync, or remote project state.
* Persisted workspace editing or a save-to-disk flow for opened file tabs.
