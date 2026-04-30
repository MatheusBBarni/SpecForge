# Cursor SDK Refactor Design

## Goal

Move SpecForge's PRD and spec generation away from Codex and Claude CLI orchestration and onto Cursor SDK agents, while keeping provider-specific model logic in TypeScript/Bun and Rust focused on the desktop boundary.

## Decisions

- Cursor API key is stored in the OS credential store through Rust `keyring` commands.
- The key is never written to `.specforge/settings.json` or browser `localStorage`.
- Project settings continue to live in `.specforge/settings.json`, but they store Cursor model defaults and editable agent descriptions.
- PRD generation uses a PRD agent description plus the user's product context.
- Spec generation uses a spec agent description plus the current PRD and the user's technical guidance.
- Execution agent description is added to settings now, but chat and execution screens are not refactored in this phase.

## Architecture

Rust remains the data bridge: workspace selection, settings read/write, document read/write, git diff, Cursor key storage, and delegation to the Bun runner. React owns Cursor prompt construction, and `src/cursorAgentRunner.ts` owns `@cursor/sdk` calls because the SDK cannot be bundled into the webview. Generated markdown returns to the React flow, then Rust writes it to the configured workspace path.

## Verification

- Unit tests cover Cursor model defaults, settings migration from legacy prompt fields, and prompt payload construction.
- Rust check verifies keyring commands and payload shape.
- Frontend build verifies the React settings and generation flow compile together.
