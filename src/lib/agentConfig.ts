import type { CursorModel, ModelId, ModelProvider, ReasoningProfileId } from "../types";

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

const REASONING_COPY: Partial<Record<
  ReasoningProfileId,
  {
    label: string;
    description: string;
  }
>> = {
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
  },
  xhigh: {
    label: "Extra High",
    description: "Extra high reasoning for complex Codex turns."
  },
  thinking: {
    label: "Thinking",
    description: "Use the model's explicit reasoning/thinking mode when available."
  },
  normal: {
    label: "Normal",
    description: "Use the model's standard mode."
  }
};

const FULL_REASONING_RANGE: ReasoningProfileId[] = ["low", "medium", "high", "xhigh"];

export const DEFAULT_MODEL_ID: ModelId = "gpt-5.2";
export const DEFAULT_REASONING_PROFILE: ReasoningProfileId = "medium";

const AGENT_MODELS: AgentModelOption[] = [
  {
    id: "auto",
    label: "Auto",
    provider: "codex",
    description: "Let Codex choose the best available model for the request.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-5.2",
    label: "GPT-5.2",
    provider: "codex",
    description: "Codex default model for product, spec, and implementation workflows.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    provider: "codex",
    description: "Stronger Codex model for everyday coding work.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    provider: "codex",
    description: "Fast Codex model for smaller edits and review turns.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    provider: "codex",
    description: "Coding-optimized Codex model.",
    reasoningProfiles: FULL_REASONING_RANGE
  }
];

export function getModelOptions(
  provider?: ModelProvider,
  cursorModels: CursorModel[] = []
): Array<SelectOption<ModelId>> {
  const filteredModels = cursorModels.length > 0
    ? cursorModels.map(cursorModelToAgentModelOption)
    : provider
      ? AGENT_MODELS.filter((model) => model.provider === provider)
      : AGENT_MODELS;

  return filteredModels.map((model) => ({
    value: model.id,
    label: model.label,
    hint: `${formatProvider(model.provider)} | ${model.description}`
  }));
}

export function getReasoningOptions(
  modelId: ModelId,
  cursorModels: CursorModel[] = []
): Array<SelectOption<ReasoningProfileId>> {
  const cursorParameter = getCursorReasoningParameter(modelId, cursorModels);

  if (cursorParameter) {
    return cursorParameter.values.map((entry) => ({
      value: entry.value,
      label: entry.label || formatReasoningValue(entry.value),
      hint: `${cursorParameter.label || "Reasoning"} | ${getReasoningDescription(entry.value)}`
    }));
  }

  const model = getModelOption(modelId);

  return model.reasoningProfiles.map((profile) => ({
    value: profile,
    label: getReasoningLabel(modelId, profile),
    hint: getReasoningHint(modelId, profile)
  }));
}

export function getModelOption(modelId: ModelId) {
  return (
    AGENT_MODELS.find((model) => model.id === modelId) ??
    AGENT_MODELS.find((model) => model.id === DEFAULT_MODEL_ID) ??
    AGENT_MODELS[0]
  );
}

export function getModelLabel(modelId: ModelId) {
  return getModelOption(modelId).label;
}

export function normalizeModelId(modelId?: string | null): ModelId {
  const trimmedModelId = modelId?.trim();

  return trimmedModelId || DEFAULT_MODEL_ID;
}

export function getModelProvider(modelId: ModelId) {
  return getModelOption(modelId).provider;
}

export function getReasoningLabel(_modelId: ModelId, profile: ReasoningProfileId) {
  return REASONING_COPY[profile]?.label ?? formatReasoningValue(profile);
}

export function getReasoningHint(modelId: ModelId, profile: ReasoningProfileId) {
  const model = getModelOption(modelId);
  const providerLabel = formatProvider(model.provider);
  const copy = REASONING_COPY[profile];

  return `${providerLabel} | ${copy?.description ?? getReasoningDescription(profile)}`;
}

export function normalizeReasoningProfile(
  modelId: ModelId,
  profile: ReasoningProfileId
): ReasoningProfileId {
  if (!hasStaticModelOption(modelId)) {
    return profile.trim() || DEFAULT_REASONING_PROFILE;
  }

  const model = getModelOption(modelId);
  return model.reasoningProfiles.includes(profile) ? profile : DEFAULT_REASONING_PROFILE;
}

function hasStaticModelOption(modelId: ModelId) {
  return AGENT_MODELS.some((model) => model.id === modelId);
}

function cursorModelToAgentModelOption(model: CursorModel): AgentModelOption {
  const reasoningParameter = getCursorReasoningParameter(model.id, [model]);

  return {
    id: model.id,
    label: model.label || formatModelLabel(model.id),
    provider: "codex",
    description: model.description || "Codex model available to this account.",
    reasoningProfiles: reasoningParameter?.values.map((entry) => entry.value) ?? FULL_REASONING_RANGE
  };
}

function getCursorReasoningParameter(modelId: ModelId, cursorModels: CursorModel[]) {
  const model = cursorModels.find((entry) => entry.id === modelId);
  return model?.parameters?.find((parameter) =>
    ["thinking", "reasoning", "reasoning_effort", "max_mode", "mode"].includes(parameter.id)
  );
}

function formatModelLabel(modelId: string) {
  return modelId
    .split("-")
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      return upper === "GPT" || upper === "O3" ? upper : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`;
    })
    .join(" ");
}

function formatReasoningValue(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function getReasoningDescription(value: string) {
  return REASONING_COPY[value]?.description ?? "Codex model parameter value for this account.";
}

function formatProvider(_provider: ModelProvider) {
  return "Codex";
}

export function getProviderLabel(provider: ModelProvider) {
  return formatProvider(provider);
}
