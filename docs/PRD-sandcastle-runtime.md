# Product Requirements Document: Sandcastle Runtime

## 1. Product Overview

SpecForge will move all AI agent work to a Docker-backed Sandcastle Runtime. Users choose the Agent Provider that Sandcastle runs, with Codex as the first supported provider and Claude, Cursor, and OpenCode reserved for future provider implementations.

This replaces the current Cursor-centered product direction. Cursor SDK code may remain temporarily as migration scaffolding, but the primary product runtime, setup flow, and documentation must treat Sandcastle as the runtime for PRD generation, spec generation, chat, and execution.

## 2. Goals

* Use Sandcastle as the required runtime for all real AI agent work.
* Support Codex through Sandcastle first.
* Let users choose Codex authentication mode during configuration: local subscription auth or API-key auth.
* Run agent turns inside a Docker-backed Runtime Sandbox.
* Show Runtime Readiness on both the initial Configuration screen and the Settings screen.
* Stream runtime events into the existing SpecForge UI during agent turns.
* Generate PRD/spec drafts as persisted Document Previews before saving to canonical project files.
* Preserve approval gates and emergency stop semantics for code-changing execution.

## 3. Non-Goals

* Claude Provider implementation.
* Cursor Provider implementation.
* OpenCode Provider implementation.
* Replacing the personal `.sandcastle/main.ts` development runner.
* Using Codex app-server IPC for the first model discovery slice.
* Running real agent work directly on the host workspace as a fallback when Docker is unavailable.
* Making generated document previews part of tracked project output.

## 4. Domain Language

* **Sandcastle Runtime:** The orchestration layer SpecForge uses for all AI agent work.
* **App Sandcastle Runtime:** The product runtime entrypoint that serves user-triggered PRD, spec, chat, and execution turns inside SpecForge.
* **Sandcastle Batch Runner:** The personal issue-driven workflow in `.sandcastle/main.ts`; it must remain separate from product runtime code.
* **Agent Provider:** The AI backend selected by the user for the Sandcastle Runtime to run.
* **Codex Provider:** The first Agent Provider supported through the Sandcastle Runtime.
* **Provider Auth Mode:** The way an Agent Provider authenticates for a runtime turn.
* **Runtime Sandbox:** A Docker-backed isolated environment where agent work runs.
* **Runtime Readiness:** The configuration state showing whether the App Sandcastle Runtime can run agent work.
* **Runtime Event:** A streamed update from the App Sandcastle Runtime.
* **Sandbox Result:** A branch, patch, generated text, or diff produced by a Runtime Sandbox for review.
* **Document Preview:** A generated PRD or spec draft shown before saving to the configured project path.
* **Approval Gate:** A user decision point before sandboxed code changes are applied to the project workspace.

## 5. Primary User Flow

1. The user opens SpecForge and chooses a project.
2. The Configuration screen asks the user to configure the Sandcastle Runtime.
3. The user chooses Codex as the Agent Provider.
4. The user chooses a Provider Auth Mode:
   * local subscription auth through the user's installed Codex tooling
   * API-key auth stored through the OS credential store
5. SpecForge checks Runtime Readiness:
   * Docker CLI is installed
   * Docker daemon is reachable
   * Codex CLI is available
   * selected Codex auth mode is satisfied
   * the project root is readable
   * runtime working directories can be created
   * the app can launch the runtime runner process
6. The user selects a discovered Codex model and reasoning effort.
7. The user generates or refines a PRD/spec, chats, or starts execution.
8. SpecForge launches an App Sandcastle Runtime turn inside Docker.
9. Runtime Events stream into the UI while the turn runs.
10. PRD/spec generation returns a Document Preview.
11. Code-changing execution returns a Sandbox Result for approval before the host workspace is changed.

## 6. Functional Requirements

### 6.1. Runtime Architecture

* Product runtime code must live in the app source tree, not under `.sandcastle/`.
* `.sandcastle/main.ts` must remain personal development automation and must not be wired into the product runtime.
* The app-facing runner should live under `src/`, with Rust process control under `src-tauri/src/`.
* React must continue to communicate with the desktop runtime through `src/lib/runtime.ts`; React must not execute shell commands or write workspace files directly.
* Tauri/Rust must own process control, filesystem access, credential access, Docker/Codex readiness checks, and stop handling.

### 6.2. Runtime Sandbox

* Real agent turns must run inside Docker through Sandcastle.
* If Docker is unavailable, the Sandcastle Runtime is unavailable.
* SpecForge must not silently fall back to direct host execution for real AI agent work.
* Runtime Sandbox output must return as a Sandbox Result rather than mutating the host workspace directly.

### 6.3. Codex Provider

* Codex is the first supported Agent Provider.
* Codex must run through Sandcastle.
* The user must choose the Provider Auth Mode during configuration.
* Provider Auth Mode is project configuration.
* Credentials and subscription state are local-only.
* API keys must be stored through the OS credential store and never written to `.specforge/settings.json`.
* Subscription auth should use the user's local Codex authentication material, such as `~/.codex`, when preparing the Runtime Sandbox.

### 6.4. Model Discovery

* Codex model discovery must be dynamic.
* The first implementation should use the installed Codex CLI model catalog:
  * `codex debug models`
  * `codex debug models --bundled` as a fallback if live refresh fails
* Codex app-server IPC is a future option, not required for issue #4.
* Model discovery and readiness checks run on the host.
* Agent turns run inside the Runtime Sandbox.
* Project settings persist the selected model id and reasoning effort.

### 6.5. Configuration And Settings

* Runtime Readiness must be visible on the initial Configuration screen.
* Runtime Readiness must also be visible in Settings.
* Settings must move away from a Cursor API key-centered experience.
* Settings must expose Provider Settings for:
  * Agent Provider
  * Provider Auth Mode
  * Codex API key entry when API-key auth is selected
  * local Codex auth detection when subscription auth is selected
  * Docker readiness
  * model discovery status
  * selected model and reasoning effort
* Runtime actions must still guard on readiness because Docker or auth state can change after configuration.

### 6.6. PRD And Spec Generation

* PRD generation must run through the Sandcastle Runtime.
* Spec generation must run through the Sandcastle Runtime.
* PRD/spec generation must keep separate PRD Agent and Spec Agent descriptions.
* Provider choice must not collapse workflow-specific Agent Descriptions.
* Generation must produce a Document Preview before saving to `docs/PRD.md`, `docs/SPEC.md`, or configured paths.
* The user must be able to save, edit then save, discard, or replace a Document Preview.
* Document Previews must persist across app restarts separately from canonical PRD/spec files.
* Document Previews are ignored local workspace state under `.specforge/`.

### 6.7. Chat And Execution

* Chat must run through the Sandcastle Runtime.
* Execution must run through the Sandcastle Runtime.
* Runtime Events must stream during each turn.
* Code-changing execution must preserve Approval Gates and emergency stop behavior.
* Sandboxed code changes must produce a diff, patch, or branch for review.
* Approved changes may be applied or merged into the host workspace.
* Rejected changes must leave the host workspace untouched.

### 6.8. Persistence

* `.specforge/settings.json` is project configuration and may be tracked.
* `.specforge/previews/` is ignored local workspace state.
* `.specforge/session.json`, if used for preview/session recovery, is ignored local workspace state.
* `.specforge/.gitignore` must ignore preview/session state while allowing project settings to remain trackable.

## 7. Acceptance Criteria

* Configuration shows Sandcastle/Codex/Docker readiness before the app is considered fully usable.
* Settings shows the same readiness status and lets the user refresh diagnostics.
* User can choose Codex auth mode as subscription or API key.
* API-key auth stores the secret only in the OS credential store.
* Subscription auth detects local Codex auth without writing credentials to project settings.
* Codex models are discovered from the installed Codex CLI.
* PRD generation uses Sandcastle and returns a persisted Document Preview.
* Spec generation uses Sandcastle and returns a persisted Document Preview.
* Chat turns use Sandcastle and stream Runtime Events.
* Code-changing execution returns a Sandbox Result and requires approval before host workspace changes.
* Stop cancels the active Sandcastle runtime turn and leaves the UI in a halted state.
* Cursor is no longer presented as required for SpecForge to be useful.

## 8. Migration Notes

* Existing Cursor SDK generation code may remain temporarily as legacy migration code.
* Product UX and docs must no longer center Cursor API key setup.
* The main `docs/PRD.md` and `docs/SPEC.md` should be updated when the implementation ships.
* The current personal `.sandcastle/main.ts` runner demonstrates Codex-through-Sandcastle patterns but must not become the product runtime.
