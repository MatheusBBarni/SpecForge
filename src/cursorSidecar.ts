import { Agent, Cursor } from "@cursor/sdk";
import {
  type CursorSidecarOutputLine,
  type CursorSidecarRequest,
  type CursorStreamEvent,
  extractCursorRunText,
  formatCursorStreamEvent,
  normalizeCursorModels,
  type SdkModel,
  stripWrappingCodeFence
} from "./lib/cursorSidecarProtocol";

async function main() {
  const request = JSON.parse(await readStdin()) as CursorSidecarRequest;

  switch (request.command) {
    case "listModels": {
      const models = await Cursor.models.list(
        request.apiKey?.trim() ? { apiKey: request.apiKey.trim() } : undefined
      );
      writeOutputLine({ type: "models", models: normalizeCursorModels(models as SdkModel[]) });
      return;
    }

    case "runAgentPrompt": {
      await runAgentPrompt(request);
      return;
    }
  }
}

async function runAgentPrompt(request: Extract<CursorSidecarRequest, { command: "runAgentPrompt" }>) {
  const agent = await Agent.create({
    apiKey: request.apiKey,
    model: {
      id: request.model,
      params: [{ id: "thinking", value: request.reasoning === "max" ? "high" : request.reasoning }]
    },
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

async function readStdin() {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8") || "{}";
}

function writeOutputLine(line: CursorSidecarOutputLine) {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
