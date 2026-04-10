# SpecForge

SpecForge is a Tauri desktop app for spec-driven development. It helps you import a PRD or technical spec, review the source and generated documents side by side, inspect the workspace, and hand an approved spec off to an AI coding agent with configurable autonomy.

The current codebase is an MVP shell built with React, Zustand, Tailwind, HeroUI, Tauri, and Rust. It includes a browser-safe demo path for the web UI and a desktop runtime path for real filesystem, git, and CLI access.

## What It Does

- Imports PRD/spec content from Markdown and PDF files.
- Bundles `docs/PRD.md` and `docs/SPEC.md` into the app as the default startup documents.
- Scans a workspace folder while respecting `.gitignore`.
- Lets you review and edit PRD/spec documents in a split workspace.
- Shows environment health for Claude CLI, Codex CLI, and Git.
- Streams agent output and supports stepped, milestone, and full-autonomy execution modes.
- Surfaces git diff review data before approvals.
- Falls back to simulated workspace and diff data when running outside the Tauri desktop shell.

## Tech Stack

- Frontend: React 19, React Router 7, Zustand, HeroUI, Tailwind v4, TypeScript, Vite
- Desktop shell: Tauri 2
- Backend: Rust
- Native/backend crates: `git2`, `ignore`, `lopdf`, `rfd`, `which`

## Project Structure

```text
.
|- docs/         Product docs bundled into the UI at startup
|- src/          React app, stores, components, runtime bridge
|- src-tauri/    Rust commands, workspace scanning, git/diff, document parsing
|- AGENTS.md     Repo-specific working rules for coding agents
|- HANDOFF.md    Session handoff notes
```

## Prerequisites

- [Bun](https://bun.sh/)
- Rust toolchain
- Tauri desktop prerequisites for your OS
- Git
- Optional: local `codex` and `claude` CLIs if you want environment detection and agent handoff to use real binaries

## Getting Started

Install dependencies:

```bash
bun install
```

Run the browser UI shell:

```bash
bun run dev
```

Run the desktop app with the Tauri backend:

```bash
bun run tauri dev
```

Important:

- `bun run dev` is useful for UI work, but it uses fallback workspace/diff behavior when Tauri is not present.
- `bun run tauri dev` is required for real file access, workspace scanning, PDF parsing, git diffing, and CLI execution.

## Common Commands

```bash
bun run dev
bun run build
bun run tauri dev
bun run tauri build
cargo check --manifest-path .\src-tauri\Cargo.toml
cargo fmt --manifest-path .\src-tauri\Cargo.toml
```

If Bun shims break and `bun run build` fails with `could not create process`, repair them with:

```bash
bun install --force
```

## Architecture Notes

- The React app never talks to the shell or filesystem directly.
- All desktop/runtime operations flow through `src/lib/runtime.ts`.
- Rust commands in `src-tauri/src/lib.rs` own filesystem access, workspace walking, PDF parsing, git diffing, and CLI process control.
- Payloads crossing the Tauri boundary use camelCase.
- The desktop app preserves a demo path in browser mode so the UI can still be explored without native services.

## Default Documents

SpecForge ships with these startup documents:

- `docs/PRD.md`
- `docs/SPEC.md`

If you change the review flow, model options, import flow, or autonomy behavior, keep those docs aligned with the shipped app behavior.

## Current Status

This repository is an active MVP. The review workspace, import flow, environment scan, diff preview, and simulated execution loop are implemented. Some product ideas documented in `docs/SPEC.md` are still aspirational and should be treated as roadmap material unless they are reflected in the current code.
