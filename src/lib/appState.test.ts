import { describe, expect, it } from "vitest";
import type { EnvironmentStatus, ProjectContext } from "../types";
import {
  buildConfigPathDisplay,
  buildConfiguredModelProviders,
  buildCurrentProjectSettings,
  buildMcpItems, 
  buildWorkspaceNotice
} from "./appState";

function makeEnvironment(overrides?: Partial<Record<"claude" | "codex" | "git", Partial<EnvironmentStatus["claude"]>>>): EnvironmentStatus {
  return {
    scannedAt: new Date().toISOString(),
    claude: {
      name: "Claude CLI",
      status: "found",
      path: "/usr/bin/claude",
      detail: "Claude is available",
      ...overrides?.claude
    },
    codex: {
      name: "Codex CLI",
      status: "found",
      path: "/usr/bin/codex",
      detail: "Codex is available",
      ...overrides?.codex
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
      prdPromptTemplate: "Generate PRD",
      selectedModel: "gpt-5.4",
      selectedReasoning: "medium",
      specPromptTemplate: "Generate Spec",
      supportingDocumentPaths: ["docs/api.md"]
    });

    expect(result.selectedModel).toBe("gpt-5.4");
    expect(result.selectedReasoning).toBe("medium");
    expect(result.prdPath).toBe("docs/PRD.md");
    expect(result.specPath).toBe("docs/SPEC.md");
    expect(result.supportingDocumentPaths).toEqual(["docs/api.md"]);
  });

  it("uses default PRD path when configuredPrdPath is empty", () => {
    const result = buildCurrentProjectSettings({
      configuredPrdPath: "",
      configuredSpecPath: "",
      prdPromptTemplate: "prompt",
      selectedModel: "gpt-5.4",
      selectedReasoning: "medium",
      specPromptTemplate: "prompt",
      supportingDocumentPaths: []
    });

    expect(result.prdPath).toBe("docs/PRD.md");
    expect(result.specPath).toBe("docs/SPEC.md");
  });

  it("normalizes reasoning profile for the selected model", () => {
    const result = buildCurrentProjectSettings({
      configuredPrdPath: "docs/PRD.md",
      configuredSpecPath: "docs/SPEC.md",
      prdPromptTemplate: "prompt",
      selectedModel: "claude-3-5-sonnet-20241022",
      selectedReasoning: "max",
      specPromptTemplate: "prompt",
      supportingDocumentPaths: []
    });

    expect(result.selectedReasoning).toBe("low");
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
        selectedModel: "gpt-5.4",
        selectedReasoning: "medium",
        prdPrompt: "prompt",
        specPrompt: "prompt",
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
  it("returns both providers when both are found", () => {
    const providers = buildConfiguredModelProviders(makeEnvironment());
    expect(providers).toContain("claude");
    expect(providers).toContain("codex");
  });

  it("returns empty array when none are found", () => {
    const providers = buildConfiguredModelProviders(
      makeEnvironment({ claude: { status: "missing" }, codex: { status: "missing" } })
    );
    expect(providers).toEqual([]);
  });

  it("returns only claude when codex is missing", () => {
    const providers = buildConfiguredModelProviders(
      makeEnvironment({ codex: { status: "missing" } })
    );
    expect(providers).toEqual(["claude"]);
  });

  it("returns only codex when claude is missing", () => {
    const providers = buildConfiguredModelProviders(
      makeEnvironment({ claude: { status: "missing" } })
    );
    expect(providers).toEqual(["codex"]);
  });
});

describe("buildMcpItems", () => {
  it("returns three items for codex, claude, and git", () => {
    const items = buildMcpItems(makeEnvironment());
    expect(items).toHaveLength(3);
    expect(items[0].name).toBe("Codex CLI");
    expect(items[1].name).toBe("Claude CLI");
    expect(items[2].name).toBe("Git");
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
    expect(items[2].status).toBe("missing");
  });
});
