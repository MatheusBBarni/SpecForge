# Frontend Scope

## Commands
- `bun run build`

## Always
- MUST keep all Tauri `invoke` and event wiring in `src/lib/runtime.ts`.
- MUST keep shared payload changes synchronized with `src-tauri/src/lib.rs` and `src/types.ts`.
- MUST preserve the current `startTransition`, `useDeferredValue`, and store-driven orchestration patterns unless you are intentionally simplifying them.
- MUST keep the startup PRD/spec load pointed at `../docs/PRD.md?raw` and `../docs/SPEC.md?raw` unless product behavior changes.

## Ask First
- Ask before changing the default model list, theme defaults, or the review-to-execute workspace flow.
- Ask before replacing HeroUI primitives or adding another client-state layer.

## Never
- NEVER bypass `isTauriRuntime()` guards when adding new desktop calls.
- NEVER move shell, git, or filesystem logic into React components.

## Landmines
- `src/App.tsx` already owns routing, imports, keyboard shortcuts, workspace scan state, fallback execution, and theme handling. Extract helpers instead of adding more branches there.
- `src/lib/runtime.ts` deliberately exposes fake diff/workspace data outside Tauri so the UI can demo in the browser. MUST treat that path as demo-only execution.
- The workspace import flow depends on `.gitignore` filtering and the text-file allowlists in `workspaceImport.ts` and `App.tsx`; keep those behaviors aligned.
