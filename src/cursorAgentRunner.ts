import { Agent } from "@cursor/sdk";
import {
  type CursorStreamEvent,
  extractCursorRunText,
  formatCursorStreamEvent,
  stripWrappingCodeFence
} from "./lib/cursorSidecarProtocol";
import type { ModelId, ReasoningProfileId } from "./types";

interface CursorAgentRunnerRequest {
  apiKey: string;
  workspaceRoot: string;
  model: ModelId;
  reasoning: ReasoningProfileId;
  prompt: string;
}

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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
