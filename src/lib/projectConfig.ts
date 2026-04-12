import { DEFAULT_MODEL_ID, DEFAULT_REASONING_PROFILE, normalizeReasoningProfile } from "./agentConfig";
import type { ModelId, ProjectSettings, ReasoningProfileId } from "../types";

export const SPECFORGE_DIRECTORY_NAME = ".specforge";
export const SPECFORGE_SETTINGS_FILE_NAME = "settings.json";
export const SPECFORGE_SETTINGS_RELATIVE_PATH = `${SPECFORGE_DIRECTORY_NAME}/${SPECFORGE_SETTINGS_FILE_NAME}`;
export const DEFAULT_PROJECT_PRD_PATH = "docs/PRD.md";
export const DEFAULT_PROJECT_SPEC_PATH = "docs/SPEC.md";

export const DEFAULT_PRD_PROMPT = `Act as an Expert Senior Product Manager. Your goal is to help me write a comprehensive, well-structured Product Requirements Document (PRD) for a new [product / feature / app] called [Project Name].

I have some initial ideas, but I want to make sure the PRD is thorough. Before you draft the full document, please ask me a series of clarifying questions to gather the necessary context.

Please ask about:
- The core problem we are solving
- The target audience/user personas
- Key features and user flows
- Success metrics (KPIs)
- Technical or timeline constraints

Ask me these questions one or two at a time so I do not get overwhelmed. Once you have enough context, we will move on to drafting the actual PRD.`;

export const DEFAULT_SPEC_PROMPT = `Act as an Expert Software Architect and Tech Lead. I have attached the Product Requirements Document (PRD) for our upcoming project.

Your task is to analyze this PRD and draft a comprehensive Technical Specification Document.

Please structure the spec with the following sections:

1. High-Level Architecture: A conceptual overview of how the system components will interact.
2. Tech Stack & Tooling: Define the frontend, backend, and infrastructure.
3. Data Models & Database Schema: Define the core entities, their attributes, and relationships.
4. API Contracts: Outline the primary endpoints (methods, routes, request/response structures) needed to support the user flows.
5. Component & State Management: How data will flow through the application and how the UI will be structured.
6. Security & Edge Cases: Potential vulnerabilities, error handling, and performance bottlenecks.
7. Engineering Milestones: Break the implementation down into logical, phased deliverables.

Before writing the full document, please provide a brief bulleted summary of your proposed technical approach, and ask me up to 3 clarifying questions about any technical constraints or non-functional requirements that might be missing from the PRD.`;

const VALID_REASONING_PROFILES = new Set<ReasoningProfileId>(["low", "medium", "high", "max"]);
const VALID_MODEL_IDS = new Set<ModelId>([
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.2",
  "claude-opus-4-1-20250805",
  "claude-opus-4-20250514",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307"
]);

export function buildDefaultProjectSettings(): ProjectSettings {
  return {
    selectedModel: DEFAULT_MODEL_ID,
    selectedReasoning: DEFAULT_REASONING_PROFILE,
    prdPrompt: DEFAULT_PRD_PROMPT,
    specPrompt: DEFAULT_SPEC_PROMPT,
    prdPath: DEFAULT_PROJECT_PRD_PATH,
    specPath: DEFAULT_PROJECT_SPEC_PATH,
    supportingDocumentPaths: []
  };
}

export function normalizeProjectSettings(
  value?: Partial<ProjectSettings> | null
): ProjectSettings {
  const defaults = buildDefaultProjectSettings();
  const selectedModel = isModelId(value?.selectedModel) ? value.selectedModel : defaults.selectedModel;
  const selectedReasoning = normalizeReasoningProfile(
    selectedModel,
    isReasoningProfileId(value?.selectedReasoning)
      ? value.selectedReasoning
      : defaults.selectedReasoning
  );

  return {
    selectedModel,
    selectedReasoning,
    prdPrompt: value?.prdPrompt?.trim() || defaults.prdPrompt,
    specPrompt: value?.specPrompt?.trim() || defaults.specPrompt,
    prdPath: normalizeProjectRelativePath(value?.prdPath) || defaults.prdPath,
    specPath: normalizeProjectRelativePath(value?.specPath) || defaults.specPath,
    supportingDocumentPaths: normalizeSupportingDocumentPaths(value?.supportingDocumentPaths)
  };
}

export function normalizeProjectRelativePath(value?: string | null) {
  return value?.trim().replace(/\\/g, "/").replace(/^\/+/, "") ?? "";
}

export function normalizeSupportingDocumentPaths(value?: string[] | null) {
  return (value ?? [])
    .map((entry) => normalizeProjectRelativePath(entry))
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index);
}

export function formatSupportingDocumentPaths(paths: string[]) {
  return paths.join("\n");
}

export function parseSupportingDocumentPaths(value: string) {
  return normalizeSupportingDocumentPaths(value.split(/\r?\n/));
}

export function getWorkspaceDisplayPath(path: string, workspaceRootName?: string) {
  const normalizedPath = path
    .replace(/\\/g, "/")
    .replace(/^\/{2}\?\//, "");

  if (!workspaceRootName) {
    return normalizedPath;
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  const rootIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === workspaceRootName.toLowerCase()
  );

  if (rootIndex >= 0 && rootIndex < segments.length - 1) {
    return segments.slice(rootIndex + 1).join("/");
  }

  return normalizedPath;
}

function isModelId(value?: string | null): value is ModelId {
  return Boolean(value && VALID_MODEL_IDS.has(value as ModelId));
}

function isReasoningProfileId(value?: string | null): value is ReasoningProfileId {
  return Boolean(value && VALID_REASONING_PROFILES.has(value as ReasoningProfileId));
}
