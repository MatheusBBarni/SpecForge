import type { ModelId, ModelProvider, ReasoningProfileId } from "../types";

export interface SelectOption<Value extends string> {
  value: Value;
  label: string;
  hint?: string;
}

interface AgentModelOption {
  id: ModelId;
  label: string;
  provider: ModelProvider;
  description: string;
  reasoningProfiles: ReasoningProfileId[];
}

const REASONING_COPY: Record<
  ReasoningProfileId,
  {
    label: string;
    description: string;
  }
> = {
  low: {
    label: "Low",
    description: "Fastest responses with minimal extra reasoning."
  },
  medium: {
    label: "Medium",
    description: "Balanced depth and latency for everyday work."
  },
  high: {
    label: "High",
    description: "Deeper reasoning for harder implementation or review tasks."
  },
  max: {
    label: "Max",
    description: "Maximum reasoning depth when accuracy matters more than speed."
  }
};

const FULL_REASONING_RANGE: ReasoningProfileId[] = ["low", "medium", "high", "max"];
const BASIC_REASONING_RANGE: ReasoningProfileId[] = ["low"];

export const DEFAULT_MODEL_ID: ModelId = "gpt-5.4";
export const DEFAULT_REASONING_PROFILE: ReasoningProfileId = "medium";

const AGENT_MODELS: AgentModelOption[] = [
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    provider: "codex",
    description: "Latest frontier Codex model for agentic coding.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    provider: "codex",
    description: "Smaller Codex model with the same reasoning controls at lower cost.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    provider: "codex",
    description: "Codex-optimized model for production coding flows.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-5.2",
    label: "GPT-5.2",
    provider: "codex",
    description: "Long-running Codex-compatible model for heavier professional workflows.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-opus-4-1-20250805",
    label: "Claude Opus 4.1",
    provider: "claude",
    description: "Anthropic's most capable Claude model with extended thinking.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-opus-4-20250514",
    label: "Claude Opus 4",
    provider: "claude",
    description: "High-end Claude model for advanced reasoning and coding.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    provider: "claude",
    description: "Balanced Claude 4 model with strong reasoning and efficiency.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-3-7-sonnet-20250219",
    label: "Claude Sonnet 3.7",
    provider: "claude",
    description: "Claude model with toggleable extended thinking.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-3-5-sonnet-20241022",
    label: "Claude Sonnet 3.5 v2",
    provider: "claude",
    description: "Updated Claude 3.5 Sonnet snapshot without extended thinking.",
    reasoningProfiles: BASIC_REASONING_RANGE
  },
  {
    id: "claude-3-5-sonnet-20240620",
    label: "Claude Sonnet 3.5",
    provider: "claude",
    description: "Earlier Claude 3.5 Sonnet snapshot without extended thinking.",
    reasoningProfiles: BASIC_REASONING_RANGE
  },
  {
    id: "claude-3-5-haiku-20241022",
    label: "Claude Haiku 3.5",
    provider: "claude",
    description: "Fast Claude model for lightweight tasks without extended thinking.",
    reasoningProfiles: BASIC_REASONING_RANGE
  },
  {
    id: "claude-3-haiku-20240307",
    label: "Claude Haiku 3",
    provider: "claude",
    description: "Legacy Claude Haiku snapshot for compact, low-latency work.",
    reasoningProfiles: BASIC_REASONING_RANGE
  }
];

export function getModelOptions(): Array<SelectOption<ModelId>> {
  return AGENT_MODELS.map((model) => ({
    value: model.id,
    label: model.label,
    hint: `${formatProvider(model.provider)} | ${model.description}`
  }));
}

export function getReasoningOptions(modelId: ModelId): Array<SelectOption<ReasoningProfileId>> {
  const model = getModelOption(modelId);

  return model.reasoningProfiles.map((profile) => ({
    value: profile,
    label: getReasoningLabel(modelId, profile),
    hint: getReasoningHint(modelId, profile)
  }));
}

export function getModelOption(modelId: ModelId) {
  return AGENT_MODELS.find((model) => model.id === modelId) ?? AGENT_MODELS[0];
}

export function getModelLabel(modelId: ModelId) {
  return getModelOption(modelId).label;
}

export function getReasoningLabel(modelId: ModelId, profile: ReasoningProfileId) {
  if (getModelOption(modelId).provider === "codex" && profile === "max") {
    return "Max (xhigh)";
  }

  return REASONING_COPY[profile].label;
}

export function getReasoningHint(modelId: ModelId, profile: ReasoningProfileId) {
  const model = getModelOption(modelId);
  const providerLabel = formatProvider(model.provider);

  if (model.provider === "codex" && profile === "max") {
    return `${providerLabel} | Maps to the deepest Codex reasoning tier.`;
  }

  if (model.provider === "claude" && model.reasoningProfiles.length === 1) {
    return `${providerLabel} | This model runs in its standard reasoning mode only.`;
  }

  return `${providerLabel} | ${REASONING_COPY[profile].description}`;
}

export function normalizeReasoningProfile(
  modelId: ModelId,
  profile: ReasoningProfileId
): ReasoningProfileId {
  const model = getModelOption(modelId);
  return model.reasoningProfiles.includes(profile) ? profile : model.reasoningProfiles[0];
}

function formatProvider(provider: ModelProvider) {
  return provider === "codex" ? "Codex" : "Claude";
}
