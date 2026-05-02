import {
  useDeferredValue,
  useMemo
} from "react";
import { getModelProvider } from "../lib/agentConfig";
import {
  filterWorkspaceEntries,
  resolveTheme
} from "../lib/appShell";
import {
  buildConfigPathDisplay,
  buildConfiguredModelProviders,
  buildCurrentProjectSettings,
  buildMcpItems,
  getPrdGenerationHelperText,
  getSpecGenerationHelperText
} from "../lib/appState";
import { formatSupportingDocumentPaths } from "../lib/projectConfig";
import type {
  AgentStoreSlice,
  ProjectStoreSlice,
  SettingsStoreSlice,
  WorkspaceUiStoreSlice
} from "./useAppStoreSlices";

export { useAppScreenProps } from "./useAppScreenProps";
export { type AppUiHandlers, useAppUiHandlers } from "./useAppUiHandlers";
// Re-export split hooks for convenience
export { type ProjectSettingsHandlers, useProjectSettingsHandlers } from "./useProjectSettingsHandlers";

interface UseAppDerivedStateOptions {
  agentState: AgentStoreSlice;
  desktopRuntime: boolean;
  projectState: ProjectStoreSlice;
  settingsState: SettingsStoreSlice;
  systemPrefersDark: boolean;
  workspaceUiState: WorkspaceUiStoreSlice;
}

export function useAppDerivedState({
  agentState,
  desktopRuntime,
  projectState,
  settingsState,
  systemPrefersDark,
  workspaceUiState
}: UseAppDerivedStateOptions) {
  const deferredSearch = useDeferredValue(workspaceUiState.commandSearch);

  const filteredWorkspaceEntries = useMemo(
    () => filterWorkspaceEntries(settingsState.workspaceEntries, deferredSearch),
    [deferredSearch, settingsState.workspaceEntries]
  );
  const selectedModelProvider = useMemo(
    () => getModelProvider(projectState.selectedModel),
    [projectState.selectedModel]
  );
  const isGeneratingPrd = agentState.status === "generating_prd";
  const isGeneratingSpec = agentState.status === "generating_spec";
  const visibleDiff = agentState.pendingDiff ?? workspaceUiState.latestDiff;
  const resolvedTheme = useMemo(
    () => resolveTheme(settingsState.theme, systemPrefersDark),
    [settingsState.theme, systemPrefersDark]
  );
  const configuredModelProviders = useMemo(
    () => buildConfiguredModelProviders(settingsState.environment),
    [settingsState.environment]
  );
  const mcpItems = useMemo(
    () => buildMcpItems(settingsState.environment),
    [settingsState.environment]
  );
  const selectedProviderStatus = settingsState.environment.cursor;
  const currentProjectSettings = useMemo(
    () =>
      buildCurrentProjectSettings({
        configuredPrdPath: projectState.configuredPrdPath,
        configuredSpecPath: projectState.configuredSpecPath,
        prdAgentDescription: projectState.prdPromptTemplate,
        providerAuthMode: projectState.providerAuthMode,
        selectedModel: projectState.selectedModel,
        selectedReasoning: projectState.selectedReasoning,
        specAgentDescription: projectState.specPromptTemplate,
        executionAgentDescription: projectState.executionAgentDescription,
        supportingDocumentPaths: projectState.supportingDocumentPaths
      }),
    [
      projectState.configuredPrdPath,
      projectState.configuredSpecPath,
      projectState.executionAgentDescription,
      projectState.prdPromptTemplate,
      projectState.providerAuthMode,
      projectState.selectedModel,
      projectState.selectedReasoning,
      projectState.specPromptTemplate,
      projectState.supportingDocumentPaths
    ]
  );
  const configPathDisplay = useMemo(
    () =>
      buildConfigPathDisplay(
        workspaceUiState.projectConfigPath,
        workspaceUiState.projectRootName
      ),
    [workspaceUiState.projectConfigPath, workspaceUiState.projectRootName]
  );
  const supportingDocumentsValue = useMemo(
    () => formatSupportingDocumentPaths(projectState.supportingDocumentPaths),
    [projectState.supportingDocumentPaths]
  );
  const canGeneratePrd = useMemo(
    () =>
      desktopRuntime &&
      !isGeneratingPrd &&
      settingsState.environment.cursor.status === "found" &&
      settingsState.environment.codex.status === "found" &&
      settingsState.environment.docker.status === "found" &&
      workspaceUiState.projectRootPath.trim().length > 0 &&
      projectState.configuredPrdPath.trim().length > 0 &&
      workspaceUiState.prdGenerationPrompt.trim().length > 0,
    [
      desktopRuntime,
      isGeneratingPrd,
      projectState.configuredPrdPath,
      settingsState.environment.cursor.status,
      settingsState.environment.codex.status,
      settingsState.environment.docker.status,
      workspaceUiState.prdGenerationPrompt,
      workspaceUiState.projectRootPath
    ]
  );
  const canGenerateSpec = useMemo(
    () =>
      desktopRuntime &&
      !isGeneratingSpec &&
      settingsState.environment.cursor.status === "found" &&
      settingsState.environment.codex.status === "found" &&
      settingsState.environment.docker.status === "found" &&
      workspaceUiState.projectRootPath.trim().length > 0 &&
      projectState.prdContent.trim().length > 0 &&
      projectState.configuredSpecPath.trim().length > 0 &&
      workspaceUiState.specGenerationPrompt.trim().length > 0,
    [
      desktopRuntime,
      isGeneratingSpec,
      projectState.configuredSpecPath,
      projectState.prdContent,
      settingsState.environment.cursor.status,
      settingsState.environment.codex.status,
      settingsState.environment.docker.status,
      workspaceUiState.projectRootPath,
      workspaceUiState.specGenerationPrompt
    ]
  );
  const canGrillSpec = useMemo(
    () =>
      desktopRuntime &&
      !isGeneratingSpec &&
      settingsState.environment.cursor.status === "found" &&
      settingsState.environment.codex.status === "found" &&
      settingsState.environment.docker.status === "found" &&
      workspaceUiState.projectRootPath.trim().length > 0 &&
      projectState.prdContent.trim().length > 0 &&
      projectState.configuredSpecPath.trim().length > 0,
    [
      desktopRuntime,
      isGeneratingSpec,
      projectState.configuredSpecPath,
      projectState.prdContent,
      settingsState.environment.cursor.status,
      settingsState.environment.codex.status,
      settingsState.environment.docker.status,
      workspaceUiState.projectRootPath
    ]
  );
  const prdGenerationHelperText = useMemo(
    () =>
      getPrdGenerationHelperText({
        configPathDisplay,
        configuredDocumentPath: projectState.configuredPrdPath,
        desktopRuntime,
        generationPrompt: workspaceUiState.prdGenerationPrompt,
        projectRootPath: workspaceUiState.projectRootPath,
        selectedModel: projectState.selectedModel,
        selectedProviderStatus
      }),
    [
      configPathDisplay,
      desktopRuntime,
      projectState.configuredPrdPath,
      projectState.selectedModel,
      selectedProviderStatus,
      workspaceUiState.prdGenerationPrompt,
      workspaceUiState.projectRootPath
    ]
  );
  const specGenerationHelperText = useMemo(
    () =>
      getSpecGenerationHelperText({
        configPathDisplay,
        configuredDocumentPath: projectState.configuredSpecPath,
        desktopRuntime,
        generationPrompt: workspaceUiState.specGenerationPrompt,
        prdContent: projectState.prdContent,
        projectRootPath: workspaceUiState.projectRootPath,
        selectedModel: projectState.selectedModel,
        selectedProviderStatus
      }),
    [
      configPathDisplay,
      desktopRuntime,
      projectState.configuredSpecPath,
      projectState.prdContent,
      projectState.selectedModel,
      selectedProviderStatus,
      workspaceUiState.projectRootPath,
      workspaceUiState.specGenerationPrompt
    ]
  );

  return {
    deferredSearch,
    filteredWorkspaceEntries,
    selectedModelProvider,
    isGeneratingPrd,
    isGeneratingSpec,
    visibleDiff,
    resolvedTheme,
    configuredModelProviders,
    mcpItems,
    selectedProviderStatus,
    currentProjectSettings,
    configPathDisplay,
    supportingDocumentsValue,
    canGeneratePrd,
    canGenerateSpec,
    canGrillSpec,
    prdGenerationHelperText,
    specGenerationHelperText
  };
}

export type AppDerivedState = ReturnType<typeof useAppDerivedState>;
