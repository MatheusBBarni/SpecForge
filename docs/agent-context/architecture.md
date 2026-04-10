# SpecForge Architecture

## Current Shape
- SpecForge is a Tauri desktop app with a React/TypeScript webview in `src/` and a Rust backend in `src-tauri/`.
- The default review workspace loads `docs/PRD.md` and `docs/SPEC.md` directly into the UI at startup.
- Zustand holds the long-lived client state across three stores:
  - `useProjectStore` for PRD/spec content, active tabs, approval state, and refinement flow.
  - `useAgentStore` for terminal output, milestone state, pending diffs, and execution summaries.
  - `useSettingsStore` for theme choice, binary overrides, environment diagnostics, and workspace entries.

## Frontend Responsibilities
- `src/App.tsx` is the orchestration shell. It owns routing, keyboard shortcuts, environment refresh, document import flow, workspace scanning state, and the fallback execution loop.
- `src/components/` contains the split-pane review UI, the execution view, the control deck, the workspace tree, and settings surface.
- `src/lib/runtime.ts` is the only frontend file that should know about Tauri `invoke()` or event listeners.
- `src/lib/workspaceImport.ts` owns browser-side workspace snapshots, `.gitignore` filtering, document detection, and text-file parsing.

## Backend Responsibilities
- `src-tauri/src/lib.rs` owns environment scans, document parsing, workspace walking, git diff retrieval, process-control state, and the simulated agent loop.
- The backend uses `ignore::WalkBuilder` to respect `.gitignore` while scanning an imported workspace.
- Tauri commands are the only allowed path for shell, file, and diff operations.

## Real Gaps To Keep In Mind
- `src/App.tsx`, `src/styles.css`, and `src-tauri/src/lib.rs` are the largest code hotspots and the first places that should be decomposed.
- `docs/SPEC.md` currently describes some tooling that is not present in `package.json`, so docs drift is already a live risk.
- There is no automated test suite or committed frontend formatter/linter yet.
- The frontend/browser fallback uses fake workspace and diff data for demo mode. Production logic must not depend on that data.
