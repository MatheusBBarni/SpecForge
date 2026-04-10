# Testing Guide

## Automated Verification Today
- Frontend build: `bun run build`
- Rust compile check: `cargo check --manifest-path .\src-tauri\Cargo.toml`
- Rust formatting: `cargo fmt --manifest-path .\src-tauri\Cargo.toml`

## Current Reality
- There is no automated frontend test suite.
- There is no CI workflow in the repo today.
- In this environment, `cargo check --manifest-path .\src-tauri\Cargo.toml` succeeds.
- In this environment, `bun run build` currently fails before TypeScript/Vite can run because Bun reports corrupted `node_modules` bin shims. The repair command is `bun install --force`.

## Manual Smoke Paths
- Launch the review shell and confirm the default PRD/spec panes load `docs/PRD.md` and `docs/SPEC.md`.
- Open a workspace folder and confirm `.gitignore` exclusions are respected.
- Import both Markdown and PDF documents and verify the selected target pane updates correctly.
- Refresh diagnostics in Settings and verify Claude/Codex/Git status cards update without breaking the page.
- Start a build in browser mode and confirm the fallback execution stream, pending diff, approval gate, and emergency stop still work.

## High-Value Next Tests
- Add a small React smoke suite around the review/execution flow.
- Add a Rust test around workspace document picking and path normalization.
- Add CI once the frontend build path is stable again.
