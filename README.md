# SpecForge

SpecForge is a Tauri desktop app for spec-driven development. It helps you configure a project, generate and review PRD/spec documents with Cursor SDK agents, inspect the workspace, and keep approved implementation work visible through the desktop shell.

The current codebase is an MVP shell built with React, Zustand, Tailwind, HeroUI, Tauri, and Rust. It includes a browser-safe demo path for the web UI and a desktop runtime path for real filesystem, git, secure Cursor API key storage, and document persistence.

## What It Does

- Imports PRD/spec content from Markdown and PDF files.
- Bundles `docs/PRD.md` and `docs/SPEC.md` into the app as the default startup documents.
- Scans a workspace folder while respecting `.gitignore`.
- Lets you review and edit PRD/spec documents in a split workspace.
- Saves the Cursor API key in the OS credential store, not in `.specforge/settings.json`.
- Shows environment health for Cursor SDK key access and Git.
- Generates PRD/spec Markdown with editable Cursor agent descriptions.
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
- Cursor API key for PRD/spec generation

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
- `bun run tauri dev` is required for real file access, workspace scanning, PDF parsing, git diffing, secure Cursor key storage, and document saving.

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
- Rust commands in `src-tauri/src/lib.rs` own filesystem access, workspace walking, PDF parsing, git diffing, OS credential storage, and document saving.
- PRD/spec generation is run through a Bun TypeScript runner using `@cursor/sdk`; Rust delegates to that runner and saves the generated Markdown after the frontend receives it.
- Payloads crossing the Tauri boundary use camelCase.
- The desktop app preserves a demo path in browser mode so the UI can still be explored without native services.

## Default Documents

SpecForge ships with these startup documents:

- `docs/PRD.md`
- `docs/SPEC.md`

If you change the review flow, model options, import flow, or autonomy behavior, keep those docs aligned with the shipped app behavior.

## Current Status

This repository is an active MVP. The review workspace, import flow, Cursor SDK PRD/spec generation path, environment scan, diff preview, and simulated execution loop are implemented. Chat execution still has legacy CLI runtime code and is intentionally outside the current Cursor SDK refactor scope.
