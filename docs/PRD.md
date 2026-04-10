# Product Requirements Document: SpecForge

## 1. Product Overview

**SpecForge** is a spec review workspace for desktop-first development. It helps a user load a PRD and a technical spec, inspect workspace files, review environment readiness, draft a missing spec from AI when needed, and step through an execution-style dashboard before handing work off to a real IDE or CLI workflow.

Today the product focuses on **review, import, diff inspection, and approval UX**. The execution loop shown in the app is currently a **simulated agent run**, not a real Claude CLI or Codex CLI orchestration engine.

## 2. Target Audience

* **Solo engineers:** Wanting a structured review surface for PRDs, specs, diffs, and workspace files before implementation.
* **Technical leads and PMs:** Wanting a lightweight way to refine a technical spec and verify execution gates without editing code directly.
* **AI-assisted developers:** Wanting a desktop shell that keeps document loading, workspace inspection, and approval controls in one place.

## 3. Current User Flow

1. **Open the review workspace:** The app starts with bundled `docs/PRD.md` and `docs/SPEC.md`.
2. **Load documents:** The user can:
   * Import a repo-relative Markdown or PDF document by path in the desktop app.
   * Use the desktop native file picker to load Markdown or PDF into the PRD or spec pane.
   * Use the browser file input to load Markdown only.
3. **Open a workspace folder:** The user can scan a folder into the workspace tree. Desktop scanning respects `.gitignore`, and browser folder import applies root and nested `.gitignore` rules.
4. **Handle missing specs:** If the opened workspace does not contain a matching spec file, the spec pane should be empty and show an inline generation state with a textbox plus a generate button that sends the current PRD and the user's note to the selected AI CLI.
5. **Review and refine:** The user can edit either document directly, switch between preview and edit, select text in the spec, and append a refinement block.
6. **Approve and run:** Once the spec is approved, the user can launch the execution dashboard in stepped, milestone, or god mode.
7. **Inspect the result:** The app streams simulated terminal output, shows approval gates, and renders a diff based on the current git state when available.

## 4. Functional Requirements

### 4.1. Document Ingestion

* **Desktop native picker:** Must support `.md` and `.pdf` imports for PRD and spec documents.
* **Repo-relative path import:** Must allow only paths that stay inside the current repository root.
* **Browser file import:** Must support Markdown only and explain that PDF parsing requires the desktop runtime.
* **Workspace auto-detection:** When a workspace is opened, the app should try to load:
  * `PRD.md`, then `PRD.pdf`
  * `spec.md`, then `spec.pdf`
* **Missing document reset:** Opening a workspace must clear stale PRD/spec content from the previous workspace when those files are not found in the new one.
* **Empty spec generation:** When the active spec content is empty, the spec pane must show a textbox and generate button that use the current PRD plus the user's note to draft a markdown spec through the selected desktop AI CLI.
* **Generated spec persistence:** After generation succeeds in the desktop runtime, the markdown must be saved into the same folder as the active PRD using a sibling `SPEC.md` or `spec.md` file before the pane updates.

### 4.2. Workspace Review

* **Split review panes:** PRD and spec must be visible side-by-side in preview or edit mode.
* **Workspace explorer:** The right rail must show files discovered from the active workspace and allow safe text/code file opening.
* **Workspace safety:** Frontend file opens must be limited to the currently scanned workspace. Opening a new workspace should clear file tabs from the previous workspace.
* **Search:** The file tree must support in-app filtering through the floating search UI.
* **Spec empty state:** The spec pane must replace the normal editor/preview view with a generation-oriented empty state whenever the spec content is blank.
* **Saved-path visibility:** Once a spec is generated, the spec pane should reflect the saved file path rather than an unsaved placeholder path.

### 4.3. Settings and Diagnostics

* **Environment scan:** The app must surface Claude CLI, Codex CLI, and Git availability plus optional manual override paths.
* **Manual override behavior:** A manual path is only considered healthy after the backend successfully probes it as an executable.
* **Theme controls:** The workspace must support Dracula, Light, and System themes.
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
