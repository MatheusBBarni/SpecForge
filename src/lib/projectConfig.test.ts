import { describe, expect, it } from "vitest";
import {
  buildDefaultProjectSettings,
  DEFAULT_PROJECT_PRD_PATH,
  DEFAULT_PROJECT_SPEC_PATH, 
  formatSupportingDocumentPaths,
  getWorkspaceDisplayPath,
  normalizeProjectRelativePath,
  normalizeProjectSettings,
  normalizeSupportingDocumentPaths,
  parseSupportingDocumentPaths,
  SPECFORGE_DIRECTORY_NAME,
  SPECFORGE_SETTINGS_FILE_NAME,
  SPECFORGE_SETTINGS_RELATIVE_PATH
} from "./projectConfig";

describe("normalizeProjectRelativePath", () => {
  it("trims whitespace and normalizes slashes", () => {
    expect(normalizeProjectRelativePath("  docs\\PRD.md  ")).toBe("docs/PRD.md");
  });

  it("strips leading slashes", () => {
    expect(normalizeProjectRelativePath("///docs/PRD.md")).toBe("docs/PRD.md");
  });

  it("returns empty string for null or undefined", () => {
    expect(normalizeProjectRelativePath(null)).toBe("");
    expect(normalizeProjectRelativePath(undefined)).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeProjectRelativePath("   ")).toBe("");
  });

  it("handles a simple filename without directory", () => {
    expect(normalizeProjectRelativePath("README.md")).toBe("README.md");
  });
});

describe("normalizeSupportingDocumentPaths", () => {
  it("normalizes each path in the array", () => {
    const result = normalizeSupportingDocumentPaths(["  docs\\a.md ", "/b.md"]);
    expect(result).toEqual(["docs/a.md", "b.md"]);
  });

  it("removes empty entries", () => {
    const result = normalizeSupportingDocumentPaths(["a.md", "", "  ", "b.md"]);
    expect(result).toEqual(["a.md", "b.md"]);
  });

  it("removes duplicates", () => {
    const result = normalizeSupportingDocumentPaths(["a.md", "a.md", "b.md"]);
    expect(result).toEqual(["a.md", "b.md"]);
  });

  it("returns empty array for null or undefined", () => {
    expect(normalizeSupportingDocumentPaths(null)).toEqual([]);
    expect(normalizeSupportingDocumentPaths(undefined)).toEqual([]);
  });

  it("returns empty array for empty array input", () => {
    expect(normalizeSupportingDocumentPaths([])).toEqual([]);
  });
});

describe("formatSupportingDocumentPaths", () => {
  it("joins paths with newlines", () => {
    expect(formatSupportingDocumentPaths(["a.md", "b.md"])).toBe("a.md\nb.md");
  });

  it("returns empty string for empty array", () => {
    expect(formatSupportingDocumentPaths([])).toBe("");
  });

  it("returns single path without newline for one-element array", () => {
    expect(formatSupportingDocumentPaths(["only.md"])).toBe("only.md");
  });
});

describe("parseSupportingDocumentPaths", () => {
  it("splits on newlines and normalizes", () => {
    const result = parseSupportingDocumentPaths("a.md\nb.md\nc.md");
    expect(result).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("handles Windows-style line endings", () => {
    const result = parseSupportingDocumentPaths("a.md\r\nb.md");
    expect(result).toEqual(["a.md", "b.md"]);
  });

  it("filters empty lines", () => {
    const result = parseSupportingDocumentPaths("a.md\n\n\nb.md");
    expect(result).toEqual(["a.md", "b.md"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseSupportingDocumentPaths("")).toEqual([]);
  });

  it("deduplicates paths", () => {
    const result = parseSupportingDocumentPaths("a.md\na.md\nb.md");
    expect(result).toEqual(["a.md", "b.md"]);
  });
});

describe("buildDefaultProjectSettings", () => {
  it("returns expected default values", () => {
    const settings = buildDefaultProjectSettings();
    expect(settings.selectedModel).toBe("composer-2");
    expect(settings.selectedReasoning).toBe("medium");
    expect(settings.prdPath).toBe("docs/PRD.md");
    expect(settings.specPath).toBe("docs/SPEC.md");
    expect(settings.supportingDocumentPaths).toEqual([]);
  });

  it("returns agent descriptions that are non-empty strings", () => {
    const settings = buildDefaultProjectSettings();
    expect(settings.prdAgentDescription.length).toBeGreaterThan(0);
    expect(settings.specAgentDescription.length).toBeGreaterThan(0);
    expect(settings.executionAgentDescription.length).toBeGreaterThan(0);
  });
});

describe("normalizeProjectSettings", () => {
  it("returns defaults when given null", () => {
    const result = normalizeProjectSettings(null);
    const defaults = buildDefaultProjectSettings();
    expect(result).toEqual(defaults);
  });

  it("returns defaults when given undefined", () => {
    const result = normalizeProjectSettings(undefined);
    const defaults = buildDefaultProjectSettings();
    expect(result).toEqual(defaults);
  });

  it("preserves valid overrides", () => {
    const result = normalizeProjectSettings({
      selectedModel: "composer-2",
      selectedReasoning: "high",
      prdPath: "custom/PRD.md",
      specPath: "custom/SPEC.md"
    });
    expect(result.selectedModel).toBe("composer-2");
    expect(result.selectedReasoning).toBe("high");
    expect(result.prdPath).toBe("custom/PRD.md");
    expect(result.specPath).toBe("custom/SPEC.md");
  });

  it("normalizes invalid model to default", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = normalizeProjectSettings({ selectedModel: "bad-model" as any });
    expect(result.selectedModel).toBe("composer-2");
  });

  it("migrates legacy prompt fields into agent descriptions", () => {
    const result = normalizeProjectSettings({
      prdPrompt: "Legacy PRD prompt",
      specPrompt: "Legacy spec prompt"
    });
    expect(result.prdAgentDescription).toBe("Legacy PRD prompt");
    expect(result.specAgentDescription).toBe("Legacy spec prompt");
  });

  it("preserves execution agent description overrides", () => {
    const result = normalizeProjectSettings({
      executionAgentDescription: "Execute from the approved spec only."
    });
    expect(result.executionAgentDescription).toBe("Execute from the approved spec only.");
  });
});

describe("getWorkspaceDisplayPath", () => {
  it("strips prefix up to workspace root name", () => {
    const result = getWorkspaceDisplayPath("/Users/me/projects/myapp/src/file.ts", "myapp");
    expect(result).toBe("src/file.ts");
  });

  it("returns normalized path when root name is not provided", () => {
    const result = getWorkspaceDisplayPath("/Users/me/projects/myapp/src/file.ts");
    expect(result).toBe("/Users/me/projects/myapp/src/file.ts");
  });

  it("returns normalized path when root name is not found", () => {
    const result = getWorkspaceDisplayPath("/some/path/file.ts", "notfound");
    expect(result).toBe("/some/path/file.ts");
  });

  it("handles Windows UNC-style paths", () => {
    const result = getWorkspaceDisplayPath("//?/C:\\Users\\me\\myapp\\src\\file.ts", "myapp");
    expect(result).toBe("src/file.ts");
  });

  it("is case-insensitive for root name matching", () => {
    const result = getWorkspaceDisplayPath("/Users/me/MyApp/src/file.ts", "myapp");
    expect(result).toBe("src/file.ts");
  });
});

describe("constants", () => {
  it("SPECFORGE_DIRECTORY_NAME is .specforge", () => {
    expect(SPECFORGE_DIRECTORY_NAME).toBe(".specforge");
  });

  it("SPECFORGE_SETTINGS_FILE_NAME is settings.json", () => {
    expect(SPECFORGE_SETTINGS_FILE_NAME).toBe("settings.json");
  });

  it("SPECFORGE_SETTINGS_RELATIVE_PATH is correct", () => {
    expect(SPECFORGE_SETTINGS_RELATIVE_PATH).toBe(".specforge/settings.json");
  });

  it("DEFAULT_PROJECT_PRD_PATH is docs/PRD.md", () => {
    expect(DEFAULT_PROJECT_PRD_PATH).toBe("docs/PRD.md");
  });

  it("DEFAULT_PROJECT_SPEC_PATH is docs/SPEC.md", () => {
    expect(DEFAULT_PROJECT_SPEC_PATH).toBe("docs/SPEC.md");
  });
});
