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
  thinking: {
    label: "Thinking",
    description: "Use the model's explicit reasoning/thinking mode when available."
  },
  normal: {
    label: "Normal",
    description: "Use the model's standard mode."
  }
};

const FULL_REASONING_RANGE: ReasoningProfileId[] = ["low", "medium", "high", "max"];

export const DEFAULT_MODEL_ID: ModelId = "composer-2";
export const DEFAULT_REASONING_PROFILE: ReasoningProfileId = "medium";

const AGENT_MODELS: AgentModelOption[] = [
  {
    id: "auto",
    label: "Auto",
    provider: "cursor",
    description: "Let Cursor choose the best available model for the request.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "composer-2",
    label: "Composer 2",
    provider: "cursor",
    description: "Cursor's agent model for product, spec, and implementation workflows.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-4-sonnet",
    label: "Claude 4 Sonnet",
    provider: "cursor",
    description: "Reliable daily-driver coding model with agent support.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-4-sonnet-thinking",
    label: "Claude 4 Sonnet Thinking",
    provider: "cursor",
    description: "Claude Sonnet preset with thinking enabled.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-4-opus",
    label: "Claude 4 Opus",
    provider: "cursor",
    description: "Stronger planning and complex problem-solving model.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "claude-4-opus-thinking",
    label: "Claude 4 Opus Thinking",
    provider: "cursor",
    description: "Claude Opus preset with thinking enabled.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "cursor",
    description: "Large-context model for codebase navigation and planning.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "cursor",
    description: "Fast large-context model.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-5.2",
    label: "GPT-5.2",
    provider: "cursor",
    description: "Cursor-recommended OpenAI model when available to the account.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "cursor",
    description: "Controlled OpenAI coding model with agent support.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "cursor",
    description: "OpenAI general-purpose coding model.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "o3",
    label: "o3",
    provider: "cursor",
    description: "Deep reasoning model for complex bugs and ambiguous problems.",
    reasoningProfiles: FULL_REASONING_RANGE
  },
  {
    id: "grok-4",
    label: "Grok 4",
    provider: "cursor",
    description: "xAI large-context model available in Cursor where enabled.",
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

  if (!trimmedModelId) {
    return DEFAULT_MODEL_ID;
  }

  return AGENT_MODELS.some((model) => model.id === trimmedModelId)
    ? trimmedModelId
    : DEFAULT_MODEL_ID;
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
  const model = getModelOption(modelId);
  return model.reasoningProfiles.includes(profile) ? profile : DEFAULT_REASONING_PROFILE;
}

function cursorModelToAgentModelOption(model: CursorModel): AgentModelOption {
  const reasoningParameter = getCursorReasoningParameter(model.id, [model]);

  return {
    id: model.id,
    label: model.label || formatModelLabel(model.id),
    provider: "cursor",
    description: model.description || "Cursor SDK model available to this account.",
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
  return REASONING_COPY[value]?.description ?? "Cursor model parameter value for this account.";
}

function formatProvider(_provider: ModelProvider) {
  return "Cursor";
}

export function getProviderLabel(provider: ModelProvider) {
  return formatProvider(provider);
}
