# SpecForge

SpecForge is a desktop workspace for spec-driven development that keeps project context local while delegating AI-assisted planning and execution to configurable agent providers.

## Language

**Sandcastle Runtime**:
The orchestration layer SpecForge uses for all AI agent work.
_Avoid_: Cursor runtime, generic sidecar runtime

**Agent Provider**:
The AI backend selected by the user for the Sandcastle Runtime to run.
_Avoid_: AI vendor, model provider, sidecar provider

**Codex Provider**:
The first Agent Provider SpecForge should support through the Sandcastle Runtime.
_Avoid_: Default Cursor provider

**Provider Auth Mode**:
The way an Agent Provider authenticates for a runtime turn.
_Avoid_: Provider type

**Sandcastle Batch Runner**:
The existing issue-driven Sandcastle workflow that plans, implements, reviews, and merges GitHub issues in Docker worktrees.
_Avoid_: App runtime, chat runtime

**App Sandcastle Runtime**:
The product runtime entrypoint that serves user-triggered PRD, spec, chat, and execution turns inside SpecForge.
_Avoid_: Personal Sandcastle runner

**Runtime Sandbox**:
A Docker-backed isolated environment where the App Sandcastle Runtime runs agent work.
_Avoid_: Host workspace execution

**Runtime Readiness**:
The configuration state that tells the user whether the App Sandcastle Runtime can run agent work.
_Avoid_: Provider status, environment scan

**Runtime Event**:
A streamed update from the App Sandcastle Runtime that keeps the user informed during an agent turn.
_Avoid_: Final response only

**Approval Gate**:
A user decision point before sandboxed agent changes are applied to the project workspace.
_Avoid_: Fully autonomous apply

**Sandbox Result**:
The branch, patch, generated text, or diff produced by a Runtime Sandbox for review by SpecForge.
_Avoid_: Direct workspace mutation

**Document Preview**:
A generated PRD or spec draft shown to the user before it is saved to the configured project path.
_Avoid_: Direct document overwrite

**Provider Settings**:
The SpecForge settings area where users choose and configure the Agent Provider used by the Sandcastle Runtime.
_Avoid_: Cursor API key settings

**Local Provider Configuration**:
Machine-local provider setup such as authentication state, installed CLIs, and subscription-backed access.
_Avoid_: Project credentials

**Project Provider Defaults**:
Project-scoped defaults for Agent Provider, model, and reasoning profile.
_Avoid_: Local auth settings

**Model Discovery**:
The runtime capability that asks the user's installed provider tooling which models are available.
_Avoid_: Hard-coded model catalog

**Agent Description**:
Workflow-specific instructions that shape how the selected Agent Provider performs a SpecForge task.
_Avoid_: Provider prompt, system prompt

## Relationships

- The **Sandcastle Runtime** runs exactly one selected **Agent Provider** for each user-initiated AI agent turn.
- The **Codex Provider** is the first **Agent Provider** targeted for Sandcastle Runtime integration.
- The **Codex Provider** supports subscription-backed local auth and API-key auth as distinct **Provider Auth Mode** options.
- The user chooses the **Provider Auth Mode** during configuration.
- The **Sandcastle Batch Runner** proves Codex can run through Sandcastle, but it is distinct from the app-facing **Sandcastle Runtime**.
- The **App Sandcastle Runtime** must be separate from the personal **Sandcastle Batch Runner** in `.sandcastle/main.ts`.
- Product runtime code belongs to the app source tree, while `.sandcastle/` remains personal development automation.
- The **App Sandcastle Runtime** uses a **Runtime Sandbox** rather than running agent work directly on the host workspace.
- If Docker is unavailable, **Runtime Readiness** is not satisfied and real AI agent work is unavailable.
- **Runtime Readiness** must be visible during initial project configuration and in ongoing settings.
- **Runtime Readiness** checks local prerequisites and launchability, not a live model call.
- The **App Sandcastle Runtime** emits **Runtime Events** during each agent turn.
- Code-changing execution through the **App Sandcastle Runtime** must preserve **Approval Gates** and emergency stop behavior.
- Code-changing **Sandbox Results** are applied to the project workspace only after an **Approval Gate**.
- PRD and spec generation produce a **Document Preview** before saving to project files.
- A **Document Preview** remains available until the user saves, discards, or replaces it.
- A **Document Preview** persists across app restarts separately from the canonical PRD and spec files.
- **Document Previews** are ignored local workspace state under `.specforge/`.
- `.specforge/settings.json` is project configuration, while previews and session state are local workspace state.
- **Provider Settings** configure which **Agent Provider** the **Sandcastle Runtime** should use.
- An **Agent Description** is selected by workflow, independent of the chosen **Agent Provider**.
- **Local Provider Configuration** belongs to the user's machine, while **Project Provider Defaults** belong to the project.
- **Provider Auth Mode** is a project choice, but credentials and subscription state are local-only.
- Cursor SDK paths may remain temporarily as legacy migration code, but they are not the primary product runtime.
- Claude, Cursor, and OpenCode are future **Agent Providers**, not part of the first Codex Provider slice.
- The **Codex Provider** uses **Model Discovery** through the user's installed Codex tooling rather than a fixed model catalog.
- The first **Model Discovery** path uses the Codex CLI model catalog; Codex app-server IPC is a future integration option.
- **Runtime Readiness** and **Model Discovery** run on the host, while agent turns run inside the **Runtime Sandbox**.

## Example Dialogue

> **Dev:** "Should PRD generation call the Cursor SDK directly?"
> **Domain expert:** "No. PRD generation should go through the **Sandcastle Runtime**, and the selected **Agent Provider** determines whether Codex, Claude, Cursor, or another backend handles it."

## Flagged Ambiguities

- "sandscale" was used once to mean **Sandcastle**; resolved: the canonical term is **Sandcastle**.
- `.sandcastle/main.ts` is a personal development runner, not the product runtime.
