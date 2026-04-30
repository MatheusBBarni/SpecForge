# Review State Zustand Refactor Design

## Goal

Move review-screen UI state out of `App.tsx` into Zustand and reduce `PrdScreen.tsx` from a prop-bag pass-through into a store-backed review shell.

## Architecture

Add a focused workspace UI store for project shell metadata, generation form state, search state, Cursor model metadata, external editor metadata, notices, and browser/desktop workspace file lookup. Keep persisted project document data in `useProjectStore`, execution runtime in `useAgentStore`, and saved settings in `useSettingsStore`.

`App.tsx` remains responsible for route selection, refs needed by DOM/file pickers, subscriptions, and top-level async orchestration. Review screen components subscribe to the store slices they render with `useShallow`, matching Zustand guidance and reducing prop drilling.

## Cursor SDK Runners

Keep `src/cursorAgentRunner.ts` and `src/cursorModelsRunner.ts`. They are the documented TypeScript SDK bridge used by Tauri Rust commands, since Rust cannot import `@cursor/sdk` directly. The runner code should stay thin and aligned with Cursor SDK docs: `Agent.create`, `agent.send`, `run.stream`, `run.wait`, and `Cursor.models.list`.

## State Ownership

- `useProjectStore`: PRD/spec content, configured paths, model/reasoning/autonomy settings, active review tab, pane modes, editor tabs.
- `useAgentStore`: execution status, terminal output, pending diff, execution summary.
- `useSettingsStore`: theme, Cursor key input, persisted recent projects, environment scan, workspace entries.
- New `useWorkspaceUiStore`: command search, search open flag, import/project loading flags, latest diff, root metadata, project status/error messages, workspace notice, external editors, Cursor models, saved/selected/restore flags, workspace file lookup, PRD/spec generation prompt/error state.

## UI Flow

`PrdScreen` reads its own search/topbar state from stores and renders:

- `ReviewTopBar`: status, workspace root name, model/reasoning/mode controls, refresh and chat actions.
- `MainWorkspace`: kept initially as a presentational component but fed by a small review container instead of `App.tsx`.
- `InspectorColumn`: fed by a workspace inspector container using store selectors.

## Testing

Add unit tests for the new store reset/project metadata/generation state actions first. Then run the existing focused tests and full build. Because this is a refactor, UI behavior should remain unchanged.
