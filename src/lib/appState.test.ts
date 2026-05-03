import { describe, expect, it } from "vitest";
import type { EnvironmentStatus, ProjectContext } from "../types";
import {
  buildConfigPathDisplay,
  buildConfiguredModelProviders,
  buildCurrentProjectSettings,
  buildMcpItems, 
  buildWorkspaceNotice
} from "./appState";

function makeEnvironment(overrides?: Partial<Record<"cursor" | "codex" | "docker" | "git", Partial<EnvironmentStatus["cursor"]>>>): EnvironmentStatus {
  return {
    scannedAt: new Date().toISOString(),
    cursor: {
      name: "Codex Provider",
      status: "found",
      path: null,
      detail: "Codex authentication is configured",
      ...overrides?.cursor
    },
    codex: {
      name: "Codex CLI",
      status: "found",
      path: "/usr/bin/codex",
      detail: "Codex CLI is available",
      ...overrides?.codex
    },
    docker: {
      name: "Docker",
      status: "found",
      path: "/usr/bin/docker",
      detail: "Docker daemon is reachable",
      ...overrides?.docker
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
      providerAuthMode: "subscription",
      selectedModel: "gpt-5.2",
      selectedReasoning: "medium",
      specAgentDescription: "Generate Spec",
      executionAgentDescription: "Execute Spec",
      supportingDocumentPaths: ["docs/api.md"]
    });

    expect(result.selectedModel).toBe("gpt-5.2");
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
      providerAuthMode: "subscription",
      selectedModel: "gpt-5.2",
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
      providerAuthMode: "subscription",
      selectedModel: "gpt-5.2",
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
        agentProvider: "codex",
        providerAuthMode: "subscription",
        selectedModel: "gpt-5.2",
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
      prdPreview: null,
      specPreview: null,
      chatSessions: [],
      lastActiveSessionId: null,
      ...overrides
    };
  }

  it("stays empty after a project context loads", () => {
    expect(buildWorkspaceNotice(makeContext())).toBe("");
  });

  it("stays empty when only PRD is loaded", () => {
    const notice = buildWorkspaceNotice(
      makeContext({
        prdDocument: { content: "# PRD", sourcePath: "/path/PRD.md", fileName: "PRD.md" }
      })
    );
    expect(notice).toBe("");
  });

  it("stays empty when both PRD and SPEC are loaded", () => {
    const notice = buildWorkspaceNotice(
      makeContext({
        prdDocument: { content: "# PRD", sourcePath: "/path/PRD.md", fileName: "PRD.md" },
        specDocument: { content: "# SPEC", sourcePath: "/path/SPEC.md", fileName: "SPEC.md" }
      })
    );
    expect(notice).toBe("");
  });
});

describe("buildConfiguredModelProviders", () => {
  it("returns codex when Codex authentication is configured", () => {
    const providers = buildConfiguredModelProviders(
      makeEnvironment({ cursor: { status: "found" } })
    );
    expect(providers).toEqual(["codex"]);
  });

  it("returns empty array when Codex authentication is missing", () => {
    const providers = buildConfiguredModelProviders(
      makeEnvironment({ cursor: { status: "missing" } })
    );
    expect(providers).toEqual([]);
  });
});

describe("buildMcpItems", () => {
  it("returns readiness items for Codex, Docker, and git", () => {
    const items = buildMcpItems(makeEnvironment());
    expect(items).toHaveLength(4);
    expect(items[0].name).toBe("Codex Provider");
    expect(items[1].name).toBe("Codex CLI");
    expect(items[2].name).toBe("Docker");
    expect(items[3].name).toBe("Git");
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
    expect(items[3].status).toBe("missing");
  });

  it("reflects unavailable status for installed tools that are not reachable", () => {
    const items = buildMcpItems(makeEnvironment({ docker: { status: "unavailable" } }));
    expect(items[2].status).toBe("unavailable");
  });
});
