# Testing Guide

## Automated Verification Today
- Frontend build: `bun run build`
- Frontend typecheck: `bunx tsc --noEmit`
- Frontend tests: `bun test`
- Rust compile check: `cargo check --manifest-path .\src-tauri\Cargo.toml`
- Rust formatting: `cargo fmt --manifest-path .\src-tauri\Cargo.toml`

## Current Reality
- Vitest covers the current config normalization and Cursor prompt helpers.
- CI validates typecheck, lint, and tests on push/PR.
- Use Bun for frontend commands.

## Manual Smoke Paths
- Launch the review shell and confirm the default PRD/spec panes load `docs/PRD.md` and `docs/SPEC.md`.
- Open a workspace folder and confirm `.gitignore` exclusions are respected.
- Import both Markdown and PDF documents and verify the selected target pane updates correctly.
- Refresh diagnostics in Settings and verify Cursor SDK key and Git status cards update without breaking the page.
- Save and clear a Cursor API key and verify it does not appear in `.specforge/settings.json`.
- Start a build in browser mode and confirm the fallback execution stream, pending diff, approval gate, and emergency stop still work.

## High-Value Next Tests
- Add a small React smoke suite around the review/execution flow.
- Add a Rust test around workspace document picking and path normalization.
- Add CI once the frontend build path is stable again.
