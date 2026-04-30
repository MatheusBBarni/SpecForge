# Review State Zustand Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move review workspace state from `App.tsx` into Zustand and simplify `PrdScreen.tsx` and its component wiring.

**Architecture:** Add `useWorkspaceUiStore` for non-persisted review shell state, then update hooks to read/write that store instead of receiving setters from `App.tsx`. Keep Cursor SDK runners because Tauri uses them as the Bun/TypeScript bridge to `@cursor/sdk`.

**Tech Stack:** React 19, Zustand 5, TypeScript, Vitest, Tauri command bridge, Cursor SDK.

---

### Task 1: Workspace UI Store

**Files:**
- Create: `src/store/useWorkspaceUiStore.ts`
- Create: `src/store/useWorkspaceUiStore.test.ts`
- Modify: `src/hooks/useAppStoreSlices.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PENDING_DIFF } from "../lib/runtime";
import { useWorkspaceUiStore } from "./useWorkspaceUiStore";

describe("useWorkspaceUiStore", () => {
  beforeEach(() => {
    useWorkspaceUiStore.getState().resetWorkspaceUi();
  });

  it("resets transient generation and workspace state", () => {
    useWorkspaceUiStore.setState({
      commandSearch: "abc",
      prdGenerationPrompt: "make PRD",
      prdGenerationError: "bad",
      specGenerationPrompt: "make spec",
      specGenerationError: "bad spec",
      workspaceNotice: "notice",
      projectRootName: "Repo",
      projectRootPath: "C:/Repo",
      hasSelectedProject: true
    });

    useWorkspaceUiStore.getState().resetWorkspaceUi();

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      commandSearch: "",
      prdGenerationPrompt: "",
      prdGenerationError: "",
      specGenerationPrompt: "",
      specGenerationError: "",
      workspaceNotice: "Finish the setup flow to load a project workspace.",
      projectRootName: "No project selected",
      projectRootPath: "",
      hasSelectedProject: false
    });
  });

  it("stores loaded project shell metadata together", () => {
    useWorkspaceUiStore.getState().setProjectShell({
      rootName: "SpecForge",
      rootPath: "C:/repo",
      configPath: ".specforge/project.json",
      hasSelectedProject: true,
      hasSavedProjectSettings: true
    });

    expect(useWorkspaceUiStore.getState()).toMatchObject({
      projectRootName: "SpecForge",
      projectRootPath: "C:/repo",
      projectConfigPath: ".specforge/project.json",
      hasSelectedProject: true,
      hasSavedProjectSettings: true
    });
  });

  it("restores latest diff to the runtime fallback", () => {
    useWorkspaceUiStore.getState().setLatestDiff("diff --git a/file b/file");
    useWorkspaceUiStore.getState().resetLatestDiff();

    expect(useWorkspaceUiStore.getState().latestDiff).toBe(DEFAULT_PENDING_DIFF);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/store/useWorkspaceUiStore.test.ts`

Expected: FAIL because `useWorkspaceUiStore` does not exist.

- [ ] **Step 3: Implement store and slice export**

Create the store with explicit setter actions for each state group and export `useWorkspaceUiStoreSlice()` from `useAppStoreSlices.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/store/useWorkspaceUiStore.test.ts`

Expected: PASS.

### Task 2: Migrate App Hook Inputs

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/useAppView.ts`
- Modify: `src/hooks/useAppUiHandlers.ts`
- Modify: `src/hooks/useDocumentHandlers.ts`
- Modify: `src/hooks/useProjectHandlers.ts`
- Modify: `src/hooks/useAppScreenProps.ts`

- [ ] **Step 1: Update hook option types**

Replace individual prompt/error/project-root/search/cursor-model/external-editor props with `workspaceUiState` where those values are needed.

- [ ] **Step 2: Update call sites**

Use `workspaceUiState` actions in `App.tsx` for diagnostics, project restore, document generation, and workspace file opening.

- [ ] **Step 3: Remove migrated `useState` calls**

Delete app-local state for command search, import/project loading, latest diff, project root/config/status/error, workspace notice, external editors, cursor models, saved/selected/restore flags, workspace file lookup, and generation prompt/error.

- [ ] **Step 4: Run tests**

Run: `bun run test`

Expected: PASS.

### Task 3: Simplify Review Screen Wiring

**Files:**
- Modify: `src/screens/PrdScreen.tsx`
- Modify: `src/hooks/useAppScreenProps.ts`

- [ ] **Step 1: Reduce `PrdScreenProps`**

Keep only callbacks/refs that are naturally owned by `App.tsx`: `onOpenChat`, `onRefresh`, `searchInputRef`, and the three child prop bags as an interim boundary.

- [ ] **Step 2: Move topbar state selection into `PrdScreen`**

Read agent status, workspace root name, model settings, Cursor models, and configured providers from stores/derived props so `ReviewTopBar` no longer depends on `controlColumnProps`.

- [ ] **Step 3: Run build**

Run: `bun run build`

Expected: PASS.

### Task 4: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run frontend test suite**

Run: `bun run test`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `bun run build`

Expected: PASS.

- [ ] **Step 3: Review Cursor runner usage**

Run: `Select-String -Path 'src-tauri/src/cursor_agent.rs','src/cursorAgentRunner.ts','src/cursorModelsRunner.ts' -Pattern 'Agent.create|Cursor.models.list|cursorAgentRunner|cursorModelsRunner'`

Expected: Output shows Rust commands invoking the TypeScript runners and runners using documented Cursor SDK APIs.
