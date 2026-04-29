# Cursor SDK Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Codex/Claude CLI-backed PRD/spec generation with Cursor SDK-backed TypeScript generation and secure Cursor key storage.

**Architecture:** Rust reads and writes local machine data, stores the Cursor key in the OS credential store, and delegates Cursor execution to a Bun TypeScript runner. React owns Cursor agent prompt construction; `src/cursorAgentRunner.ts` owns SDK calls for PRD/spec generation.

**Tech Stack:** React 19, TypeScript, Tauri 2, Rust, Cursor TypeScript SDK, Rust `keyring`.

---

### Task 1: Settings Shape

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/agentConfig.ts`
- Modify: `src/lib/projectConfig.ts`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/project.rs`

- [ ] Add Cursor model/provider types.
- [ ] Add `prdAgentDescription`, `specAgentDescription`, and `executionAgentDescription`.
- [ ] Preserve legacy `prdPrompt` and `specPrompt` while reading old settings.

### Task 2: Secure Cursor Key

**Files:**
- Modify: `src/lib/runtime.ts`
- Modify: `src/store/useSettingsStore.ts`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/secrets.rs`

- [ ] Store the Cursor API key in the OS credential store.
- [ ] Expose only status plus save/delete commands to React.
- [ ] Avoid persisting the key in project settings or localStorage.

### Task 3: Cursor Generation

**Files:**
- Create: `src/lib/cursorAgentRuntime.ts`
- Create: `src/cursorAgentRunner.ts`
- Create: `src-tauri/src/cursor_agent.rs`
- Modify: `src/hooks/useDocumentHandlers.ts`
- Modify: `src-tauri/src/documents.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] Build PRD and spec prompts in TypeScript.
- [ ] Run Cursor SDK from the Bun TypeScript runner with the configured Cursor key and model.
- [ ] Save generated markdown through Rust file-writing command.

### Task 4: UI and Docs

**Files:**
- Modify: `src/components/ProjectAiSettingsCard.tsx`
- Modify: `src/screens/ConfigurationScreen.tsx`
- Modify: `src/components/SettingsView.tsx`
- Modify: `docs/PRD.md`
- Modify: `docs/SPEC.md`

- [ ] Replace CLI availability UX for this workflow with Cursor API key configuration.
- [ ] Rename prompt labels to agent descriptions.
- [ ] Document Cursor SDK ownership and key storage.

### Task 5: Verification

**Commands:**
- `bun test`
- `bun run lint`
- `bun run build`
- `cargo check --manifest-path .\src-tauri\Cargo.toml`
