# SpecForge Agent Guide

## Commands
- `bun run dev` starts the Vite web shell on port 5173 for local UI work.
- `bun run build` runs `tsc && vite build` for the frontend bundle.
- `bun run tauri dev` starts the desktop shell against the local Vite server.
- `bun run tauri build` packages the desktop app.
- `cargo check --manifest-path .\src-tauri\Cargo.toml` validates the Rust command layer.
- `cargo fmt --manifest-path .\src-tauri\Cargo.toml` formats the Rust backend.
- `bun install --force` repairs broken Bun bin shims when `bun run build` fails with `could not create process`.

## Stack
- Frontend: React 19, React Router 7, Zustand, HeroUI, Tailwind v4, TypeScript.
- Desktop/backend: Tauri 2, Rust, `git2`, `ignore`, `lopdf`, `rfd`, `which`.
- Default source docs: `docs/PRD.md` and `docs/SPEC.md` are bundled into the review UI at startup.

## Always
- MUST keep shell execution, filesystem access, PDF parsing, git diffing, and CLI process control in `src-tauri/src/lib.rs`; the webview only talks to Tauri through `src/lib/runtime.ts`.
- MUST keep `docs/PRD.md` and `docs/SPEC.md` aligned with shipped behavior when you change the review flow, model options, import flow, or autonomy modes.
- MUST run `cargo check --manifest-path .\src-tauri\Cargo.toml` after changing Rust commands or shared payload types.
- MUST run `bun run build` after changing routes, stores, document loading, or shared UI contracts. If Bun reports broken shims first, repair them with `bun install --force`.
- MUST extract new frontend behavior out of `src/App.tsx` when possible; it is already the main orchestration shell.

## Ask First
- Ask before changing autonomy defaults, approval-gate behavior, or the emergency-stop semantics.
- Ask before changing `src-tauri/tauri.conf.json`, capability files, window sizing, or security settings.
- Ask before adding new runtime dependencies, new CLI/MCP integrations, or a frontend formatter/linter that rewrites the current code style.

## Never
- NEVER let React execute shell commands or filesystem writes directly.
- NEVER remove the review-and-approval path from stepped or milestone modes without explicit approval.
- NEVER treat fallback data in `src/lib/runtime.ts` as real workspace state or a real git diff.
- NEVER commit secrets, auth tokens, or machine-local binary paths.

## Landmines
- `src/App.tsx` is 1,071 lines and `src/styles.css` is 1,047 lines. Prefer targeted extractions over widening either file.
- `src-tauri/src/lib.rs` mixes environment scanning, workspace walking, diffing, document parsing, and simulated agent execution. Small changes are safer than broad rewrites.
- `git_get_diff()` returns a sample diff when the working tree is clean, and `FALLBACK_WORKSPACE` advertises files that may not exist yet. Keep demo behavior separate from real execution logic.
- `scan_workspace_folder()` and `filterWorkspaceFiles()` intentionally respect `.gitignore`; preserve that behavior when changing workspace discovery.
- `docs/SPEC.md` is partially aspirational today and references tooling that is not in `package.json` (`react-markdown`, `react-syntax-highlighter`, `tauri-plugin-store`). Update the docs when you normalize or implement those gaps.
- There is no committed frontend formatter, linter, or automated test suite yet. MUST ask before introducing one mid-task.

## Patterns
- Put reusable frontend behavior in `src/lib`, long-lived client state in `src/store`, and view composition in `src/components` or route shells.
- Keep Tauri payloads camelCase across the frontend/backend boundary.
- Prefer extending the existing PRD/spec/import flow instead of adding parallel ingestion paths.
- Update `HANDOFF.md` before clearing or compacting a long session.
- More specific guidance lives in `src/AGENTS.md`, `src-tauri/AGENTS.md`, and `docs/AGENTS.md`.

## Learned Rules
