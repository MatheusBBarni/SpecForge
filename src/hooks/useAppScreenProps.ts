import {
  type ComponentProps,
  type RefObject, 
  useMemo
} from "react";

import type { ConfigurationScreen } from "../screens/ConfigurationScreen";
import type { PrdScreen } from "../screens/PrdScreen";
import type { SettingsScreen } from "../screens/SettingsScreen";
import type { AgentStoreSlice, ProjectStoreSlice, SettingsStoreSlice, WorkspaceUiStoreSlice } from "./useAppStoreSlices";
import type { AppUiHandlers } from "./useAppUiHandlers";
import type { AppDerivedState } from "./useAppView";
import type { ProjectSettingsHandlers } from "./useProjectSettingsHandlers";

interface UseAppScreenPropsOptions {
  agentState: AgentStoreSlice;
  derivedState: AppDerivedState;
  desktopRuntime: boolean;
  folderInputRef: RefObject<HTMLInputElement | null>;
  handleApproveSpec: () => void;
  handleOpenWorkspaceFileInEditor: (path: string, editorId: string) => Promise<void>;
  handleOpenChat: () => void;
  handleOpenRecentProject: (path: string) => Promise<void>;
  handlePickProjectFolder: () => Promise<void>;
  reviewVisibleDiff: string;
  projectSettingsHandlers: ProjectSettingsHandlers;
  projectState: ProjectStoreSlice;
  searchInputRef: RefObject<HTMLInputElement | null>;
  settingsState: SettingsStoreSlice;
  uiHandlers: AppUiHandlers;
  workspaceUiState: WorkspaceUiStoreSlice;
}

export function useAppScreenProps({
  agentState,
  derivedState,
  desktopRuntime,
  folderInputRef,
  handleApproveSpec,
  handleOpenWorkspaceFileInEditor,
  handleOpenChat,
  handleOpenRecentProject,
  handlePickProjectFolder,
  reviewVisibleDiff,
  projectSettingsHandlers,
  projectState,
  searchInputRef,
  settingsState,
  uiHandlers,
  workspaceUiState
}: UseAppScreenPropsOptions) {
  const controlColumnProps = useMemo(
    () => ({
      configuredModelProviders: derivedState.configuredModelProviders,
      cursorModels: workspaceUiState.cursorModels,
      autonomyMode: projectState.autonomyMode,
      mcpItems: derivedState.mcpItems,
      onModeChange: projectState.setAutonomyMode,
      onModelChange: projectSettingsHandlers.handleProjectModelChange,
      onReasoningChange: projectSettingsHandlers.handleProjectReasoningChange,
      selectedModel: projectState.selectedModel,
      selectedReasoning: projectState.selectedReasoning
    }),
    [derivedState, projectSettingsHandlers, projectState, workspaceUiState.cursorModels]
  );

  const mainWorkspaceProps = useMemo(
    () => ({
      activeTab: projectState.activeTab,
      agentStatus: agentState.status,
      canGeneratePrd: derivedState.canGeneratePrd,
      canGenerateSpec: derivedState.canGenerateSpec,
      configPath: derivedState.configPathDisplay,
      executionSummary: agentState.executionSummary,
      externalEditors: workspaceUiState.externalEditors,
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
      prdGenerationError: workspaceUiState.prdGenerationError,
      prdGenerationHelperText: derivedState.prdGenerationHelperText,
      prdGenerationPrompt: workspaceUiState.prdGenerationPrompt,
      prdPaneMode: projectState.prdPaneMode,
      prdPath: projectState.prdPath,
      prdPromptTemplate: projectState.prdPromptTemplate,
      specContent: projectState.specContent,
      specGenerationError: workspaceUiState.specGenerationError,
      specGenerationHelperText: derivedState.specGenerationHelperText,
      specGenerationPrompt: workspaceUiState.specGenerationPrompt,
      specPaneMode: projectState.specPaneMode,
      specPath: projectState.specPath,
      specPromptTemplate: projectState.specPromptTemplate,
      terminalOutput: agentState.terminalOutput,
      visibleDiff: reviewVisibleDiff,
      workspaceRootName: workspaceUiState.projectRootName
    }),
    [
      agentState,
      derivedState,
      handleApproveSpec,
      handleOpenWorkspaceFileInEditor,
      projectState,
      reviewVisibleDiff,
      uiHandlers,
      workspaceUiState.externalEditors,
      workspaceUiState.prdGenerationError,
      workspaceUiState.prdGenerationPrompt,
      workspaceUiState.projectRootName,
      workspaceUiState.specGenerationError,
      workspaceUiState.specGenerationPrompt
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
      workspaceNotice: workspaceUiState.workspaceNotice,
      workspaceRootName: workspaceUiState.projectRootName,
      workspaceRootPath: workspaceUiState.projectRootPath
    }),
    [
      derivedState,
      folderInputRef,
      handlePickProjectFolder,
      settingsState.workspaceEntries.length,
      uiHandlers,
      workspaceUiState.projectRootName,
      workspaceUiState.projectRootPath,
      workspaceUiState.workspaceNotice
    ]
  );

  const reviewScreenProps = useMemo<ComponentProps<typeof PrdScreen>>(
    () => ({
      controlColumnProps,
      inspectorColumnProps,
      mainWorkspaceProps,
      onOpenChat: handleOpenChat,
      onRefresh: uiHandlers.handleRefresh,
      searchInputRef
    }),
    [
      controlColumnProps,
      handleOpenChat,
      inspectorColumnProps,
      mainWorkspaceProps,
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
            cursorModels: workspaceUiState.cursorModels,
            prdPath: projectState.configuredPrdPath,
        prdPrompt: projectState.prdPromptTemplate,
        projectErrorMessage: workspaceUiState.projectErrorMessage,
        projectStatusMessage: workspaceUiState.projectStatusMessage,
        selectedModel: projectState.selectedModel,
        selectedReasoning: projectState.selectedReasoning,
        specPath: projectState.configuredSpecPath,
        specPrompt: projectState.specPromptTemplate,
        supportingDocumentsValue: derivedState.supportingDocumentsValue,
        theme: settingsState.theme,
        workspaceRootName: workspaceUiState.projectRootName
      }
    }),
    [
      agentState.status,
      derivedState,
      projectSettingsHandlers,
      projectState,
      settingsState,
      uiHandlers,
      workspaceUiState.cursorModels,
      workspaceUiState.projectErrorMessage,
      workspaceUiState.projectRootName,
      workspaceUiState.projectStatusMessage
    ]
  );

  const configurationScreenProps = useMemo<ComponentProps<typeof ConfigurationScreen>>(
    () => ({
      cursorApiKeyInput: settingsState.cursorApiKeyInput,
      desktopRuntime,
      environment: settingsState.environment,
      errorMessage: workspaceUiState.projectErrorMessage,
      hasSavedSettings: workspaceUiState.hasSavedProjectSettings,
      isProjectLoading: workspaceUiState.isProjectLoading || workspaceUiState.isImporting,
      isSaving: workspaceUiState.isProjectSaving,
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
      cursorModels: workspaceUiState.cursorModels,
      selectedModel: projectState.selectedModel,
      selectedReasoning: projectState.selectedReasoning,
      settingsPath: derivedState.configPathDisplay,
      specPath: projectState.configuredSpecPath,
      specPrompt: projectState.specPromptTemplate,
      executionAgentDescription: projectState.executionAgentDescription,
      statusMessage: workspaceUiState.projectStatusMessage,
      supportingDocumentsValue: derivedState.supportingDocumentsValue,
      recentProjects: settingsState.recentProjects,
      workspaceRootName: workspaceUiState.projectRootName,
      workspaceRootPath: workspaceUiState.projectRootPath
    }),
    [
      derivedState,
      desktopRuntime,
      handleOpenRecentProject,
      handlePickProjectFolder,
      projectSettingsHandlers,
      projectState,
      settingsState,
      uiHandlers,
      workspaceUiState
    ]
  );

  return {
    configurationScreenProps,
    reviewScreenProps,
    settingsScreenProps
  };
}
