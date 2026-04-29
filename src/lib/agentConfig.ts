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

export const DEFAULT_MODEL_ID: ModelId = "composer-2";
export const DEFAULT_REASONING_PROFILE: ReasoningProfileId = "medium";

const AGENT_MODELS: AgentModelOption[] = [
  {
    id: "composer-2",
    label: "Composer 2",
    provider: "cursor",
    description: "Cursor's agent model for product, spec, and implementation workflows.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "auto",
    label: "Auto",
    provider: "cursor",
    description: "Let Cursor choose the best available model for the request.",
    reasoningProfiles: FULL_REASONING_RANGE
  }
];

export function getModelOptions(provider?: ModelProvider): Array<SelectOption<ModelId>> {
  const filteredModels = provider
    ? AGENT_MODELS.filter((model) => model.provider === provider)
    : AGENT_MODELS;

  return filteredModels.map((model) => ({
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

export function getModelProvider(modelId: ModelId) {
  return getModelOption(modelId).provider;
}

export function getReasoningLabel(_modelId: ModelId, profile: ReasoningProfileId) {
  return REASONING_COPY[profile]?.label ?? REASONING_COPY[DEFAULT_REASONING_PROFILE].label;
}

export function getReasoningHint(modelId: ModelId, profile: ReasoningProfileId) {
  const model = getModelOption(modelId);
  const providerLabel = formatProvider(model.provider);
  const copy = REASONING_COPY[profile] ?? REASONING_COPY[DEFAULT_REASONING_PROFILE];

  return `${providerLabel} | ${copy.description}`;
}

export function normalizeReasoningProfile(
  modelId: ModelId,
  profile: ReasoningProfileId
): ReasoningProfileId {
  const model = getModelOption(modelId);
  return model.reasoningProfiles.includes(profile) ? profile : DEFAULT_REASONING_PROFILE;
}

function formatProvider(_provider: ModelProvider) {
  return "Cursor";
}

export function getProviderLabel(provider: ModelProvider) {
  return formatProvider(provider);
}
