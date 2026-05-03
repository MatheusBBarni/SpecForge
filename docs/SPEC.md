# Sandcastle Runtime Technical Specification

## Architecture

SpecForge is a Tauri desktop app with a React webview. The webview never performs shell execution, filesystem writes, credential access, Docker checks, or Codex process control directly. All desktop work flows through `src/lib/runtime.ts` into Tauri commands exposed from `src-tauri/src/lib.rs`.

The product Sandcastle runtime lives in the app source tree. `src/sandcastle/Dockerfile` defines the Docker-backed Codex runtime image. The personal `.sandcastle/main.ts` batch runner remains separate development automation and is not used by product UI flows.

## Runtime Ownership

* React owns view state, prompt composition, and rendering runtime events.
* `src/lib/runtime.ts` owns all Tauri `invoke` calls and event subscriptions.
* `src-tauri/src/environment.rs` reports Runtime Readiness for Codex auth, Codex CLI, Docker CLI/daemon, and Git. Docker readiness delegates to `src-tauri/src/docker.rs`, which prefers host Docker and falls back to WSL Docker integration on Windows when a WSL distro can reach the daemon.
* `src-tauri/src/secrets.rs` stores Codex API keys in the OS credential store and detects local Codex subscription auth from `CODEX_HOME`, `%USERPROFILE%\.codex`, or `$HOME/.codex`.
* `src-tauri/src/cursor_agent.rs` is legacy-named migration scaffolding; its PRD/spec command now builds and runs the Docker-backed Sandcastle Codex runtime.
* `src-tauri/src/project.rs` reads and writes `.specforge/settings.json`.

## Project Settings

`.specforge/settings.json` is project configuration. It stores:

* `agentProvider`, currently normalized to `codex`
* `providerAuthMode`, either `subscription` or `api_key`
* `selectedModel`
* `selectedReasoning`
* PRD, spec, and execution agent descriptions
* PRD/spec output paths
* supporting document paths

Provider secrets are not written to project settings. `.specforge/.gitignore` ignores local preview/session state while allowing settings to remain trackable.

## Runtime Readiness

Configuration and Settings both display:

* Codex Provider authentication status
* Codex CLI status
* Docker CLI and daemon status, including Windows WSL Docker fallback status
* Git status

Model discovery runs on the host through `codex debug models`. If live discovery returns no models, the backend tries `codex debug models --bundled`.

## PRD And Spec Generation

PRD and spec generation keep separate workflow-specific agent descriptions. The frontend composes the prompt, then calls the desktop runtime command. Rust resolves a Docker runtime through `src-tauri/src/docker.rs`, builds the `specforge-sandcastle-runtime:latest` Docker image from `src/sandcastle/Dockerfile`, mounts the selected workspace read-only at `/home/agent/workspace`, mounts a temporary output directory, passes Codex auth through either `OPENAI_API_KEY` or a read-only `.codex` mount, and runs `codex exec` inside the container. When the Windows WSL Docker fallback is selected, Windows host paths are converted to `/mnt/<drive>/...` before being passed to Docker. The fallback tries the default WSL distro first, then other user distros while skipping Docker Desktop's internal `docker-desktop` distros.

Generated markdown is written first to `.specforge/previews/prd.md` or `.specforge/previews/spec.md`. Project context loads previews separately from canonical PRD/spec documents and the review pane shows a preview action group. Save writes the current preview content to the configured canonical document path, then deletes the preview. Edit switches the preview into the existing edit mode before saving. Discard deletes the preview and restores the canonical document from the workspace. Running generation again replaces the persisted preview.

## Chat And Execution

Codex chat turns run through the same Docker-backed Sandcastle image while preserving the existing stepped and milestone approval gates. The current Sandcastle chat mount is read-only, so write-capable turns return assistant output and blockers without directly mutating the host workspace.

The review execution command launches a read-only Sandcastle Codex turn from the approved spec and returns a Sandbox Result into the execution diff artifact. Stepped mode gates before the runtime turn, milestone mode gates after the result is available, and stop requests force-remove the active Docker container before marking the UI halted. Applying sandbox patches back into the host workspace remains a follow-up integration step.

## Tauri Commands

Current command names remain stable for frontend compatibility:

* `run_environment_scan`
* `list_cursor_models` (legacy name; returns Codex CLI models)
* `run_cursor_agent_prompt` (legacy name; runs Sandcastle Codex for PRD/spec turns)
* `save_cursor_api_key` / `delete_cursor_api_key` (legacy names; store Codex API keys)
* `save_project_settings`
* `save_workspace_document`
* `spawn_cli_agent`
* `approve_action`
* `kill_agent_process`
* chat session commands

Legacy names should be renamed in a follow-up compatibility migration.
