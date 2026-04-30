import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import { AppRail } from "./components/AppRail";
import {
  useAgentEventSubscription,
  useDocumentTheme,
  useInitialDiagnostics,
  useProjectRestore,
  useSystemThemePreference,
  useWorkspaceSearchFocus,
  useWorkspaceSearchRouteReset,
  useWorkspaceSearchShortcuts
} from "./hooks/useAppLifecycle";
import {
  useAgentStoreSlice,
  useProjectStoreSlice,
  useSettingsStoreSlice,
  useWorkspaceUiStoreSlice
} from "./hooks/useAppStoreSlices";
import {
  useAppDerivedState,
  useAppScreenProps,
  useAppUiHandlers,
  useProjectSettingsHandlers
} from "./hooks/useAppView";
import { useChatHandlers } from "./hooks/useChatHandlers";
import { useDocumentHandlers } from "./hooks/useDocumentHandlers";
import { useProjectHandlers } from "./hooks/useProjectHandlers";
import {
  getModelLabel,
  getReasoningLabel
} from "./lib/agentConfig";
import {
  buildFallbackSteps,
  clearFallbackTimer,
  type DocumentTarget,
  type FallbackStep,
  runFallbackStep,
  stampLog
} from "./lib/appShell";
import {
  approveAgentAction,
  createChatSession,
  emergencyStop,
  getWorkspaceSnapshot,
  isTauriRuntime,
  listCursorModels,
  listExternalEditors,
  loadChatSession,
  openWorkspaceFileInEditor,
  readWorkspaceFile,
  runEnvironmentScan,
  startAgentRun,
  subscribeToChatSessionEvents
} from "./lib/runtime";
import {
  isOpenableTextFile,
  parseWorkspaceTextFile
} from "./lib/workspaceImport";

const ConfigurationScreen = lazy(() => import("./screens/ConfigurationScreen").then(m => ({ default: m.ConfigurationScreen })));
const ChatScreen = lazy(() => import("./screens/ChatScreen").then(m => ({ default: m.ChatScreen })));
const PrdScreen = lazy(() => import("./screens/PrdScreen").then(m => ({ default: m.PrdScreen })));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen").then(m => ({ default: m.SettingsScreen })));

import { useAgentStore } from "./store/useAgentStore";
import { useChatStore } from "./store/useChatStore";
import type {
  CursorModel,
  EnvironmentStatus
} from "./types";

interface CursorModelRefreshResult {
  models: CursorModel[];
  projectErrorMessage?: string;
}

async function refreshCursorModelsForEnvironment(
  environment: EnvironmentStatus
): Promise<CursorModelRefreshResult> {
  if (environment.cursor.status !== "found") {
    return { models: [] };
  }

  try {
    return {
      models: await listCursorModels(),
      projectErrorMessage: ""
    };
  } catch (error) {
    return {
      models: [],
      projectErrorMessage: error instanceof Error
        ? error.message
        : "Unable to load Cursor SDK models."
    };
  }
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isChatRoute = location.pathname === "/chat";
  const isReviewRoute = location.pathname === "/review";
  const desktopRuntime = isTauriRuntime();

  const agentState = useAgentStoreSlice();
  const projectState = useProjectStoreSlice();
  const settingsState = useSettingsStoreSlice();
  const workspaceUiState = useWorkspaceUiStoreSlice();
  const {
    sessions: chatSessions,
    activeSessionId,
    cavemanReady,
    cavemanMessage,
    cavemanChecking,
    setSessions: setChatSessions,
    setActiveSessionId,
    upsertSession,
    setDraft: setChatDraft,
    setContextItems: setChatContextItems,
    setSessionConfig,
    deleteSession: deleteChatSessionState,
    setCavemanStatus
  } = useChatStore(
    useShallow((state) => ({
      sessions: state.sessions,
      activeSessionId: state.activeSessionId,
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

  const [systemPrefersDark, setSystemPrefersDark] = useState(true);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportTargetRef = useRef<DocumentTarget>("prd");
  const fallbackTimerRef = useRef<number | null>(null);
  const fallbackStepsRef = useRef<FallbackStep[]>([]);
  const fallbackIndexRef = useRef(0);
  const hasScannedEnvironmentRef = useRef(false);
  const latestPathnameRef = useRef(location.pathname);
  const refreshDiagnosticsPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    latestPathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!desktopRuntime) {
      workspaceUiState.setHasAttemptedProjectRestore(true);
    }
  }, [desktopRuntime, workspaceUiState.setHasAttemptedProjectRestore]);

  const activeChatSession = useChatStore(
    useCallback(
      (state) =>
        state.activeSessionId ? state.loadedSessions[state.activeSessionId] ?? null : null,
      []
    )
  );
  const activeChatDraft = useChatStore(
    useCallback(
      (state) => (state.activeSessionId ? state.drafts[state.activeSessionId] ?? "" : ""),
      []
    )
  );
  const reviewVisibleDiff = activeChatSession
    ? activeChatSession.runtime.pendingDiff ?? "No diff captured for the active chat topic yet."
    : agentState.pendingDiff ?? workspaceUiState.latestDiff;

  const derivedState = useAppDerivedState({
    agentState,
    desktopRuntime,
    projectState,
    settingsState,
    systemPrefersDark,
    workspaceUiState
  });

  const refreshDiagnostics = useCallback(
    (previousEnvironment?: EnvironmentStatus) => {
      if (refreshDiagnosticsPromiseRef.current) {
        return refreshDiagnosticsPromiseRef.current;
      }

      const refreshPromise = (async () => {
        const [nextEnvironment, snapshotEntries, nextExternalEditors] = await Promise.all([
          runEnvironmentScan().catch(() => previousEnvironment ?? settingsState.environment),
          workspaceUiState.hasSelectedProject
            ? Promise.resolve(settingsState.workspaceEntries)
            : getWorkspaceSnapshot().catch(() => settingsState.workspaceEntries),
          listExternalEditors().catch(() => [])
        ]);

        settingsState.setEnvironment(nextEnvironment);
        workspaceUiState.setExternalEditors(nextExternalEditors);

        if (!workspaceUiState.hasSelectedProject) {
          settingsState.setWorkspaceEntries(snapshotEntries);
        }

        const cursorModelsResult = await refreshCursorModelsForEnvironment(nextEnvironment);
        workspaceUiState.setCursorModels(cursorModelsResult.models);

        if (cursorModelsResult.projectErrorMessage !== undefined) {
          workspaceUiState.setProjectErrorMessage(cursorModelsResult.projectErrorMessage);
        }
      })().finally(() => {
        refreshDiagnosticsPromiseRef.current = null;
      });

      refreshDiagnosticsPromiseRef.current = refreshPromise;
      return refreshPromise;
    },
    [settingsState, workspaceUiState]
  );

  // --- Document handlers ---
  const {
    handleOpenImportFile,
    handleFileSelection,
    handleGeneratePrd,
    handleGenerateSpec
  } = useDocumentHandlers({
    agentState,
    derivedState,
    desktopRuntime,
    fileInputRef,
    pendingImportTargetRef,
    projectState,
    settingsState,
    workspaceUiState
  });

  // --- Project handlers ---
  const {
    applyProjectContext,
    saveCurrentProjectSettings,
    scheduleProjectSettingsSave,
    handlePickProjectFolder,
    handleOpenRecentProject,
    projectSaveTimerRef
  } = useProjectHandlers({
    applyProjectContextDeps: {
      projectState,
      settingsState,
      workspaceUiState,
      setChatSessions,
      setActiveSessionId,
      setCavemanStatus,
      latestPathnameRef
    },
    derivedState,
    desktopRuntime,
    projectState,
    workspaceUiState
  });

  const projectSettingsHandlers = useProjectSettingsHandlers({
    saveCurrentProjectSettings,
    scheduleProjectSettingsSave,
    setConfiguredPrdPath: projectState.setConfiguredPrdPath,
    setConfiguredSpecPath: projectState.setConfiguredSpecPath,
    setExecutionAgentDescription: projectState.setExecutionAgentDescription,
    setPrdPromptTemplate: projectState.setPrdPromptTemplate,
    setReasoningProfile: projectState.setReasoningProfile,
    setSelectedModel: projectState.setSelectedModel,
    setSpecPromptTemplate: projectState.setSpecPromptTemplate,
    setSupportingDocumentPaths: projectState.setSupportingDocumentPaths
  });

  // --- Chat handlers ---
  const {
    handleCreateChatSessionClick,
    handleSelectChatSession,
    handleRenameChatSession,
    handleDeleteChatSession,
    handleChatDraftChange,
    handleSendChatMessage,
    handleApproveChatSession,
    handleStopChatSession,
    handleSaveChatSessionConfig,
    handleAttachChatFile,
    handleRemoveChatContextItem
  } = useChatHandlers({
    activeChatSession,
    activeChatDraft,
    activeSessionId,
    settingsState,
    upsertSession,
    setActiveSessionId,
    setChatDraft,
    setChatContextItems,
    setSessionConfig,
    deleteChatSessionState,
    setChatSessions,
    setProjectErrorMessage: workspaceUiState.setProjectErrorMessage
  });

  const handleWorkspaceFileOpen = useCallback(
    async (path: string) => {
      const file = workspaceUiState.workspaceFiles[path];

      if (!file) {
        workspaceUiState.setWorkspaceNotice(
          `The file ${path} is not available in the active workspace snapshot.`
        );
        return;
      }

      if (file.kind === "browser") {
        if (!isOpenableTextFile(file.file)) {
          workspaceUiState.setWorkspaceNotice(`${file.file.name} is not an openable text/code file.`);
          return;
        }

        const document = await parseWorkspaceTextFile(file.file);
        projectState.openEditorTab({
          title: file.file.name,
          path,
          content: document.content
        });
        return;
      }

      try {
        const content = await readWorkspaceFile(path);
        projectState.openEditorTab({
          title: file.fileName,
          path,
          content
        });
      } catch (error) {
        workspaceUiState.setWorkspaceNotice(
          error instanceof Error
            ? `Unable to open ${file.fileName}: ${error.message}`
            : `Unable to open ${file.fileName}.`
        );
      }
    },
    [projectState, workspaceUiState]
  );

  const handleOpenWorkspaceFileInEditor = useCallback(
    async (path: string, editorId: string) => {
      try {
        await openWorkspaceFileInEditor({ filePath: path, editorId });
        workspaceUiState.setWorkspaceNotice("");
      } catch (error) {
        workspaceUiState.setWorkspaceNotice(
          error instanceof Error ? error.message : "Unable to open the file in the selected editor."
        );
      }
    },
    [workspaceUiState]
  );

  const handleApproveSpec = useCallback(() => {
    if (!projectState.specContent.trim()) {
      return;
    }

    projectState.approveSpec();
    agentState.appendTerminalOutput(
      stampLog("review", "Specification approved. The active chat topics can now work from this spec.")
    );
  }, [agentState, projectState]);

  const handleStartBuild = useCallback(async () => {
    if (!projectState.isSpecApproved) {
      return;
    }

    const modelLabel = getModelLabel(projectState.selectedModel);
    const reasoningLabel = getReasoningLabel(
      projectState.selectedModel,
      projectState.selectedReasoning
    );

    clearFallbackTimer(fallbackTimerRef);
    agentState.resetRun();
    projectState.setActiveTab("execute");
    agentState.setStatus("executing");
    agentState.setCurrentMilestone("Pre-flight Check");
    agentState.appendTerminalOutput(
      stampLog(
        "build",
        `Starting spec-driven build run with ${modelLabel} (${reasoningLabel} reasoning).`
      )
    );

    if (desktopRuntime) {
      try {
        await startAgentRun(
          projectState.specContent,
          projectState.autonomyMode,
          projectState.selectedModel,
          projectState.selectedReasoning
        );
        return;
      } catch (error) {
        agentState.appendTerminalOutput(
          stampLog(
            "error",
            `${error instanceof Error ? error.message : "Agent startup failed."} Falling back to the local simulator.`
          )
        );
      }
    }

    fallbackStepsRef.current = buildFallbackSteps(
      projectState.autonomyMode,
      modelLabel,
      reasoningLabel
    );
    fallbackIndexRef.current = 0;
    runFallbackStep(
      useAgentStore.getState(),
      fallbackStepsRef,
      fallbackIndexRef,
      fallbackTimerRef,
      workspaceUiState.setLatestDiff
    );
  }, [agentState, desktopRuntime, projectState, workspaceUiState.setLatestDiff]);

  const handleApproveExecutionGate = useCallback(async () => {
    if (agentState.status !== "awaiting_approval") {
      return;
    }

    if (desktopRuntime) {
      try {
        await approveAgentAction();
        agentState.appendTerminalOutput(stampLog("gate", "Approval received. Resuming execution."));
        agentState.setPendingDiff(null);
        agentState.setStatus("executing");
      } catch (error) {
        agentState.appendTerminalOutput(
          stampLog(
            "error",
            error instanceof Error ? error.message : "Unable to approve the current execution gate."
          )
        );
      }
      return;
    }

    agentState.appendTerminalOutput(stampLog("gate", "Approval received. Resuming execution."));
    agentState.setPendingDiff(null);
    agentState.setStatus("executing");
    runFallbackStep(
      useAgentStore.getState(),
      fallbackStepsRef,
      fallbackIndexRef,
      fallbackTimerRef,
      workspaceUiState.setLatestDiff
    );
  }, [agentState, desktopRuntime, workspaceUiState.setLatestDiff]);

  const handleEmergencyStop = useCallback(async () => {
    if (desktopRuntime) {
      try {
        await emergencyStop();
        agentState.setStatus("halted");
        agentState.setExecutionSummary("Execution stopped by the operator.");
        agentState.setPendingDiff(null);
        agentState.appendTerminalOutput(
          stampLog("halt", "Emergency stop triggered. Agent loop is paused.")
        );
      } catch (error) {
        agentState.appendTerminalOutput(
          stampLog(
            "error",
            error instanceof Error ? error.message : "Unable to stop the current execution run."
          )
        );
      }
      return;
    }

    clearFallbackTimer(fallbackTimerRef);
    agentState.setStatus("halted");
    agentState.setExecutionSummary("Execution stopped by the operator.");
    agentState.setPendingDiff(null);
    agentState.appendTerminalOutput(
      stampLog("halt", "Emergency stop triggered. Agent loop is paused.")
    );
  }, [agentState, desktopRuntime]);

  const handleOpenChat = useCallback(() => {
    navigate("/chat");
  }, [navigate]);

  const handleOpenReview = useCallback(() => {
    navigate("/review");
  }, [navigate]);

  const uiHandlers = useAppUiHandlers({
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
  });

  useSystemThemePreference(setSystemPrefersDark);
  useDocumentTheme(derivedState.resolvedTheme);
  useWorkspaceSearchShortcuts({
    closeWorkspaceSearch: uiHandlers.closeWorkspaceSearch,
    isReviewRoute,
    isSearchOpen: workspaceUiState.isSearchOpen,
    setCommandSearch: workspaceUiState.setCommandSearch,
    setIsSearchOpen: workspaceUiState.setIsSearchOpen
  });
  useWorkspaceSearchRouteReset({
    closeWorkspaceSearch: uiHandlers.closeWorkspaceSearch,
    isReviewRoute,
    isSearchOpen: workspaceUiState.isSearchOpen
  });
  useWorkspaceSearchFocus({
    isReviewRoute,
    isSearchOpen: workspaceUiState.isSearchOpen,
    searchInputRef
  });
  useInitialDiagnostics({
    environment: settingsState.environment,
    hasScannedEnvironmentRef,
    refreshDiagnostics
  });
  useProjectRestore({
    applyProjectContext,
    desktopRuntime,
    hasAttemptedProjectRestore: workspaceUiState.hasAttemptedProjectRestore,
    lastProjectPath: settingsState.lastProjectPath,
    setHasAttemptedProjectRestore: workspaceUiState.setHasAttemptedProjectRestore,
    setIsProjectLoading: workspaceUiState.setIsProjectLoading,
    setLastProjectPath: settingsState.setLastProjectPath
  });
  useEffect(() => {
    if (!desktopRuntime || !activeSessionId || activeChatSession) {
      return;
    }

    let isDisposed = false;

    void loadChatSession(activeSessionId)
      .then((session) => {
        if (isDisposed) {
          return;
        }

        upsertSession(session);
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }

        workspaceUiState.setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to load the selected chat topic."
        );
      });

    return () => {
      isDisposed = true;
    };
  }, [activeChatSession, activeSessionId, desktopRuntime, upsertSession, workspaceUiState]);

  useEffect(() => {
    if (
      !desktopRuntime ||
      !workspaceUiState.hasSavedProjectSettings ||
      !isChatRoute ||
      chatSessions.length > 0
    ) {
      return;
    }

    let isDisposed = false;

    void createChatSession()
      .then((session) => {
        if (isDisposed) {
          return;
        }

        upsertSession(session);
        setActiveSessionId(session.id);
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }

        workspaceUiState.setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to create the first chat topic."
        );
      });

    return () => {
      isDisposed = true;
    };
  }, [
    chatSessions.length,
    desktopRuntime,
    isChatRoute,
    setActiveSessionId,
    upsertSession,
    workspaceUiState
  ]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isDisposed = false;

    void subscribeToChatSessionEvents((payload) => {
      const nextSession = payload.session;

      if (nextSession) {
        upsertSession(nextSession);
      } else if (payload.summary) {
        const currentSessions = useChatStore.getState().sessions;
        setChatSessions([
          ...currentSessions.filter((entry) => entry.id !== payload.summary!.id),
          payload.summary
        ]);
      }
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      isDisposed = true;
      unlisten?.();
    };
  }, [setChatSessions, upsertSession]);

  useEffect(() => {
    if (activeChatSession) {
      agentState.syncFromChatRuntime(activeChatSession.runtime);
      return;
    }

    const nextAgentState = useAgentStore.getState();
    const isAlreadyReset =
      nextAgentState.status === "idle" &&
      nextAgentState.terminalOutput.length === 0 &&
      nextAgentState.currentMilestone === null &&
      nextAgentState.pendingDiff === null &&
      nextAgentState.executionSummary === null;

    if (!isAlreadyReset) {
      agentState.resetRun();
    }
  }, [activeChatSession, agentState.resetRun, agentState.syncFromChatRuntime]);

  useAgentEventSubscription({
    appendTerminalOutput: agentState.appendTerminalOutput,
    applyAgentEvent: agentState.applyEvent,
    fallbackTimerRef,
    projectSaveTimerRef,
    setLatestDiff: workspaceUiState.setLatestDiff
  });

  const {
    configurationScreenProps,
    reviewScreenProps,
    settingsScreenProps
  } = useAppScreenProps({
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
  });

  const loadingState = (
    <section className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--text-subtle)]">
      Loading project configuration...
    </section>
  );

  const reviewScreen = workspaceUiState.hasSavedProjectSettings ? (
    <PrdScreen {...reviewScreenProps} />
  ) : workspaceUiState.hasAttemptedProjectRestore ? (
    <Navigate replace to="/" />
  ) : (
    loadingState
  );

  const chatScreen = workspaceUiState.hasSavedProjectSettings ? (
    <ChatScreen
      activeDraft={activeChatDraft}
      activeSession={activeChatSession}
      cavemanChecking={cavemanChecking}
      cavemanMessage={cavemanMessage}
      cavemanReady={cavemanReady}
      configuredModelProviders={derivedState.configuredModelProviders}
      cursorModels={workspaceUiState.cursorModels}
      onApprove={handleApproveChatSession}
      onAttachFile={handleAttachChatFile}
      onCreateSession={handleCreateChatSessionClick}
      onDeleteSession={handleDeleteChatSession}
      onDraftChange={handleChatDraftChange}
      onOpenReview={handleOpenReview}
      onRefresh={uiHandlers.handleRefresh}
      onRemoveContextItem={handleRemoveChatContextItem}
      onRenameSession={handleRenameChatSession}
      onSaveSessionConfig={handleSaveChatSessionConfig}
      onSelectSession={handleSelectChatSession}
      onSend={handleSendChatMessage}
      onStop={handleStopChatSession}
      sessions={chatSessions}
      workspaceEntries={settingsState.workspaceEntries}
      workspaceRootName={workspaceUiState.projectRootName}
    />
  ) : workspaceUiState.hasAttemptedProjectRestore ? (
    <Navigate replace to="/" />
  ) : (
    loadingState
  );

  const settingsScreen = workspaceUiState.hasSavedProjectSettings ? (
    <SettingsScreen {...settingsScreenProps} />
  ) : workspaceUiState.hasAttemptedProjectRestore ? (
    <Navigate replace to="/" />
  ) : (
    loadingState
  );

  return (
    <main className="flex h-screen min-h-0 w-full flex-col overflow-hidden">
      <AppRail hasProjectConfigured={workspaceUiState.hasSavedProjectSettings} />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:ml-60">
        <input
          accept={desktopRuntime ? ".md,.pdf" : ".md"}
          className="hidden"
          onChange={handleFileSelection}
          ref={fileInputRef}
          type="file"
        />

        <Suspense fallback={loadingState}>
          <Routes>
            <Route
              element={<ConfigurationScreen {...configurationScreenProps} />}
              path="/"
            />
            <Route element={chatScreen} path="/chat" />
            <Route element={reviewScreen} path="/review" />
            <Route element={settingsScreen} path="/settings" />
            <Route
              element={
                <Navigate
                  replace
                  to={workspaceUiState.hasSavedProjectSettings ? "/review" : "/"}
                />
              }
              path="*"
            />
          </Routes>
        </Suspense>
      </div>
    </main>
  );
}

export default App;
