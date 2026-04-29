import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_ID,
  DEFAULT_REASONING_PROFILE, 
  getModelLabel,
  getModelOption,
  getModelOptions,
  getModelProvider,
  getProviderLabel,
  getReasoningHint,
  getReasoningLabel,
  getReasoningOptions,
  normalizeReasoningProfile
} from "./agentConfig";

describe("getModelLabel", () => {
  it("returns the label for a known Cursor model", () => {
    expect(getModelLabel("composer-2")).toBe("Composer 2");
  });

  it("returns the label for auto", () => {
    expect(getModelLabel("auto")).toBe("Auto");
  });

  it("falls back to the first model for an unknown model id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const label = getModelLabel("nonexistent-model" as any);
    expect(label).toBe("Composer 2");
  });
});

describe("getModelProvider", () => {
  it("returns cursor for Cursor models", () => {
    expect(getModelProvider("composer-2")).toBe("cursor");
  });

  it("falls back to the first model's provider for unknown id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getModelProvider("unknown" as any)).toBe("cursor");
  });
});

describe("getModelOption", () => {
  it("returns the full model option for a valid id", () => {
    const option = getModelOption("composer-2");
    expect(option.id).toBe("composer-2");
    expect(option.provider).toBe("cursor");
    expect(option.label).toBe("Composer 2");
  });

  it("returns the first model as fallback for unknown id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const option = getModelOption("fake" as any);
    expect(option.id).toBe("composer-2");
  });
});

describe("getModelOptions", () => {
  it("returns all models when no provider is given", () => {
    const options = getModelOptions();
    expect(options.length).toBeGreaterThan(0);
    const ids = options.map((o) => o.value);
    expect(ids).toContain("composer-2");
    expect(ids).toContain("auto");
  });

  it("returns only Cursor models when filtered by cursor", () => {
    const options = getModelOptions("cursor");
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt.hint).toMatch(/^Cursor/);
    }
  });

  it("returns options with label and hint", () => {
    const options = getModelOptions();
    for (const opt of options) {
      expect(opt.label).toBeTruthy();
      expect(opt.hint).toBeTruthy();
    }
  });
});

describe("getReasoningLabel", () => {
  it("returns 'Medium' for a standard medium profile", () => {
    expect(getReasoningLabel("composer-2", "medium")).toBe("Medium");
  });

  it("returns 'Max' for Cursor model with max profile", () => {
    expect(getReasoningLabel("composer-2", "max")).toBe("Max");
  });

  it("returns 'Low' for low profile", () => {
    expect(getReasoningLabel("composer-2", "low")).toBe("Low");
  });
});

describe("getReasoningHint", () => {
  it("returns description-based hint for Cursor model", () => {
    const hint = getReasoningHint("composer-2", "medium");
    expect(hint).toContain("Cursor");
    expect(hint).toContain("Balanced");
  });
});

describe("getReasoningOptions", () => {
  it("returns full range for a Cursor model", () => {
    const options = getReasoningOptions("composer-2");
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.value)).toEqual(["low", "medium", "high", "max"]);
  });

  it("each option has a label and hint", () => {
    const options = getReasoningOptions("composer-2");
    for (const opt of options) {
      expect(opt.label).toBeTruthy();
      expect(opt.hint).toBeTruthy();
    }
  });
});

describe("normalizeReasoningProfile", () => {
  it("returns the profile when it is valid for the model", () => {
    expect(normalizeReasoningProfile("composer-2", "high")).toBe("high");
  });

  it("returns the default profile for invalid profile values", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeReasoningProfile("composer-2", "invalid" as any)).toBe("medium");
  });
});

describe("getProviderLabel", () => {
  it("returns 'Cursor' for cursor provider", () => {
    expect(getProviderLabel("cursor")).toBe("Cursor");
  });
});

describe("DEFAULT exports", () => {
  it("DEFAULT_MODEL_ID is composer-2", () => {
    expect(DEFAULT_MODEL_ID).toBe("composer-2");
  });

  it("DEFAULT_REASONING_PROFILE is medium", () => {
    expect(DEFAULT_REASONING_PROFILE).toBe("medium");
  });
});
