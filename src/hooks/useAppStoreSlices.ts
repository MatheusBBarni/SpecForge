import { useShallow } from "zustand/react/shallow";

import { useAgentStore } from "../store/useAgentStore";
import { useChatStore } from "../store/useChatStore";
import { useProjectStore } from "../store/useProjectStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useWorkspaceUiStore } from "../store/useWorkspaceUiStore";

export function useAgentStoreSlice() {
  return useAgentStore(
    useShallow((state) => ({
      status: state.status,
      terminalOutput: state.terminalOutput,
      pendingDiff: state.pendingDiff,
      executionSummary: state.executionSummary,
      resetRun: state.resetRun,
      appendTerminalOutput: state.appendTerminalOutput,
      setStatus: state.setStatus,
      setCurrentMilestone: state.setCurrentMilestone,
      setPendingDiff: state.setPendingDiff,
      setExecutionSummary: state.setExecutionSummary,
      syncFromChatRuntime: state.syncFromChatRuntime,
      applyEvent: state.applyEvent
    }))
  );
}

export type AgentStoreSlice = ReturnType<typeof useAgentStoreSlice>;

export function useProjectStoreSlice() {
  return useProjectStore(
    useShallow((state) => ({
      annotations: state.annotations,
      activeTab: state.activeTab,
      autonomyMode: state.autonomyMode,
      configuredPrdPath: state.configuredPrdPath,
      configuredSpecPath: state.configuredSpecPath,
      isSpecApproved: state.isSpecApproved,
      openEditorTabs: state.openEditorTabs,
      prdContent: state.prdContent,
      prdPaneMode: state.prdPaneMode,
      prdPath: state.prdPath,
      prdPromptTemplate: state.prdPromptTemplate,
      selectedModel: state.selectedModel,
      selectedReasoning: state.selectedReasoning,
      specContent: state.specContent,
      specPaneMode: state.specPaneMode,
      specPath: state.specPath,
      specPromptTemplate: state.specPromptTemplate,
      executionAgentDescription: state.executionAgentDescription,
      supportingDocumentPaths: state.supportingDocumentPaths,
      approveSpec: state.approveSpec,
      closeEditorTab: state.closeEditorTab,
      openEditorTab: state.openEditorTab,
      resetWorkspaceContext: state.resetWorkspaceContext,
      setActiveTab: state.setActiveTab,
      setAutonomyMode: state.setAutonomyMode,
      setConfiguredPrdPath: state.setConfiguredPrdPath,
      setConfiguredSpecPath: state.setConfiguredSpecPath,
      setPrdContent: state.setPrdContent,
      setPrdPaneMode: state.setPrdPaneMode,
      setPrdPromptTemplate: state.setPrdPromptTemplate,
      setProjectSettings: state.setProjectSettings,
      setReasoningProfile: state.setReasoningProfile,
      setSelectedModel: state.setSelectedModel,
      setSelectedSpecRange: state.setSelectedSpecRange,
      setSpecContent: state.setSpecContent,
      setSpecPaneMode: state.setSpecPaneMode,
      setSpecPromptTemplate: state.setSpecPromptTemplate,
      setExecutionAgentDescription: state.setExecutionAgentDescription,
      setSupportingDocumentPaths: state.setSupportingDocumentPaths,
      updateEditorTabContent: state.updateEditorTabContent
    }))
  );
}

export type ProjectStoreSlice = ReturnType<typeof useProjectStoreSlice>;

export function useChatStoreSlice() {
  return useChatStore(
    useShallow((state) => ({
      sessions: state.sessions,
      activeSessionId: state.activeSessionId,
      loadedSessions: state.loadedSessions,
      drafts: state.drafts,
      cavemanReady: state.cavemanReady,
      cavemanMessage: state.cavemanMessage,
      cavemanChecking: state.cavemanChecking,
      setSessions: state.setSessions,
      setActiveSessionId: state.setActiveSessionId,
      upsertSession: state.upsertSession,
      setDraft: state.setDraft,
      setContextItems: state.setContextItems,
      setSessionConfig: state.setSessionConfig,
      deleteSession: state.deleteSession,
      setCavemanStatus: state.setCavemanStatus
    }))
  );
}

export type ChatStoreSlice = ReturnType<typeof useChatStoreSlice>;

export function useSettingsStoreSlice() {
  return useSettingsStore(
    useShallow((state) => ({
      cursorApiKeyInput: state.cursorApiKeyInput,
      environment: state.environment,
      lastProjectPath: state.lastProjectPath,
      recentProjects: state.recentProjects,
      theme: state.theme,
      workspaceEntries: state.workspaceEntries,
      setCursorApiKeyInput: state.setCursorApiKeyInput,
      setEnvironment: state.setEnvironment,
      setLastProjectPath: state.setLastProjectPath,
      rememberRecentProject: state.rememberRecentProject,
      setTheme: state.setTheme,
      setWorkspaceEntries: state.setWorkspaceEntries
    }))
  );
}

export type SettingsStoreSlice = ReturnType<typeof useSettingsStoreSlice>;

export function useWorkspaceUiStoreSlice() {
  return useWorkspaceUiStore(
    useShallow((state) => ({
      commandSearch: state.commandSearch,
      isImporting: state.isImporting,
      isSearchOpen: state.isSearchOpen,
      isProjectLoading: state.isProjectLoading,
      isProjectSaving: state.isProjectSaving,
      latestDiff: state.latestDiff,
      projectConfigPath: state.projectConfigPath,
      projectErrorMessage: state.projectErrorMessage,
      projectRootName: state.projectRootName,
      projectRootPath: state.projectRootPath,
      projectStatusMessage: state.projectStatusMessage,
      workspaceNotice: state.workspaceNotice,
      externalEditors: state.externalEditors,
      cursorModels: state.cursorModels,
      hasSavedProjectSettings: state.hasSavedProjectSettings,
      hasSelectedProject: state.hasSelectedProject,
      hasAttemptedProjectRestore: state.hasAttemptedProjectRestore,
      workspaceFiles: state.workspaceFiles,
      prdGenerationPrompt: state.prdGenerationPrompt,
      prdGenerationError: state.prdGenerationError,
      specGenerationPrompt: state.specGenerationPrompt,
      specGenerationError: state.specGenerationError,
      setCommandSearch: state.setCommandSearch,
      setIsImporting: state.setIsImporting,
      setIsSearchOpen: state.setIsSearchOpen,
      setIsProjectLoading: state.setIsProjectLoading,
      setIsProjectSaving: state.setIsProjectSaving,
      setLatestDiff: state.setLatestDiff,
      resetLatestDiff: state.resetLatestDiff,
      setProjectConfigPath: state.setProjectConfigPath,
      setProjectErrorMessage: state.setProjectErrorMessage,
      setProjectRootName: state.setProjectRootName,
      setProjectRootPath: state.setProjectRootPath,
      setProjectStatusMessage: state.setProjectStatusMessage,
      setWorkspaceNotice: state.setWorkspaceNotice,
      setExternalEditors: state.setExternalEditors,
      setCursorModels: state.setCursorModels,
      setHasSavedProjectSettings: state.setHasSavedProjectSettings,
      setHasSelectedProject: state.setHasSelectedProject,
      setHasAttemptedProjectRestore: state.setHasAttemptedProjectRestore,
      setWorkspaceFiles: state.setWorkspaceFiles,
      setPrdGenerationPrompt: state.setPrdGenerationPrompt,
      setPrdGenerationError: state.setPrdGenerationError,
      setSpecGenerationPrompt: state.setSpecGenerationPrompt,
      setSpecGenerationError: state.setSpecGenerationError,
      clearGenerationState: state.clearGenerationState,
      setProjectShell: state.setProjectShell,
      resetWorkspaceUi: state.resetWorkspaceUi
    }))
  );
}

export type WorkspaceUiStoreSlice = ReturnType<typeof useWorkspaceUiStoreSlice>;
