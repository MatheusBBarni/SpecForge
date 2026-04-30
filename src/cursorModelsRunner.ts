import { Cursor } from "@cursor/sdk";
import { normalizeCursorModels, type SdkModel } from "./lib/cursorSidecarProtocol";

interface CursorModelsRunnerRequest {
  apiKey?: string;
}

async function main() {
  const request = JSON.parse(await readStdin()) as CursorModelsRunnerRequest;
  const models = await Cursor.models.list(
    request.apiKey?.trim() ? { apiKey: request.apiKey.trim() } : undefined
  );

  process.stdout.write(JSON.stringify(normalizeCursorModels(models as SdkModel[])));
}

async function readStdin() {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8") || "{}";
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
