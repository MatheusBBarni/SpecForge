import {
  type ComponentProps,
  type RefObject, 
  useMemo
} from "react";

import type { ConfigurationScreen } from "../screens/ConfigurationScreen";
import type { PrdScreen } from "../screens/PrdScreen";
import type { SettingsScreen } from "../screens/SettingsScreen";
import type { CursorModel, ExternalEditor } from "../types";
import type { AgentStoreSlice, ProjectStoreSlice, SettingsStoreSlice } from "./useAppStoreSlices";
import type { AppUiHandlers } from "./useAppUiHandlers";
import type { AppDerivedState } from "./useAppView";
import type { ProjectSettingsHandlers } from "./useProjectSettingsHandlers";

interface UseAppScreenPropsOptions {
  agentState: AgentStoreSlice;
  commandSearch: string;
  cursorModels: CursorModel[];
  derivedState: AppDerivedState;
  desktopRuntime: boolean;
  externalEditors: ExternalEditor[];
  folderInputRef: RefObject<HTMLInputElement | null>;
  handleApproveSpec: () => void;
  handleOpenWorkspaceFileInEditor: (path: string, editorId: string) => Promise<void>;
  handleOpenChat: () => void;
  handleOpenRecentProject: (path: string) => Promise<void>;
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
  cursorModels,
  derivedState,
  desktopRuntime,
  externalEditors,
  folderInputRef,
  handleApproveSpec,
  handleOpenWorkspaceFileInEditor,
  handleOpenChat,
  handleOpenRecentProject,
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
      cursorModels,
      autonomyMode: projectState.autonomyMode,
      mcpItems: derivedState.mcpItems,
      onModeChange: projectState.setAutonomyMode,
      onModelChange: projectSettingsHandlers.handleProjectModelChange,
      onReasoningChange: projectSettingsHandlers.handleProjectReasoningChange,
      selectedModel: projectState.selectedModel,
      selectedReasoning: projectState.selectedReasoning
    }),
    [cursorModels, derivedState, projectSettingsHandlers, projectState]
  );

  const mainWorkspaceProps = useMemo(
    () => ({
      activeTab: projectState.activeTab,
      agentStatus: agentState.status,
      canGeneratePrd: derivedState.canGeneratePrd,
      canGenerateSpec: derivedState.canGenerateSpec,
      configPath: derivedState.configPathDisplay,
      executionSummary: agentState.executionSummary,
      externalEditors,
      isGeneratingPrd: derivedState.isGeneratingPrd,
      isGeneratingSpec: derivedState.isGeneratingSpec,
      isSpecApproved: projectState.isSpecApproved,
      executionControlsEnabled: false,
      onActiveTabChange: projectState.setActiveTab,
      onApproveExecutionGate: uiHandlers.handleApproveExecutionGateClick,
      onApproveSpec: handleApproveSpec,
      onEditorTabClose: projectState.closeEditorTab,
      onOpenEditorTabExternally: (path: string, editorId: string) => {
        void handleOpenWorkspaceFileInEditor(path, editorId);
      },
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
      externalEditors,
      handleApproveSpec,
      handleOpenWorkspaceFileInEditor,
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
      workspaceRootName: projectRootName,
      workspaceRootPath: projectRootPath
    }),
    [
      derivedState,
      folderInputRef,
      handlePickProjectFolder,
      projectRootName,
      projectRootPath,
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
        configPath: derivedState.configPathDisplay,
        cursorApiKeyInput: settingsState.cursorApiKeyInput,
        executionAgentDescription: projectState.executionAgentDescription,
        environment: settingsState.environment,
        onCursorApiKeyInputChange: settingsState.setCursorApiKeyInput,
        onDeleteCursorApiKey: uiHandlers.handleDeleteCursorApiKeyClick,
        onExecutionAgentDescriptionChange:
          projectSettingsHandlers.handleExecutionAgentDescriptionChange,
        onModelChange: projectSettingsHandlers.handleProjectModelChange,
        onPrdPathChange: projectSettingsHandlers.handleConfiguredPrdPathChange,
        onPrdPromptChange: projectSettingsHandlers.handlePrdPromptTemplateChange,
        onReasoningChange: projectSettingsHandlers.handleProjectReasoningChange,
        onSpecPathChange: projectSettingsHandlers.handleConfiguredSpecPathChange,
            onSpecPromptChange: projectSettingsHandlers.handleSpecPromptTemplateChange,
            onSaveCursorApiKey: uiHandlers.handleSaveCursorApiKeyClick,
            onSupportingDocumentsChange: projectSettingsHandlers.handleSupportingDocumentsChange,
            onThemeChange: settingsState.setTheme,
            cursorModels,
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
      cursorModels,
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
      cursorApiKeyInput: settingsState.cursorApiKeyInput,
      desktopRuntime,
      environment: settingsState.environment,
      errorMessage: projectErrorMessage,
      hasSavedSettings: hasSavedProjectSettings,
      isProjectLoading: isProjectLoading || isImporting,
      isSaving: isProjectSaving,
      onCursorApiKeyInputChange: settingsState.setCursorApiKeyInput,
      onDeleteCursorApiKey: uiHandlers.handleDeleteCursorApiKeyClick,
      onContinue: projectSettingsHandlers.handleSaveConfigurationAndContinue,
      onExecutionAgentDescriptionChange:
        projectSettingsHandlers.handleExecutionAgentDescriptionChange,
      onModelChange: projectSettingsHandlers.handleProjectModelChange,
      onOpenRecentProject: handleOpenRecentProject,
      onPickFolder: handlePickProjectFolder,
      onPrdPathChange: projectSettingsHandlers.handleConfiguredPrdPathChange,
      onPrdPromptChange: projectSettingsHandlers.handlePrdPromptTemplateChange,
      onReasoningChange: projectSettingsHandlers.handleProjectReasoningChange,
      onRefresh: uiHandlers.handleRefresh,
      onSpecPathChange: projectSettingsHandlers.handleConfiguredSpecPathChange,
      onSpecPromptChange: projectSettingsHandlers.handleSpecPromptTemplateChange,
      onSaveCursorApiKey: uiHandlers.handleSaveCursorApiKeyClick,
      onSupportingDocumentsChange: projectSettingsHandlers.handleSupportingDocumentsChange,
      prdPath: projectState.configuredPrdPath,
      prdPrompt: projectState.prdPromptTemplate,
      cursorModels,
      selectedModel: projectState.selectedModel,
      selectedReasoning: projectState.selectedReasoning,
      settingsPath: derivedState.configPathDisplay,
      specPath: projectState.configuredSpecPath,
      specPrompt: projectState.specPromptTemplate,
      executionAgentDescription: projectState.executionAgentDescription,
      statusMessage: projectStatusMessage,
      supportingDocumentsValue: derivedState.supportingDocumentsValue,
      recentProjects: settingsState.recentProjects,
      workspaceRootName: projectRootName,
      workspaceRootPath: projectRootPath
    }),
    [
      derivedState,
      cursorModels,
      desktopRuntime,
      handleOpenRecentProject,
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
