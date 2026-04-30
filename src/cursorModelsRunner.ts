import { Cursor } from "@cursor/sdk";
import type { CursorModel } from "./types";

interface CursorModelsRunnerRequest {
  apiKey?: string;
}

interface SdkModelParameterValue {
  value: string;
  displayName?: string;
}

interface SdkModelParameter {
  id: string;
  displayName?: string;
  values?: SdkModelParameterValue[];
}

interface SdkModel {
  id: string;
  displayName?: string;
  description?: string;
  parameters?: SdkModelParameter[];
}

async function main() {
  const request = JSON.parse(await readStdin()) as CursorModelsRunnerRequest;
  const models = await Cursor.models.list(
    request.apiKey?.trim() ? { apiKey: request.apiKey.trim() } : undefined
  );

  process.stdout.write(JSON.stringify(normalizeModels(models as SdkModel[])));
}

function normalizeModels(models: SdkModel[]): CursorModel[] {
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

function formatLabel(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
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
