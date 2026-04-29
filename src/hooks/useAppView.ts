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
  SettingsStoreSlice
} from "./useAppStoreSlices";

export { useAppScreenProps } from "./useAppScreenProps";
export { type AppUiHandlers, useAppUiHandlers } from "./useAppUiHandlers";
// Re-export split hooks for convenience
export { type ProjectSettingsHandlers, useProjectSettingsHandlers } from "./useProjectSettingsHandlers";

interface UseAppDerivedStateOptions {
  agentState: AgentStoreSlice;
  commandSearch: string;
  desktopRuntime: boolean;
  latestDiff: string;
  prdGenerationPrompt: string;
  projectConfigPath: string;
  projectRootName: string;
  projectRootPath: string;
  projectState: ProjectStoreSlice;
  settingsState: SettingsStoreSlice;
  specGenerationPrompt: string;
  systemPrefersDark: boolean;
}

export function useAppDerivedState({
  agentState,
  commandSearch,
  desktopRuntime,
  latestDiff,
  prdGenerationPrompt,
  projectConfigPath,
  projectRootName,
  projectRootPath,
  projectState,
  settingsState,
  specGenerationPrompt,
  systemPrefersDark
}: UseAppDerivedStateOptions) {
  const deferredSearch = useDeferredValue(commandSearch);

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
  const visibleDiff = agentState.pendingDiff ?? latestDiff;
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
      projectState.selectedModel,
      projectState.selectedReasoning,
      projectState.specPromptTemplate,
      projectState.supportingDocumentPaths
    ]
  );
  const configPathDisplay = useMemo(
    () => buildConfigPathDisplay(projectConfigPath, projectRootName),
    [projectConfigPath, projectRootName]
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
      projectRootPath.trim().length > 0 &&
      projectState.configuredPrdPath.trim().length > 0 &&
      prdGenerationPrompt.trim().length > 0,
    [
      desktopRuntime,
      isGeneratingPrd,
      prdGenerationPrompt,
      projectRootPath,
      projectState.configuredPrdPath,
      settingsState.environment.cursor.status
    ]
  );
  const canGenerateSpec = useMemo(
    () =>
      desktopRuntime &&
      !isGeneratingSpec &&
      settingsState.environment.cursor.status === "found" &&
      projectRootPath.trim().length > 0 &&
      projectState.prdContent.trim().length > 0 &&
      projectState.configuredSpecPath.trim().length > 0 &&
      specGenerationPrompt.trim().length > 0,
    [
      desktopRuntime,
      isGeneratingSpec,
      projectRootPath,
      projectState.configuredSpecPath,
      projectState.prdContent,
      settingsState.environment.cursor.status,
      specGenerationPrompt
    ]
  );
  const prdGenerationHelperText = useMemo(
    () =>
      getPrdGenerationHelperText({
        configPathDisplay,
        configuredDocumentPath: projectState.configuredPrdPath,
        desktopRuntime,
        generationPrompt: prdGenerationPrompt,
        projectRootPath,
        selectedModel: projectState.selectedModel,
        selectedProviderStatus
      }),
    [
      configPathDisplay,
      desktopRuntime,
      prdGenerationPrompt,
      projectRootPath,
      projectState.configuredPrdPath,
      projectState.selectedModel,
      selectedProviderStatus
    ]
  );
  const specGenerationHelperText = useMemo(
    () =>
      getSpecGenerationHelperText({
        configPathDisplay,
        configuredDocumentPath: projectState.configuredSpecPath,
        desktopRuntime,
        generationPrompt: specGenerationPrompt,
        prdContent: projectState.prdContent,
        projectRootPath,
        selectedModel: projectState.selectedModel,
        selectedProviderStatus
      }),
    [
      configPathDisplay,
      desktopRuntime,
      projectRootPath,
      projectState.configuredSpecPath,
      projectState.prdContent,
      projectState.selectedModel,
      selectedProviderStatus,
      specGenerationPrompt
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
    prdGenerationHelperText,
    specGenerationHelperText
  };
}

export type AppDerivedState = ReturnType<typeof useAppDerivedState>;
