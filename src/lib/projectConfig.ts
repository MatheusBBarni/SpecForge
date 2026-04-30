import type { ModelId, ProjectSettings, ReasoningProfileId } from "../types";
import { DEFAULT_MODEL_ID, DEFAULT_REASONING_PROFILE, normalizeReasoningProfile } from "./agentConfig";

export const SPECFORGE_DIRECTORY_NAME = ".specforge";
export const SPECFORGE_SETTINGS_FILE_NAME = "settings.json";
export const SPECFORGE_SETTINGS_RELATIVE_PATH = `${SPECFORGE_DIRECTORY_NAME}/${SPECFORGE_SETTINGS_FILE_NAME}`;
export const DEFAULT_PROJECT_PRD_PATH = "docs/PRD.md";
export const DEFAULT_PROJECT_SPEC_PATH = "docs/SPEC.md";

export const DEFAULT_PRD_AGENT_DESCRIPTION = `Act as an Expert Senior Product Manager. Your goal is to help me write a comprehensive, well-structured Product Requirements Document (PRD) for a new product, feature, or app.

Use the operator context as the source material. Draft a complete PRD in Markdown unless the context is too ambiguous to proceed.

Cover:
- Problem statement
- Target audience and personas
- Goals and non-goals
- Core user flows
- Functional requirements
- Success metrics
- Constraints, risks, and open questions

Return only the PRD Markdown.`;

export const DEFAULT_SPEC_AGENT_DESCRIPTION = `Act as an Expert Software Architect and Tech Lead. I have attached the Product Requirements Document (PRD) for the project.

Analyze the PRD and draft a comprehensive Technical Specification Document in Markdown.

Please structure the spec with the following sections:

1. High-Level Architecture: A conceptual overview of how the system components will interact.
2. Tech Stack & Tooling: Define the frontend, backend, and infrastructure.
3. Data Models & Database Schema: Define the core entities, their attributes, and relationships.
4. API Contracts: Outline the primary endpoints (methods, routes, request/response structures) needed to support the user flows.
5. Component & State Management: How data will flow through the application and how the UI will be structured.
6. Security & Edge Cases: Potential vulnerabilities, error handling, and performance bottlenecks.
7. Engineering Milestones: Break the implementation down into logical, phased deliverables.

Return only the spec Markdown.`;

export const DEFAULT_EXECUTION_AGENT_DESCRIPTION = `Act as a Senior Software Engineer executing from an approved technical specification.

Use the approved spec as the source of truth. Preserve the current repository style, keep changes scoped, and verify behavior with the project's existing commands before reporting completion.`;

export const DEFAULT_PRD_PROMPT = DEFAULT_PRD_AGENT_DESCRIPTION;
export const DEFAULT_SPEC_PROMPT = DEFAULT_SPEC_AGENT_DESCRIPTION;

export function buildDefaultProjectSettings(): ProjectSettings {
  return {
    selectedModel: DEFAULT_MODEL_ID,
    selectedReasoning: DEFAULT_REASONING_PROFILE,
    prdAgentDescription: DEFAULT_PRD_AGENT_DESCRIPTION,
    specAgentDescription: DEFAULT_SPEC_AGENT_DESCRIPTION,
    executionAgentDescription: DEFAULT_EXECUTION_AGENT_DESCRIPTION,
    prdPath: DEFAULT_PROJECT_PRD_PATH,
    specPath: DEFAULT_PROJECT_SPEC_PATH,
    supportingDocumentPaths: []
  };
}

export function normalizeProjectSettings(
  value?: (Partial<ProjectSettings> & { prdPrompt?: string; specPrompt?: string }) | null
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
    prdAgentDescription:
      value?.prdAgentDescription?.trim() || value?.prdPrompt?.trim() || defaults.prdAgentDescription,
    specAgentDescription:
      value?.specAgentDescription?.trim() || value?.specPrompt?.trim() || defaults.specAgentDescription,
    executionAgentDescription:
      value?.executionAgentDescription?.trim() || defaults.executionAgentDescription,
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
  return Boolean(value?.trim() && !/\s/.test(value.trim()));
}

function isReasoningProfileId(value?: string | null): value is ReasoningProfileId {
  return Boolean(value?.trim() && !/\s/.test(value.trim()));
}
