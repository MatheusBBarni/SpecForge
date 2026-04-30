import {
  type ChangeEvent,
  useCallback
} from "react";

import type { DocumentTarget } from "../lib/appShell";
import {
  deleteCursorApiKey,
  saveCursorApiKey
} from "../lib/runtime";
import type { EnvironmentStatus } from "../types";
import type {
  AgentStoreSlice,
  ProjectStoreSlice,
  SettingsStoreSlice,
  WorkspaceUiStoreSlice
} from "./useAppStoreSlices";

interface UseAppUiHandlersOptions {
  agentState: AgentStoreSlice;
  handleApproveExecutionGate: () => Promise<void>;
  handleEmergencyStop: () => Promise<void>;
  handleGeneratePrd: () => Promise<void>;
  handleGenerateSpec: () => Promise<void>;
  handleOpenImportFile: (target: DocumentTarget) => Promise<void>;
  handleStartBuild: () => Promise<void>;
  handleWorkspaceFileOpen: (path: string) => Promise<void>;
  projectState: ProjectStoreSlice;
  refreshDiagnostics: (previousEnvironment?: EnvironmentStatus) => Promise<void>;
  settingsState: SettingsStoreSlice;
  workspaceUiState: WorkspaceUiStoreSlice;
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
  projectState,
  refreshDiagnostics,
  settingsState,
  workspaceUiState
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
        workspaceUiState.setSpecGenerationError("");
      }

      projectState.setSpecContent(value, projectState.specPath);
    },
    [projectState, workspaceUiState]
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
      workspaceUiState.setPrdGenerationPrompt(value);

      if (workspaceUiState.prdGenerationError) {
        workspaceUiState.setPrdGenerationError("");
      }

      if (agentState.status === "error") {
        agentState.setStatus("idle");
      }
    },
    [
      agentState,
      workspaceUiState
    ]
  );

  const handleSpecGenerationPromptChange = useCallback(
    (value: string) => {
      workspaceUiState.setSpecGenerationPrompt(value);

      if (workspaceUiState.specGenerationError) {
        workspaceUiState.setSpecGenerationError("");
      }

      if (agentState.status === "error") {
        agentState.setStatus("idle");
      }
    },
    [
      agentState,
      workspaceUiState
    ]
  );

  const handleCommandSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      workspaceUiState.setCommandSearch(event.target.value);
    },
    [workspaceUiState]
  );

  const closeWorkspaceSearch = useCallback(() => {
    workspaceUiState.setIsSearchOpen(false);
    workspaceUiState.setCommandSearch("");
  }, [workspaceUiState]);

  const handleRefresh = useCallback(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handleSaveCursorApiKeyClick = useCallback(async () => {
    const apiKey = settingsState.cursorApiKeyInput.trim();

    if (!apiKey) {
      return;
    }

    try {
      await saveCursorApiKey(apiKey);
      settingsState.setCursorApiKeyInput("");
      await refreshDiagnostics();
    } catch (error) {
      workspaceUiState.setPrdGenerationError(
        error instanceof Error ? error.message : "Unable to save the Cursor API key."
      );
    }
  }, [refreshDiagnostics, settingsState, workspaceUiState]);

  const handleDeleteCursorApiKeyClick = useCallback(async () => {
    try {
      await deleteCursorApiKey();
      settingsState.setCursorApiKeyInput("");
      await refreshDiagnostics();
    } catch (error) {
      workspaceUiState.setPrdGenerationError(
        error instanceof Error ? error.message : "Unable to delete the Cursor API key."
      );
    }
  }, [refreshDiagnostics, settingsState, workspaceUiState]);

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
    handleSaveCursorApiKeyClick,
    handleDeleteCursorApiKeyClick,
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
