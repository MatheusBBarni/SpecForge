import type { ModelId, ReasoningProfileId } from "../types";
import { executeCursorAgentPrompt } from "./runtime";

interface BuildCursorPrdPromptOptions {
  agentDescription: string;
  userPrompt: string;
}

interface BuildCursorSpecPromptOptions extends BuildCursorPrdPromptOptions {
  prdContent: string;
}

interface RunCursorAgentPromptOptions {
  apiKey: string;
  workspaceRoot: string;
  model: ModelId;
  reasoning: ReasoningProfileId;
  prompt: string;
  onEvent?: (line: string) => void;
}

type CursorStreamEvent = {
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

export function buildCursorPrdPrompt({
  agentDescription,
  userPrompt
}: BuildCursorPrdPromptOptions) {
  return buildPromptWithOperatorContext(agentDescription, userPrompt);
}

export function buildCursorSpecPrompt({
  agentDescription,
  userPrompt,
  prdContent
}: BuildCursorSpecPromptOptions) {
  const basePrompt = buildPromptWithOperatorContext(agentDescription, userPrompt);

  return `${basePrompt}

Attached Product Requirements Document (PRD):
${prdContent.trim()}`;
}

export async function runCursorAgentPrompt({
  apiKey,
  workspaceRoot,
  model,
  reasoning,
  prompt,
  onEvent
}: RunCursorAgentPromptOptions) {
  const result = await executeCursorAgentPrompt({
    apiKey,
    workspaceRoot,
    model,
    reasoning,
    prompt
  });

  for (const event of result.events) {
    onEvent?.(event);
  }

  if (!result.content.trim()) {
    throw new Error("Cursor SDK returned an empty response.");
  }

  return stripWrappingCodeFence(result.content);
}

function buildPromptWithOperatorContext(agentDescription: string, userPrompt: string) {
  return `${agentDescription.trim()}

Additional operator context:
--- BEGIN OPERATOR CONTEXT ---
${userPrompt.trim()}
--- END OPERATOR CONTEXT ---`;
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

function stripWrappingCodeFence(content: string) {
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
