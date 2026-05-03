import type {
  EnvironmentStatus,
  ModelId,
  ModelProvider,
  ProjectContext,
  ProviderAuthMode,
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
  providerAuthMode: ProviderAuthMode;
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
    providers.push("codex");
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
      name: environment.codex.name,
      detail: environment.codex.detail,
      status: environment.codex.status
    },
    {
      name: environment.docker.name,
      detail: environment.docker.detail,
      status: environment.docker.status
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
  providerAuthMode,
  selectedModel,
  selectedReasoning,
  specAgentDescription,
  executionAgentDescription,
  supportingDocumentPaths
}: BuildCurrentProjectSettingsOptions) {
  return normalizeProjectSettings({
    selectedModel,
    selectedReasoning,
    providerAuthMode,
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
    return "Configure Codex authentication in Settings before generating a PRD.";
  }

  return `This appends your note after the saved PRD agent description from ${configPathDisplay}, runs ${getModelLabel(selectedModel)} through Sandcastle, and writes markdown to ${configuredDocumentPath}.`;
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
    return "Configure Codex authentication in Settings before generating a spec.";
  }

  return `This appends your note after the saved spec agent description from ${configPathDisplay}, includes the current PRD content, and writes markdown to ${configuredDocumentPath}.`;
}

export function buildWorkspaceNotice(context: ProjectContext) {
  void context;
  return "";
}

export function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });
}
