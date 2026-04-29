import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction, 
  useCallback
} from "react";

import type { DocumentTarget } from "../lib/appShell";
import {
  deleteCursorApiKey,
  saveCursorApiKey
} from "../lib/runtime";
import type { EnvironmentStatus } from "../types";
import type { AgentStoreSlice, ProjectStoreSlice, SettingsStoreSlice } from "./useAppStoreSlices";

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
  settingsState: SettingsStoreSlice;
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
  settingsState,
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
      setPrdGenerationError(
        error instanceof Error ? error.message : "Unable to save the Cursor API key."
      );
    }
  }, [refreshDiagnostics, setPrdGenerationError, settingsState]);

  const handleDeleteCursorApiKeyClick = useCallback(async () => {
    try {
      await deleteCursorApiKey();
      settingsState.setCursorApiKeyInput("");
      await refreshDiagnostics();
    } catch (error) {
      setPrdGenerationError(
        error instanceof Error ? error.message : "Unable to delete the Cursor API key."
      );
    }
  }, [refreshDiagnostics, setPrdGenerationError, settingsState]);

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
