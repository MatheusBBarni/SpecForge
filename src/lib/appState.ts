import type {
  EnvironmentStatus,
  ModelId,
  ModelProvider,
  ProjectContext,
  ReasoningProfileId
} from "../types";
import { getModelLabel } from "./agentConfig";
import {
  DEFAULT_PROJECT_PRD_PATH,
  DEFAULT_PROJECT_SPEC_PATH,
  getWorkspaceDisplayPath,
  normalizeProjectSettings, 
  SPECFORGE_SETTINGS_RELATIVE_PATH
} from "./projectConfig";

interface BuildCurrentProjectSettingsOptions {
  configuredPrdPath: string;
  configuredSpecPath: string;
  prdAgentDescription: string;
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  specAgentDescription: string;
  executionAgentDescription: string;
  supportingDocumentPaths: string[];
}

interface GenerationHelperTextOptions {
  configPathDisplay: string;
  configuredDocumentPath: string;
  desktopRuntime: boolean;
  generationPrompt: string;
  projectRootPath: string;
  selectedModel: ModelId;
  selectedProviderStatus: EnvironmentStatus["cursor"];
}

interface SpecGenerationHelperTextOptions extends GenerationHelperTextOptions {
  prdContent: string;
}

export interface McpListItem {
  name: string;
  detail: string;
  status?: string;
}

export function buildConfiguredModelProviders(
  environment: EnvironmentStatus
): ModelProvider[] {
  const providers: ModelProvider[] = [];

  if (environment.cursor.status === "found") {
    providers.push("cursor");
  }

  return providers;
}

export function buildMcpItems(environment: EnvironmentStatus): McpListItem[] {
  return [
    {
      name: environment.cursor.name,
      detail: environment.cursor.detail,
      status: environment.cursor.status
    },
    {
      name: environment.git.name,
      detail: environment.git.detail,
      status: environment.git.status
    }
  ];
}

export function buildCurrentProjectSettings({
  configuredPrdPath,
  configuredSpecPath,
  prdAgentDescription,
  selectedModel,
  selectedReasoning,
  specAgentDescription,
  executionAgentDescription,
  supportingDocumentPaths
}: BuildCurrentProjectSettingsOptions) {
  return normalizeProjectSettings({
    selectedModel,
    selectedReasoning,
    prdAgentDescription,
    specAgentDescription,
    executionAgentDescription,
    prdPath: configuredPrdPath || DEFAULT_PROJECT_PRD_PATH,
    specPath: configuredSpecPath || DEFAULT_PROJECT_SPEC_PATH,
    supportingDocumentPaths
  });
}

export function buildConfigPathDisplay(
  projectConfigPath: string,
  projectRootName: string
) {
  if (projectConfigPath.trim()) {
    return getWorkspaceDisplayPath(projectConfigPath, projectRootName);
  }

  return SPECFORGE_SETTINGS_RELATIVE_PATH;
}

export function getPrdGenerationHelperText({
  configPathDisplay,
  configuredDocumentPath,
  desktopRuntime,
  generationPrompt,
  projectRootPath,
  selectedModel,
  selectedProviderStatus
}: GenerationHelperTextOptions) {
  if (!desktopRuntime) {
    return "AI PRD generation requires the desktop runtime.";
  }

  if (!projectRootPath.trim()) {
    return "Choose a project folder in setup before generating a PRD.";
  }

  if (!configuredDocumentPath.trim()) {
    return "Configure a PRD path in setup or settings first.";
  }

  if (!configuredDocumentPath.toLowerCase().endsWith(".md")) {
    return "Configure the PRD path as a Markdown file if you want generated output saved into the workspace.";
  }

  if (!generationPrompt.trim()) {
    return "Add the product context you want to append after the saved PRD prompt.";
  }

  if (selectedProviderStatus.status !== "found") {
    return "Save a Cursor API key in Settings before generating a PRD.";
  }

  return `This appends your note after the saved PRD agent description from ${configPathDisplay}, runs ${getModelLabel(selectedModel)} through Cursor SDK, and writes markdown to ${configuredDocumentPath}.`;
}

export function getSpecGenerationHelperText({
  configPathDisplay,
  configuredDocumentPath,
  desktopRuntime,
  generationPrompt,
  prdContent,
  projectRootPath,
  selectedProviderStatus
}: SpecGenerationHelperTextOptions) {
  if (!desktopRuntime) {
    return "AI spec generation requires the desktop runtime.";
  }

  if (!projectRootPath.trim()) {
    return "Choose a project folder in setup before generating a spec.";
  }

  if (!prdContent.trim()) {
    return "Load or generate a PRD first. The spec generator appends your note after the saved spec prompt and includes the current PRD content.";
  }

  if (!configuredDocumentPath.trim()) {
    return "Configure a spec path in setup or settings first.";
  }

  if (!configuredDocumentPath.toLowerCase().endsWith(".md")) {
    return "Configure the spec path as a Markdown file if you want generated output saved into the workspace.";
  }

  if (!generationPrompt.trim()) {
    return "Add the technical guidance you want to append after the saved spec prompt.";
  }

  if (selectedProviderStatus.status !== "found") {
    return "Save a Cursor API key in Settings before generating a spec.";
  }

  return `This appends your note after the saved spec agent description from ${configPathDisplay}, includes the current PRD content, and writes markdown to ${configuredDocumentPath}.`;
}

export function buildWorkspaceNotice(context: ProjectContext) {
  const loadedDocuments = [
    context.prdDocument?.fileName ? `PRD: ${context.prdDocument.fileName}` : null,
    context.specDocument?.fileName ? `SPEC: ${context.specDocument.fileName}` : null
  ].filter((value): value is string => value !== null);

  if (loadedDocuments.length === 0) {
    return `${context.rootName} is configured. No document exists yet at ${context.settings.prdPath} or ${context.settings.specPath}.`;
  }

  return `${context.rootName} is configured. Loaded ${loadedDocuments.join(" and ")} from the saved project paths.`;
}

export function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });
}
