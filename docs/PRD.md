# Product Requirements Document: Sandcastle Runtime

## 1. Product Overview

SpecForge uses a Docker-backed Sandcastle Runtime for real AI agent work. Users choose the Agent Provider that Sandcastle runs, with Codex as the first supported provider and Claude, Cursor, and OpenCode reserved for future provider implementations.

This replaces the previous Cursor-centered product direction. Legacy Cursor SDK code may remain temporarily as migration scaffolding, but the primary product runtime, setup flow, and documentation treat Sandcastle as the runtime for PRD generation, spec generation, chat, and execution.

## 2. Goals

* Use Sandcastle as the required runtime for real AI agent work.
* Support Codex through Sandcastle first.
* Let users choose Codex authentication mode during configuration: local subscription auth or API-key auth.
* Run PRD and spec generation inside a Docker-backed Runtime Sandbox.
* Show Runtime Readiness on both the initial Configuration screen and the Settings screen.
* Discover Codex models from the installed Codex CLI.
* Persist generated PRD/spec drafts as Document Previews before saving canonical project files.
* Preserve approval gates and emergency stop semantics for code-changing execution.

## 3. Non-Goals

* Claude Provider implementation.
* Cursor Provider implementation.
* OpenCode Provider implementation.
* Replacing the personal `.sandcastle/main.ts` development runner.
* Using Codex app-server IPC for the first model discovery slice.
* Running real agent work directly on the host workspace as a fallback when Docker is unavailable.

## 4. Domain Language

* **Sandcastle Runtime:** The orchestration layer SpecForge uses for AI agent work.
* **App Sandcastle Runtime:** The product runtime entrypoint that serves user-triggered PRD, spec, chat, and execution turns inside SpecForge.
* **Sandcastle Batch Runner:** The personal issue-driven workflow in `.sandcastle/main.ts`; it remains separate from product runtime code.
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
2. The Configuration screen shows Sandcastle Runtime Readiness.
3. The user chooses Codex as the Agent Provider.
4. The user chooses a Provider Auth Mode: local subscription auth or API-key auth stored through the OS credential store.
5. SpecForge checks Docker CLI, Docker daemon, Codex CLI, Codex auth, Git, project readability, runtime working directories, and runtime launch capability. On Windows, host Docker is preferred, but a healthy WSL Docker integration is accepted when the host Docker pipe is unavailable.
6. The user selects a discovered Codex model and reasoning effort.
7. The user generates or refines a PRD/spec, chats, or starts execution.
8. SpecForge launches an App Sandcastle Runtime turn inside Docker.
9. Runtime Events stream into the UI while the turn runs.
10. PRD/spec generation returns a persisted Document Preview under `.specforge/previews/`.
11. Code-changing execution returns a Sandbox Result for approval before the host workspace is changed.

## 6. Functional Requirements

* Product runtime code must live in the app source tree, not under `.sandcastle/`.
* `.sandcastle/main.ts` remains personal development automation and is not wired into product runtime.
* React communicates with the desktop runtime through `src/lib/runtime.ts`; React does not execute shell commands or write workspace files directly.
* Tauri/Rust owns process control, filesystem access, credential access, Docker/Codex readiness checks, and stop handling.
* Real PRD/spec agent turns run inside Docker through Sandcastle.
* If Docker is unavailable, the Sandcastle Runtime is unavailable.
* On Windows, Docker readiness and Sandcastle launches may use Docker from WSL when host Docker is unavailable and a WSL distro can reach the daemon.
* SpecForge must not silently fall back to direct host execution for real AI agent work.
* API keys are stored through the OS credential store and never written to `.specforge/settings.json`.
* Subscription auth uses local Codex authentication material such as `~/.codex` when preparing the Runtime Sandbox.
* Codex model discovery uses `codex debug models`, with `codex debug models --bundled` as fallback.
* Generated PRD/spec previews can be saved to the configured document path, edited before saving, discarded, or replaced by another generation run.
* Settings expose Agent Provider, Provider Auth Mode, Codex API key entry, local Codex auth detection, Docker readiness, model discovery status, selected model, and reasoning effort.

## 7. Acceptance Criteria

* Configuration shows Sandcastle/Codex/Docker readiness before the app is considered fully usable.
* Settings shows the same readiness status and lets the user refresh diagnostics.
* User can choose Codex auth mode as subscription or API key.
* API-key auth stores the secret only in the OS credential store.
* Subscription auth detects local Codex auth without writing credentials to project settings.
* Codex models are discovered from the installed Codex CLI.
* PRD generation uses Sandcastle and returns a persisted Document Preview.
* Spec generation uses Sandcastle and returns a persisted Document Preview.
* Code-changing execution returns a Sandcastle Sandbox Result and preserves approval gates and emergency stop behavior.
* Cursor is no longer presented as required for SpecForge to be useful.
