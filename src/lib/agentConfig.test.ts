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
  it("returns the label for a known codex model", () => {
    expect(getModelLabel("gpt-5.4")).toBe("GPT-5.4");
  });

  it("returns the label for a known claude model", () => {
    expect(getModelLabel("claude-sonnet-4-20250514")).toBe("Claude Sonnet 4");
  });

  it("returns the label for gpt-5.4-mini", () => {
    expect(getModelLabel("gpt-5.4-mini")).toBe("GPT-5.4 Mini");
  });

  it("falls back to the first model for an unknown model id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const label = getModelLabel("nonexistent-model" as any);
    expect(label).toBe("GPT-5.4");
  });
});

describe("getModelProvider", () => {
  it("returns 'codex' for a codex model", () => {
    expect(getModelProvider("gpt-5.4")).toBe("codex");
  });

  it("returns 'claude' for a claude model", () => {
    expect(getModelProvider("claude-opus-4-20250514")).toBe("claude");
  });

  it("falls back to the first model's provider for unknown id", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getModelProvider("unknown" as any)).toBe("codex");
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const option = getModelOption("fake" as any);
    expect(option.id).toBe("gpt-5.4");
  });
});

describe("getModelOptions", () => {
  it("returns all models when no provider is given", () => {
    const options = getModelOptions();
    expect(options.length).toBeGreaterThan(0);
    const ids = options.map((o) => o.value);
    expect(ids).toContain("gpt-5.4");
    expect(ids).toContain("claude-opus-4-20250514");
  });

  it("returns only codex models when filtered by codex", () => {
    const options = getModelOptions("codex");
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt.hint).toMatch(/^Codex/);
    }
  });

  it("returns only claude models when filtered by claude", () => {
    const options = getModelOptions("claude");
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt.hint).toMatch(/^Claude/);
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
    expect(getReasoningLabel("claude-opus-4-20250514", "medium")).toBe("Medium");
  });

  it("returns 'Max (xhigh)' for codex model with max profile", () => {
    expect(getReasoningLabel("gpt-5.4", "max")).toBe("Max (xhigh)");
  });

  it("returns 'Max' for claude model with max profile", () => {
    expect(getReasoningLabel("claude-opus-4-20250514", "max")).toBe("Max");
  });

  it("returns 'Low' for low profile", () => {
    expect(getReasoningLabel("gpt-5.4", "low")).toBe("Low");
  });
});

describe("getReasoningHint", () => {
  it("returns deepest Codex tier hint for codex max", () => {
    const hint = getReasoningHint("gpt-5.4", "max");
    expect(hint).toContain("Codex");
    expect(hint).toContain("deepest");
  });

  it("returns standard mode hint for claude model with only basic reasoning", () => {
    const hint = getReasoningHint("claude-3-5-sonnet-20241022", "low");
    expect(hint).toContain("standard reasoning mode only");
  });

  it("returns description-based hint for claude model with full reasoning", () => {
    const hint = getReasoningHint("claude-opus-4-20250514", "medium");
    expect(hint).toContain("Claude");
    expect(hint).toContain("Balanced");
  });
});

describe("getReasoningOptions", () => {
  it("returns full range for a codex model", () => {
    const options = getReasoningOptions("gpt-5.4");
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.value)).toEqual(["low", "medium", "high", "max"]);
  });

  it("returns basic range for a claude model without extended thinking", () => {
    const options = getReasoningOptions("claude-3-5-sonnet-20241022");
    expect(options).toHaveLength(1);
    expect(options[0].value).toBe("low");
  });

  it("each option has a label and hint", () => {
    const options = getReasoningOptions("gpt-5.4");
    for (const opt of options) {
      expect(opt.label).toBeTruthy();
      expect(opt.hint).toBeTruthy();
    }
  });
});

describe("normalizeReasoningProfile", () => {
  it("returns the profile when it is valid for the model", () => {
    expect(normalizeReasoningProfile("gpt-5.4", "high")).toBe("high");
  });

  it("falls back to the first profile when invalid for the model", () => {
    expect(normalizeReasoningProfile("claude-3-5-sonnet-20241022", "max")).toBe("low");
  });

  it("returns low for basic-reasoning claude model with medium", () => {
    expect(normalizeReasoningProfile("claude-3-haiku-20240307", "medium")).toBe("low");
  });
});

describe("getProviderLabel", () => {
  it("returns 'Codex' for codex provider", () => {
    expect(getProviderLabel("codex")).toBe("Codex");
  });

  it("returns 'Claude' for claude provider", () => {
    expect(getProviderLabel("claude")).toBe("Claude");
  });
});

describe("DEFAULT exports", () => {
  it("DEFAULT_MODEL_ID is gpt-5.4", () => {
    expect(DEFAULT_MODEL_ID).toBe("gpt-5.4");
  });

  it("DEFAULT_REASONING_PROFILE is medium", () => {
    expect(DEFAULT_REASONING_PROFILE).toBe("medium");
  });
});
