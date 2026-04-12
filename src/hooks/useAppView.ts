import {
  useCallback,
  useDeferredValue,
  useMemo,
  type ChangeEvent,
  type ComponentProps,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from "react";

import {
  filterWorkspaceEntries,
  resolveTheme,
  type DocumentTarget
} from "../lib/appShell";
import { getModelProvider } from "../lib/agentConfig";
import {
  formatSupportingDocumentPaths,
  normalizeProjectRelativePath,
  parseSupportingDocumentPaths
} from "../lib/projectConfig";
import {
  buildConfigPathDisplay,
  buildConfiguredModelProviders,
  buildCurrentProjectSettings,
  buildMcpItems,
  getPrdGenerationHelperText,
  getSpecGenerationHelperText
} from "../lib/appState";
import { ConfigurationScreen } from "../screens/ConfigurationScreen";
import { PrdScreen } from "../screens/PrdScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import type { EnvironmentStatus } from "../types";
import type {
  AgentStoreSlice,
  ProjectStoreSlice,
  SettingsStoreSlice
} from "./useAppStoreSlices";

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
  const selectedProviderStatus =
    selectedModelProvider === "claude"
      ? settingsState.environment.claude
      : settingsState.environment.codex;
  const currentProjectSettings = useMemo(
    () =>
      buildCurrentProjectSettings({
        configuredPrdPath: projectState.configuredPrdPath,
        configuredSpecPath: projectState.configuredSpecPath,
        prdPromptTemplate: projectState.prdPromptTemplate,
        selectedModel: projectState.selectedModel,
        selectedReasoning: projectState.selectedReasoning,
        specPromptTemplate: projectState.specPromptTemplate,
        supportingDocumentPaths: projectState.supportingDocumentPaths
      }),
    [
      projectState.configuredPrdPath,
      projectState.configuredSpecPath,
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
      projectRootPath.trim().length > 0 &&
      projectState.configuredPrdPath.trim().length > 0 &&
      prdGenerationPrompt.trim().length > 0,
    [
      desktopRuntime,
      isGeneratingPrd,
      prdGenerationPrompt,
      projectRootPath,
      projectState.configuredPrdPath
    ]
  );
  const canGenerateSpec = useMemo(
    () =>
      desktopRuntime &&
      !isGeneratingSpec &&
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

interface SaveCurrentProjectSettingsOptions {
  reloadProject?: boolean;
  navigateToChat?: boolean;
}

type SaveCurrentProjectSettings = (
  options?: SaveCurrentProjectSettingsOptions
) => Promise<void>;

interface UseProjectSettingsHandlersOptions {
  saveCurrentProjectSettings: SaveCurrentProjectSettings;
  scheduleProjectSettingsSave: (reloadProject?: boolean) => void;
  setConfiguredPrdPath: ProjectStoreSlice["setConfiguredPrdPath"];
  setConfiguredSpecPath: ProjectStoreSlice["setConfiguredSpecPath"];
  setPrdPromptTemplate: ProjectStoreSlice["setPrdPromptTemplate"];
  setReasoningProfile: ProjectStoreSlice["setReasoningProfile"];
  setSelectedModel: ProjectStoreSlice["setSelectedModel"];
  setSpecPromptTemplate: ProjectStoreSlice["setSpecPromptTemplate"];
  setSupportingDocumentPaths: ProjectStoreSlice["setSupportingDocumentPaths"];
}

export function useProjectSettingsHandlers({
  saveCurrentProjectSettings,
  scheduleProjectSettingsSave,
  setConfiguredPrdPath,
  setConfiguredSpecPath,
  setPrdPromptTemplate,
  setReasoningProfile,
  setSelectedModel,
  setSpecPromptTemplate,
  setSupportingDocumentPaths
}: UseProjectSettingsHandlersOptions) {
  const handleProjectModelChange = useCallback(
    (model: Parameters<ProjectStoreSlice["setSelectedModel"]>[0]) => {
      setSelectedModel(model);
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setSelectedModel]
  );

  const handleProjectReasoningChange = useCallback(
    (reasoning: Parameters<ProjectStoreSlice["setReasoningProfile"]>[0]) => {
      setReasoningProfile(reasoning);
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setReasoningProfile]
  );

  const handlePrdPromptTemplateChange = useCallback(
    (value: string) => {
      setPrdPromptTemplate(value);
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setPrdPromptTemplate]
  );

  const handleSpecPromptTemplateChange = useCallback(
    (value: string) => {
      setSpecPromptTemplate(value);
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setSpecPromptTemplate]
  );

  const handleConfiguredPrdPathChange = useCallback(
    (value: string) => {
      setConfiguredPrdPath(normalizeProjectRelativePath(value));
      scheduleProjectSettingsSave(true);
    },
    [scheduleProjectSettingsSave, setConfiguredPrdPath]
  );

  const handleConfiguredSpecPathChange = useCallback(
    (value: string) => {
      setConfiguredSpecPath(normalizeProjectRelativePath(value));
      scheduleProjectSettingsSave(true);
    },
    [scheduleProjectSettingsSave, setConfiguredSpecPath]
  );

  const handleSupportingDocumentsChange = useCallback(
    (value: string) => {
      setSupportingDocumentPaths(parseSupportingDocumentPaths(value));
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setSupportingDocumentPaths]
  );

  const handleSaveConfigurationAndContinue = useCallback(() => {
    void saveCurrentProjectSettings({ reloadProject: true, navigateToChat: true });
  }, [saveCurrentProjectSettings]);

  return {
    handleProjectModelChange,
    handleProjectReasoningChange,
    handlePrdPromptTemplateChange,
    handleSpecPromptTemplateChange,
    handleConfiguredPrdPathChange,
    handleConfiguredSpecPathChange,
    handleSupportingDocumentsChange,
    handleSaveConfigurationAndContinue
  };
}

export type ProjectSettingsHandlers = ReturnType<typeof useProjectSettingsHandlers>;

interface UseAppUiHandlersOptions {
  agentState: AgentStoreSlice;
  handleApproveExecutionGate: () => Promise<void>;
  handleEmergencyStop: () => Promise<void>;
  handleGeneratePrd: () => Promise<void>;
  handleGenerateSpec: () => Promise<void>;
  handleOpenImportFile: (target: DocumentTarget) => Promise<void>;
  handleStartBuild: () => Promise<void>;
  handleWorkspaceFileOpen: (path: string) => Promise<void>;
  prdGenerationError: string;
  projectState: ProjectStoreSlice;
  refreshDiagnostics: (previousEnvironment?: EnvironmentStatus) => Promise<void>;
  setCommandSearch: Dispatch<SetStateAction<string>>;
  setIsSearchOpen: Dispatch<SetStateAction<boolean>>;
  setPrdGenerationError: Dispatch<SetStateAction<string>>;
  setPrdGenerationPrompt: Dispatch<SetStateAction<string>>;
  setSpecGenerationError: Dispatch<SetStateAction<string>>;
  setSpecGenerationPrompt: Dispatch<SetStateAction<string>>;
  specGenerationError: string;
}

export function useAppUiHandlers({
  agentState,
  handleApproveExecutionGate,
  handleEmergencyStop,
  handleGeneratePrd,
  handleGenerateSpec,
  handleOpenImportFile,
  handleStartBuild,
  handleWorkspaceFileOpen,
  prdGenerationError,
  projectState,
  refreshDiagnostics,
  setCommandSearch,
  setIsSearchOpen,
  setPrdGenerationError,
  setPrdGenerationPrompt,
  setSpecGenerationError,
  setSpecGenerationPrompt,
  specGenerationError
}: UseAppUiHandlersOptions) {
  const handlePrdContentChange = useCallback(
    (value: string) => {
      projectState.setPrdContent(value, projectState.prdPath);
    },
    [projectState]
  );

  const handleSpecContentChange = useCallback(
    (value: string) => {
      if (value.trim()) {
        setSpecGenerationError("");
      }

      projectState.setSpecContent(value, projectState.specPath);
    },
    [projectState, setSpecGenerationError]
  );

  const handleSpecSelect = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const { selectionStart, selectionEnd, value } = event.target;

      projectState.setSelectedSpecRange(
        selectionStart === selectionEnd
          ? null
          : {
              start: selectionStart,
              end: selectionEnd,
              text: value.slice(selectionStart, selectionEnd)
            }
      );
    },
    [projectState]
  );

  const handlePrdGenerationPromptChange = useCallback(
    (value: string) => {
      setPrdGenerationPrompt(value);

      if (prdGenerationError) {
        setPrdGenerationError("");
      }

      if (agentState.status === "error") {
        agentState.setStatus("idle");
      }
    },
    [
      agentState,
      prdGenerationError,
      setPrdGenerationError,
      setPrdGenerationPrompt
    ]
  );

  const handleSpecGenerationPromptChange = useCallback(
    (value: string) => {
      setSpecGenerationPrompt(value);

      if (specGenerationError) {
        setSpecGenerationError("");
      }

      if (agentState.status === "error") {
        agentState.setStatus("idle");
      }
    },
    [
      agentState,
      setSpecGenerationError,
      setSpecGenerationPrompt,
      specGenerationError
    ]
  );

  const handleCommandSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setCommandSearch(event.target.value);
    },
    [setCommandSearch]
  );

  const closeWorkspaceSearch = useCallback(() => {
    setIsSearchOpen(false);
    setCommandSearch("");
  }, [setCommandSearch, setIsSearchOpen]);

  const handleRefresh = useCallback(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handleOpenPrdImportClick = useCallback(() => {
    void handleOpenImportFile("prd");
  }, [handleOpenImportFile]);

  const handleOpenSpecImportClick = useCallback(() => {
    void handleOpenImportFile("spec");
  }, [handleOpenImportFile]);

  const handleStartBuildClick = useCallback(() => {
    void handleStartBuild();
  }, [handleStartBuild]);

  const handleApproveExecutionGateClick = useCallback(() => {
    void handleApproveExecutionGate();
  }, [handleApproveExecutionGate]);

  const handleEmergencyStopClick = useCallback(() => {
    void handleEmergencyStop();
  }, [handleEmergencyStop]);

  const handleWorkspaceFolderSelection = useCallback(
    (_event: ChangeEvent<HTMLInputElement>) => undefined,
    []
  );

  const handleWorkspaceFileOpenClick = useCallback(
    (path: string) => {
      void handleWorkspaceFileOpen(path);
    },
    [handleWorkspaceFileOpen]
  );

  const handleGeneratePrdClick = useCallback(() => {
    void handleGeneratePrd();
  }, [handleGeneratePrd]);

  const handleGenerateSpecClick = useCallback(() => {
    void handleGenerateSpec();
  }, [handleGenerateSpec]);

  return {
    handlePrdContentChange,
    handleSpecContentChange,
    handleSpecSelect,
    handlePrdGenerationPromptChange,
    handleSpecGenerationPromptChange,
    handleCommandSearchChange,
    closeWorkspaceSearch,
    handleRefresh,
    handleOpenPrdImportClick,
    handleOpenSpecImportClick,
    handleStartBuildClick,
    handleApproveExecutionGateClick,
    handleEmergencyStopClick,
    handleWorkspaceFolderSelection,
    handleWorkspaceFileOpenClick,
    handleGeneratePrdClick,
    handleGenerateSpecClick
  };
}

export type AppUiHandlers = ReturnType<typeof useAppUiHandlers>;

interface UseAppScreenPropsOptions {
  agentState: AgentStoreSlice;
  commandSearch: string;
  derivedState: AppDerivedState;
  desktopRuntime: boolean;
  folderInputRef: RefObject<HTMLInputElement | null>;
  handleApproveSpec: () => void;
  handleOpenChat: () => void;
  handlePickProjectFolder: () => Promise<void>;
  hasSavedProjectSettings: boolean;
  isImporting: boolean;
  isProjectLoading: boolean;
  isProjectSaving: boolean;
  isSearchOpen: boolean;
  reviewVisibleDiff: string;
  prdGenerationError: string;
  prdGenerationPrompt: string;
  projectErrorMessage: string;
  projectRootName: string;
  projectRootPath: string;
  projectSettingsHandlers: ProjectSettingsHandlers;
  projectState: ProjectStoreSlice;
  projectStatusMessage: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  settingsState: SettingsStoreSlice;
  specGenerationError: string;
  specGenerationPrompt: string;
  uiHandlers: AppUiHandlers;
  workspaceNotice: string;
}

export function useAppScreenProps({
  agentState,
  commandSearch,
  derivedState,
  desktopRuntime,
  folderInputRef,
  handleApproveSpec,
  handleOpenChat,
  handlePickProjectFolder,
  hasSavedProjectSettings,
  isImporting,
  isProjectLoading,
  isProjectSaving,
  isSearchOpen,
  reviewVisibleDiff,
  prdGenerationError,
  prdGenerationPrompt,
  projectErrorMessage,
  projectRootName,
  projectRootPath,
  projectSettingsHandlers,
  projectState,
  projectStatusMessage,
  searchInputRef,
  settingsState,
  specGenerationError,
  specGenerationPrompt,
  uiHandlers,
  workspaceNotice
}: UseAppScreenPropsOptions) {
  const controlColumnProps = useMemo(
    () => ({
      configuredModelProviders: derivedState.configuredModelProviders,
      autonomyMode: projectState.autonomyMode,
      mcpItems: derivedState.mcpItems,
      onModeChange: projectState.setAutonomyMode,
      onModelChange: projectSettingsHandlers.handleProjectModelChange,
      onReasoningChange: projectSettingsHandlers.handleProjectReasoningChange,
      selectedModel: projectState.selectedModel,
      selectedReasoning: projectState.selectedReasoning
    }),
    [derivedState, projectSettingsHandlers, projectState]
  );

  const mainWorkspaceProps = useMemo(
    () => ({
      activeTab: projectState.activeTab,
      agentStatus: agentState.status,
      canGeneratePrd: derivedState.canGeneratePrd,
      canGenerateSpec: derivedState.canGenerateSpec,
      configPath: derivedState.configPathDisplay,
      executionSummary: agentState.executionSummary,
      isGeneratingPrd: derivedState.isGeneratingPrd,
      isGeneratingSpec: derivedState.isGeneratingSpec,
      isSpecApproved: projectState.isSpecApproved,
      executionControlsEnabled: false,
      onActiveTabChange: projectState.setActiveTab,
      onApproveExecutionGate: uiHandlers.handleApproveExecutionGateClick,
      onApproveSpec: handleApproveSpec,
      onEditorTabChange: projectState.updateEditorTabContent,
      onEditorTabClose: projectState.closeEditorTab,
      onEmergencyStop: uiHandlers.handleEmergencyStopClick,
      onGeneratePrd: uiHandlers.handleGeneratePrdClick,
      onGenerateSpec: uiHandlers.handleGenerateSpecClick,
      onLoadPrd: uiHandlers.handleOpenPrdImportClick,
      onLoadSpec: uiHandlers.handleOpenSpecImportClick,
      onPrdContentChange: uiHandlers.handlePrdContentChange,
      onPrdGenerationPromptChange: uiHandlers.handlePrdGenerationPromptChange,
      onPrdPaneModeChange: projectState.setPrdPaneMode,
      onSpecContentChange: uiHandlers.handleSpecContentChange,
      onSpecGenerationPromptChange: uiHandlers.handleSpecGenerationPromptChange,
      onSpecPaneModeChange: projectState.setSpecPaneMode,
      onSpecSelect: uiHandlers.handleSpecSelect,
      openEditorTabs: projectState.openEditorTabs,
      prdContent: projectState.prdContent,
      prdGenerationError,
      prdGenerationHelperText: derivedState.prdGenerationHelperText,
      prdGenerationPrompt,
      prdPaneMode: projectState.prdPaneMode,
      prdPath: projectState.prdPath,
      prdPromptTemplate: projectState.prdPromptTemplate,
      specContent: projectState.specContent,
      specGenerationError,
      specGenerationHelperText: derivedState.specGenerationHelperText,
      specGenerationPrompt,
      specPaneMode: projectState.specPaneMode,
      specPath: projectState.specPath,
      specPromptTemplate: projectState.specPromptTemplate,
      terminalOutput: agentState.terminalOutput,
      visibleDiff: reviewVisibleDiff,
      workspaceRootName: projectRootName
    }),
    [
      agentState,
      derivedState,
      handleApproveSpec,
      prdGenerationError,
      prdGenerationPrompt,
      projectRootName,
      projectState,
      reviewVisibleDiff,
      specGenerationError,
      specGenerationPrompt,
      uiHandlers
    ]
  );

  const inspectorColumnProps = useMemo(
    () => ({
      emptyStateMessage: derivedState.deferredSearch.trim()
        ? `No files match "${derivedState.deferredSearch.trim()}".`
        : "Choose another project folder from setup if you want to switch workspaces.",
      folderInputRef,
      hasWorkspaceEntries: settingsState.workspaceEntries.length > 0,
      onFileOpen: uiHandlers.handleWorkspaceFileOpenClick,
      onFolderChange: uiHandlers.handleWorkspaceFolderSelection,
      onOpenFolder: handlePickProjectFolder,
      workspaceEntries: derivedState.filteredWorkspaceEntries,
      workspaceNotice,
      workspaceRootName: projectRootName
    }),
    [
      derivedState,
      folderInputRef,
      handlePickProjectFolder,
      projectRootName,
      settingsState.workspaceEntries.length,
      uiHandlers,
      workspaceNotice
    ]
  );

  const reviewScreenProps = useMemo<ComponentProps<typeof PrdScreen>>(
    () => ({
      agentStatus: agentState.status,
      commandSearch,
      controlColumnProps,
      inspectorColumnProps,
      isSearchOpen,
      isSpecApproved: projectState.isSpecApproved,
      mainWorkspaceProps,
      onCommandSearchChange: uiHandlers.handleCommandSearchChange,
      onOpenChat: handleOpenChat,
      onRefresh: uiHandlers.handleRefresh,
      searchInputRef,
      workspaceRootName: projectRootName
    }),
    [
      agentState.status,
      commandSearch,
      controlColumnProps,
      handleOpenChat,
      inspectorColumnProps,
      isSearchOpen,
      mainWorkspaceProps,
      projectRootName,
      projectState.isSpecApproved,
      searchInputRef,
      uiHandlers
    ]
  );

  const settingsScreenProps = useMemo<ComponentProps<typeof SettingsScreen>>(
    () => ({
      agentStatus: agentState.status,
      onRefresh: uiHandlers.handleRefresh,
      settingsViewProps: {
        annotations: projectState.annotations,
        claudePath: settingsState.claudePath,
        codexPath: settingsState.codexPath,
        configPath: derivedState.configPathDisplay,
        environment: settingsState.environment,
        onClaudePathChange: settingsState.setClaudePath,
        onCodexPathChange: settingsState.setCodexPath,
        onModelChange: projectSettingsHandlers.handleProjectModelChange,
        onPrdPathChange: projectSettingsHandlers.handleConfiguredPrdPathChange,
        onPrdPromptChange: projectSettingsHandlers.handlePrdPromptTemplateChange,
        onReasoningChange: projectSettingsHandlers.handleProjectReasoningChange,
        onSpecPathChange: projectSettingsHandlers.handleConfiguredSpecPathChange,
        onSpecPromptChange: projectSettingsHandlers.handleSpecPromptTemplateChange,
        onSupportingDocumentsChange: projectSettingsHandlers.handleSupportingDocumentsChange,
        onThemeChange: settingsState.setTheme,
        prdPath: projectState.configuredPrdPath,
        prdPrompt: projectState.prdPromptTemplate,
        projectErrorMessage,
        projectStatusMessage,
        selectedModel: projectState.selectedModel,
        selectedReasoning: projectState.selectedReasoning,
        specPath: projectState.configuredSpecPath,
        specPrompt: projectState.specPromptTemplate,
        supportingDocumentsValue: derivedState.supportingDocumentsValue,
        theme: settingsState.theme,
        workspaceRootName: projectRootName
      }
    }),
    [
      agentState.status,
      derivedState,
      projectErrorMessage,
      projectRootName,
      projectSettingsHandlers,
      projectState,
      projectStatusMessage,
      settingsState,
      uiHandlers
    ]
  );

  const configurationScreenProps = useMemo<ComponentProps<typeof ConfigurationScreen>>(
    () => ({
      claudePath: settingsState.claudePath,
      codexPath: settingsState.codexPath,
      desktopRuntime,
      environment: settingsState.environment,
      errorMessage: projectErrorMessage,
      hasSavedSettings: hasSavedProjectSettings,
      isProjectLoading: isProjectLoading || isImporting,
      isSaving: isProjectSaving,
      onClaudePathChange: settingsState.setClaudePath,
      onCodexPathChange: settingsState.setCodexPath,
      onContinue: projectSettingsHandlers.handleSaveConfigurationAndContinue,
      onModelChange: projectSettingsHandlers.handleProjectModelChange,
      onPickFolder: handlePickProjectFolder,
      onPrdPathChange: projectSettingsHandlers.handleConfiguredPrdPathChange,
      onPrdPromptChange: projectSettingsHandlers.handlePrdPromptTemplateChange,
      onReasoningChange: projectSettingsHandlers.handleProjectReasoningChange,
      onRefresh: uiHandlers.handleRefresh,
      onSpecPathChange: projectSettingsHandlers.handleConfiguredSpecPathChange,
      onSpecPromptChange: projectSettingsHandlers.handleSpecPromptTemplateChange,
      onSupportingDocumentsChange: projectSettingsHandlers.handleSupportingDocumentsChange,
      prdPath: projectState.configuredPrdPath,
      prdPrompt: projectState.prdPromptTemplate,
      selectedModel: projectState.selectedModel,
      selectedReasoning: projectState.selectedReasoning,
      settingsPath: derivedState.configPathDisplay,
      specPath: projectState.configuredSpecPath,
      specPrompt: projectState.specPromptTemplate,
      statusMessage: projectStatusMessage,
      supportingDocumentsValue: derivedState.supportingDocumentsValue,
      workspaceRootName: projectRootName,
      workspaceRootPath: projectRootPath
    }),
    [
      derivedState,
      desktopRuntime,
      handlePickProjectFolder,
      hasSavedProjectSettings,
      isImporting,
      isProjectLoading,
      isProjectSaving,
      projectErrorMessage,
      projectRootName,
      projectRootPath,
      projectSettingsHandlers,
      projectState,
      projectStatusMessage,
      settingsState,
      uiHandlers
    ]
  );

  return {
    configurationScreenProps,
    reviewScreenProps,
    settingsScreenProps
  };
}
