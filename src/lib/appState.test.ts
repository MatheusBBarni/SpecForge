import { describe, expect, it } from "vitest";
import type { EnvironmentStatus, ProjectContext } from "../types";
import {
  buildConfigPathDisplay,
  buildConfiguredModelProviders,
  buildCurrentProjectSettings,
  buildMcpItems, 
  buildWorkspaceNotice
} from "./appState";

function makeEnvironment(overrides?: Partial<Record<"cursor" | "git", Partial<EnvironmentStatus["cursor"]>>>): EnvironmentStatus {
  return {
    scannedAt: new Date().toISOString(),
    cursor: {
      name: "Cursor SDK",
      status: "found",
      path: null,
      detail: "Cursor API key is configured",
      ...overrides?.cursor
    },
    git: {
      name: "Git",
      status: "found",
      path: "/usr/bin/git",
      detail: "Git is available",
      ...overrides?.git
    }
  };
}

describe("buildCurrentProjectSettings", () => {
  it("returns normalized settings with provided values", () => {
    const result = buildCurrentProjectSettings({
      configuredPrdPath: "docs/PRD.md",
      configuredSpecPath: "docs/SPEC.md",
      prdAgentDescription: "Generate PRD",
      selectedModel: "composer-2",
      selectedReasoning: "medium",
      specAgentDescription: "Generate Spec",
      executionAgentDescription: "Execute Spec",
      supportingDocumentPaths: ["docs/api.md"]
    });

    expect(result.selectedModel).toBe("composer-2");
    expect(result.selectedReasoning).toBe("medium");
    expect(result.prdPath).toBe("docs/PRD.md");
    expect(result.specPath).toBe("docs/SPEC.md");
    expect(result.supportingDocumentPaths).toEqual(["docs/api.md"]);
  });

  it("uses default PRD path when configuredPrdPath is empty", () => {
    const result = buildCurrentProjectSettings({
      configuredPrdPath: "",
      configuredSpecPath: "",
      prdAgentDescription: "prompt",
      selectedModel: "composer-2",
      selectedReasoning: "medium",
      specAgentDescription: "prompt",
      executionAgentDescription: "prompt",
      supportingDocumentPaths: []
    });

    expect(result.prdPath).toBe("docs/PRD.md");
    expect(result.specPath).toBe("docs/SPEC.md");
  });

  it("normalizes reasoning profile for the selected model", () => {
    const result = buildCurrentProjectSettings({
      configuredPrdPath: "docs/PRD.md",
      configuredSpecPath: "docs/SPEC.md",
      prdAgentDescription: "prompt",
      selectedModel: "composer-2",
      selectedReasoning: "high",
      specAgentDescription: "prompt",
      executionAgentDescription: "prompt",
      supportingDocumentPaths: []
    });

    expect(result.selectedReasoning).toBe("high");
  });
});

describe("buildConfigPathDisplay", () => {
  it("returns workspace-relative display path when config path is set", () => {
    const result = buildConfigPathDisplay("/Users/me/myapp/.specforge/settings.json", "myapp");
    expect(result).toBe(".specforge/settings.json");
  });

  it("returns default settings relative path when config path is empty", () => {
    const result = buildConfigPathDisplay("", "myapp");
    expect(result).toBe(".specforge/settings.json");
  });

  it("returns default settings relative path for whitespace-only config path", () => {
    const result = buildConfigPathDisplay("   ", "myapp");
    expect(result).toBe(".specforge/settings.json");
  });

  it("handles config path without matching root name", () => {
    const result = buildConfigPathDisplay("/some/other/path/settings.json", "myapp");
    expect(result).toBe("/some/other/path/settings.json");
  });
});

describe("buildWorkspaceNotice", () => {
  function makeContext(overrides?: Partial<ProjectContext>): ProjectContext {
    return {
      rootName: "my-project",
      rootPath: "/Users/me/my-project",
      settingsPath: "/Users/me/my-project/.specforge/settings.json",
      hasSavedSettings: true,
      settings: {
        selectedModel: "composer-2",
        selectedReasoning: "medium",
        prdAgentDescription: "prompt",
        specAgentDescription: "prompt",
        executionAgentDescription: "prompt",
        prdPath: "docs/PRD.md",
        specPath: "docs/SPEC.md",
        supportingDocumentPaths: []
      },
      entries: [],
      ignoredFileCount: 0,
      prdDocument: null,
      specDocument: null,
      chatSessions: [],
      lastActiveSessionId: null,
      ...overrides
    };
  }

  it("shows 'no document exists' when no documents are loaded", () => {
    const notice = buildWorkspaceNotice(makeContext());
    expect(notice).toContain("my-project is configured");
    expect(notice).toContain("No document exists yet");
    expect(notice).toContain("docs/PRD.md");
    expect(notice).toContain("docs/SPEC.md");
  });

  it("lists PRD when only PRD is loaded", () => {
    const notice = buildWorkspaceNotice(
      makeContext({
        prdDocument: { content: "# PRD", sourcePath: "/path/PRD.md", fileName: "PRD.md" }
      })
    );
    expect(notice).toContain("PRD: PRD.md");
    expect(notice).not.toContain("SPEC:");
  });

  it("lists both PRD and SPEC when both are loaded", () => {
    const notice = buildWorkspaceNotice(
      makeContext({
        prdDocument: { content: "# PRD", sourcePath: "/path/PRD.md", fileName: "PRD.md" },
        specDocument: { content: "# SPEC", sourcePath: "/path/SPEC.md", fileName: "SPEC.md" }
      })
    );
    expect(notice).toContain("PRD: PRD.md");
    expect(notice).toContain("SPEC: SPEC.md");
    expect(notice).toContain(" and ");
  });

  it("uses the project root name in the notice", () => {
    const notice = buildWorkspaceNotice(makeContext({ rootName: "awesome-app" }));
    expect(notice).toContain("awesome-app is configured");
  });
});

describe("buildConfiguredModelProviders", () => {
  it("returns cursor when the Cursor API key is configured", () => {
    const providers = buildConfiguredModelProviders(
      makeEnvironment({ cursor: { status: "found" } })
    );
    expect(providers).toEqual(["cursor"]);
  });

  it("returns empty array when Cursor API key is missing", () => {
    const providers = buildConfiguredModelProviders(
      makeEnvironment({ cursor: { status: "missing" } })
    );
    expect(providers).toEqual([]);
  });
});

describe("buildMcpItems", () => {
  it("returns two items for Cursor and git", () => {
    const items = buildMcpItems(makeEnvironment());
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("Cursor SDK");
    expect(items[1].name).toBe("Git");
  });

  it("includes status and detail in each item", () => {
    const items = buildMcpItems(makeEnvironment());
    for (const item of items) {
      expect(item.status).toBeTruthy();
      expect(item.detail).toBeTruthy();
    }
  });

  it("reflects missing status", () => {
    const items = buildMcpItems(makeEnvironment({ git: { status: "missing" } }));
    expect(items[1].status).toBe("missing");
  });
});
