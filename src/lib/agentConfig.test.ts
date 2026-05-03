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
  normalizeModelId,
  normalizeReasoningProfile
} from "./agentConfig";

describe("getModelLabel", () => {
  it("returns the label for the default Codex model", () => {
    expect(getModelLabel("gpt-5.2")).toBe("GPT-5.2");
  });

  it("returns the label for auto", () => {
    expect(getModelLabel("auto")).toBe("Auto");
  });

  it("falls back to the first model for an unknown model id", () => {
    const label = getModelLabel("nonexistent-model");
    expect(label).toBe("GPT-5.2");
  });
});

describe("getModelProvider", () => {
  it("returns codex for Codex models", () => {
    expect(getModelProvider("gpt-5.2")).toBe("codex");
  });

  it("falls back to the first model's provider for unknown id", () => {
    expect(getModelProvider("unknown")).toBe("codex");
  });
});

describe("getModelOption", () => {
  it("returns the full model option for a valid id", () => {
    const option = getModelOption("gpt-5.2");
    expect(option.id).toBe("gpt-5.2");
    expect(option.provider).toBe("codex");
    expect(option.label).toBe("GPT-5.2");
  });

  it("returns the first model as fallback for unknown id", () => {
    const option = getModelOption("fake");
    expect(option.id).toBe("gpt-5.2");
  });
});

describe("getModelOptions", () => {
  it("returns all models when no provider is given", () => {
    const options = getModelOptions();
    expect(options.length).toBeGreaterThan(0);
    const ids = options.map((o) => o.value);
    expect(ids).toContain("gpt-5.2");
    expect(ids).toContain("auto");
  });

  it("returns only Codex models when filtered by codex", () => {
    const options = getModelOptions("codex");
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt.hint).toMatch(/^Codex/);
    }
  });

  it("returns options with label and hint", () => {
    const options = getModelOptions();
    for (const opt of options) {
      expect(opt.label).toBeTruthy();
      expect(opt.hint).toBeTruthy();
    }
  });

  it("formats discovered Codex model labels like the static model list", () => {
    const options = getModelOptions(undefined, [
      {
        id: "gpt-5.4-mini",
        label: "",
        parameters: []
      }
    ]);

    expect(options[0]?.label).toBe("GPT-5.4 Mini");
  });
});

describe("getReasoningLabel", () => {
  it("returns 'Medium' for a standard medium profile", () => {
    expect(getReasoningLabel("composer-2", "medium")).toBe("Medium");
  });

  it("returns 'Extra High' for Codex model with xhigh profile", () => {
    expect(getReasoningLabel("gpt-5.2", "xhigh")).toBe("Extra High");
  });

  it("returns 'Low' for low profile", () => {
    expect(getReasoningLabel("composer-2", "low")).toBe("Low");
  });
});

describe("getReasoningHint", () => {
  it("returns description-based hint for Codex model", () => {
    const hint = getReasoningHint("gpt-5.2", "medium");
    expect(hint).toContain("Codex");
    expect(hint).toContain("Balanced");
  });
});

describe("getReasoningOptions", () => {
  it("returns full range for a Codex model", () => {
    const options = getReasoningOptions("gpt-5.2");
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.value)).toEqual(["low", "medium", "high", "xhigh"]);
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
    expect(normalizeReasoningProfile("gpt-5.2", "high")).toBe("high");
  });

  it("returns the default profile for invalid profile values", () => {
    expect(normalizeReasoningProfile("gpt-5.2", "invalid")).toBe("medium");
  });

  it("preserves account-specific profile values for dynamic model ids", () => {
    expect(normalizeReasoningProfile("account-model", "thinking")).toBe("thinking");
  });

  it("uses the default profile for blank dynamic profile values", () => {
    expect(normalizeReasoningProfile("account-model", " ")).toBe("medium");
  });
});

describe("normalizeModelId", () => {
  it("preserves account-specific Codex model ids", () => {
    expect(normalizeModelId("account-model")).toBe("account-model");
  });

  it("trims model ids before persisting settings", () => {
    expect(normalizeModelId("  account-model  ")).toBe("account-model");
  });

  it("uses the default model for empty values", () => {
    expect(normalizeModelId(" ")).toBe("gpt-5.2");
    expect(normalizeModelId(null)).toBe("gpt-5.2");
  });
});

describe("getProviderLabel", () => {
  it("returns 'Codex' for codex provider", () => {
    expect(getProviderLabel("codex")).toBe("Codex");
  });
});

describe("DEFAULT exports", () => {
  it("DEFAULT_MODEL_ID is gpt-5.2", () => {
    expect(DEFAULT_MODEL_ID).toBe("gpt-5.2");
  });

  it("DEFAULT_REASONING_PROFILE is medium", () => {
    expect(DEFAULT_REASONING_PROFILE).toBe("medium");
  });
});
