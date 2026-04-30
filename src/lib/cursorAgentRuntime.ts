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

export function buildCursorPrdGrillPrompt({
  agentDescription,
  userPrompt
}: BuildCursorPrdPromptOptions) {
  return buildGrillPrompt({
    documentKind: "Product Requirements Document (PRD)",
    agentDescription,
    userPrompt,
    attachedContext: ""
  });
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

export function buildCursorSpecGrillPrompt({
  agentDescription,
  userPrompt,
  prdContent
}: BuildCursorSpecPromptOptions) {
  return buildGrillPrompt({
    documentKind: "Technical Specification",
    agentDescription,
    userPrompt,
    attachedContext: `Attached Product Requirements Document (PRD):\n${prdContent.trim()}`
  });
}

export async function runCursorAgentPrompt({
  workspaceRoot,
  model,
  reasoning,
  prompt,
  onEvent
}: RunCursorAgentPromptOptions) {
  const result = await executeCursorAgentPrompt({
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

function buildGrillPrompt({
  documentKind,
  agentDescription,
  userPrompt,
  attachedContext
}: {
  documentKind: string;
  agentDescription: string;
  userPrompt: string;
  attachedContext: string;
}) {
  return `${agentDescription.trim()}

SpecForge built-in grill-me workflow:
- Interview the operator relentlessly about the ${documentKind} until the plan is clear.
- Ask exactly one next question.
- Include your recommended answer for that question.
- If a question can be answered from the supplied context, infer the answer and move to the next unresolved question.
- Do not draft the ${documentKind} yet.
- Return concise Markdown with the headings "Question" and "Recommended answer".

Additional operator context:
--- BEGIN OPERATOR CONTEXT ---
${userPrompt.trim() || "No additional operator context was provided."}
--- END OPERATOR CONTEXT ---${attachedContext.trim() ? `\n\n${attachedContext.trim()}` : ""}`;
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
