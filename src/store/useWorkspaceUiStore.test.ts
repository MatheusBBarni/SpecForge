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
