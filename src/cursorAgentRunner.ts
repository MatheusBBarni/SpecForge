import { Agent } from "@cursor/sdk";
import type { ModelId, ReasoningProfileId } from "./types";

interface CursorAgentRunnerRequest {
  apiKey: string;
  workspaceRoot: string;
  model: ModelId;
  reasoning: ReasoningProfileId;
  prompt: string;
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

type RunnerOutputLine =
  | { type: "event"; text: string }
  | { type: "result"; content: string };

async function main() {
  const request = JSON.parse(await readStdin()) as CursorAgentRunnerRequest;
  const agent = await Agent.create({
    apiKey: request.apiKey,
    model: buildCursorModelSelection(request.model, request.reasoning),
    local: { cwd: request.workspaceRoot }
  });
  const events: CursorStreamEvent[] = [];

  try {
    const run = await agent.send(request.prompt);

    for await (const event of run.stream() as AsyncGenerator<CursorStreamEvent>) {
      events.push(event);
      const text = formatCursorStreamEvent(event);

      if (text) {
        writeOutputLine({ type: "event", text });
      }
    }

    const result = await run.wait();
    const content = extractCursorRunText(result, events);

    if (!content.trim()) {
      throw new Error("Cursor SDK returned an empty response.");
    }

    writeOutputLine({ type: "result", content: stripWrappingCodeFence(content) });
  } finally {
    agent.close();
  }
}

function buildCursorModelSelection(model: ModelId, reasoning: ReasoningProfileId) {
  return {
    id: model,
    params: [{ id: "thinking", value: reasoning === "max" ? "high" : reasoning }]
  };
}

function extractCursorRunText(
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

function formatCursorStreamEvent(event: CursorStreamEvent) {
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

async function readStdin() {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function writeOutputLine(line: RunnerOutputLine) {
  process.stdout.write(`${JSON.stringify(line)}\n`);
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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
