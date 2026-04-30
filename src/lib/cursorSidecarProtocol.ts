import type { CursorModel, ModelId, ReasoningProfileId } from "../types";

export type CursorSidecarRequest =
  | {
      command: "listModels";
      apiKey?: string;
    }
  | {
      command: "runAgentPrompt";
      apiKey: string;
      workspaceRoot: string;
      model: ModelId;
      reasoning: ReasoningProfileId;
      prompt: string;
    };

export type CursorSidecarOutputLine =
  | { type: "event"; text: string }
  | { type: "result"; content: string }
  | { type: "models"; models: CursorModel[] };

export interface SdkModelParameterValue {
  value: string;
  displayName?: string;
}

export interface SdkModelParameter {
  id: string;
  displayName?: string;
  values?: SdkModelParameterValue[];
}

export interface SdkModel {
  id: string;
  displayName?: string;
  description?: string;
  parameters?: SdkModelParameter[];
}

export type CursorStreamEvent = {
  type?: string;
  message?: {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
  text?: string;
  name?: string;
  status?: string;
};

export function parseSidecarOutputLine(line: string): CursorSidecarOutputLine {
  try {
    const parsed = JSON.parse(line) as CursorSidecarOutputLine;

    if (parsed.type === "event" && typeof parsed.text === "string") {
      return parsed;
    }

    if (parsed.type === "result" && typeof parsed.content === "string") {
      return parsed;
    }

    if (parsed.type === "models" && Array.isArray(parsed.models)) {
      return parsed;
    }
  } catch (error) {
    throw new Error(
      `Cursor sidecar returned malformed JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  throw new Error(`Cursor sidecar returned an unsupported output line: ${line}`);
}

export function normalizeCursorModels(models: SdkModel[]): CursorModel[] {
  return models
    .filter((model) => model.id.trim().length > 0)
    .map((model) => ({
      id: model.id,
      label: model.displayName?.trim() || formatLabel(model.id),
      description: model.description?.trim() || undefined,
      parameters: model.parameters
        ?.map((parameter) => ({
          id: parameter.id,
          label: parameter.displayName?.trim() || formatLabel(parameter.id),
          values: (parameter.values ?? [])
            .filter((entry) => entry.value.trim().length > 0)
            .map((entry) => ({
              value: entry.value,
              label: entry.displayName?.trim() || formatLabel(entry.value)
            }))
        }))
        .filter((parameter) => parameter.values.length > 0)
    }));
}

export function extractCursorRunText(
  runResult?: { result?: string },
  events: CursorStreamEvent[] = []
) {
  if (runResult?.result?.trim()) {
    return runResult.result.trim();
  }

  return events
    .flatMap((event) =>
      event.type === "assistant"
        ? event.message?.content
            ?.filter((block) => block.type === "text" && block.text)
            .map((block) => block.text ?? "") ?? []
        : []
    )
    .join("")
    .trim();
}

export function formatCursorStreamEvent(event: CursorStreamEvent) {
  switch (event.type) {
    case "thinking":
      return event.text?.trim() ? `[thinking] ${event.text.trim()}` : "";
    case "tool_call":
      return event.name ? `[tool] ${event.name}${event.status ? `: ${event.status}` : ""}` : "";
    case "status":
      return event.status ? `[status] ${event.status}` : "";
    default:
      return "";
  }
}

export function stripWrappingCodeFence(content: string) {
  const trimmed = content.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0]?.trimStart() ?? "";
  const lastLine = lines[lines.length - 1]?.trimStart() ?? "";

  if (!firstLine.startsWith("```") || !lastLine.startsWith("```")) {
    return trimmed;
  }

  return lines.slice(1, -1).join("\n").trim();
}

function formatLabel(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
