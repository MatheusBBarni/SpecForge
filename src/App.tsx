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
  useSettingsStoreSlice
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
  isOpenableWorkspacePath,
  runFallbackStep,
  stampLog,
  type WorkspaceFileSource
} from "./lib/appShell";
import {
  approveAgentAction,
  createChatSession,
  DEFAULT_PENDING_DIFF,
  emergencyStop,
  getGitDiff,
  getWorkspaceSnapshot,
  isTauriRuntime,
  loadChatSession,
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
  EnvironmentStatus
} from "./types";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isChatRoute = location.pathname === "/chat";
  const isReviewRoute = location.pathname === "/review";
  const desktopRuntime = isTauriRuntime();

  const agentState = useAgentStoreSlice();
  const projectState = useProjectStoreSlice();
  const settingsState = useSettingsStoreSlice();
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

  const [commandSearch, setCommandSearch] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [isProjectSaving, setIsProjectSaving] = useState(false);
  const [latestDiff, setLatestDiff] = useState(DEFAULT_PENDING_DIFF);
  const [projectConfigPath, setProjectConfigPath] = useState("");
  const [projectErrorMessage, setProjectErrorMessage] = useState("");
  const [projectRootName, setProjectRootName] = useState("No project selected");
  const [projectRootPath, setProjectRootPath] = useState("");
  const [projectStatusMessage, setProjectStatusMessage] = useState("");
  const [workspaceNotice, setWorkspaceNotice] = useState(
    "Finish the setup flow to load a project workspace."
  );
  const [hasSavedProjectSettings, setHasSavedProjectSettings] = useState(false);
  const [hasSelectedProject, setHasSelectedProject] = useState(false);
  const [hasAttemptedProjectRestore, setHasAttemptedProjectRestore] = useState(!desktopRuntime);
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, WorkspaceFileSource>>({});
  const [prdGenerationPrompt, setPrdGenerationPrompt] = useState("");
  const [prdGenerationError, setPrdGenerationError] = useState("");
  const [specGenerationPrompt, setSpecGenerationPrompt] = useState("");
  const [specGenerationError, setSpecGenerationError] = useState("");

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImportTargetRef = useRef<DocumentTarget>("prd");
  const fallbackTimerRef = useRef<number | null>(null);
  const fallbackStepsRef = useRef<FallbackStep[]>([]);
  const fallbackIndexRef = useRef(0);
  const hasScannedEnvironmentRef = useRef(false);
  const latestPathnameRef = useRef(location.pathname);

  useEffect(() => {
    latestPathnameRef.current = location.pathname;
  }, [location.pathname]);

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
    : agentState.pendingDiff ?? latestDiff;

  const derivedState = useAppDerivedState({
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
  });

  const refreshDiagnostics = useCallback(
    async (previousEnvironment?: EnvironmentStatus) => {
      const [nextEnvironment, snapshotEntries, diff] = await Promise.all([
        runEnvironmentScan().catch(() => previousEnvironment ?? settingsState.environment),
        hasSelectedProject
          ? Promise.resolve(settingsState.workspaceEntries)
          : getWorkspaceSnapshot().catch(() => settingsState.workspaceEntries),
        getGitDiff().catch(() => DEFAULT_PENDING_DIFF)
      ]);

      settingsState.setEnvironment(nextEnvironment);

      if (!hasSelectedProject) {
        settingsState.setWorkspaceEntries(snapshotEntries);
      }

      setLatestDiff(diff);
    },
    [hasSelectedProject, settingsState]
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
    prdGenerationPrompt,
    projectRootPath,
    projectState,
    setIsImporting,
    setPrdGenerationError,
    setPrdGenerationPrompt,
    setSpecGenerationError,
    setSpecGenerationPrompt,
    settingsState,
    specGenerationPrompt
  });

  // --- Project handlers ---
  const {
    applyProjectContext,
    saveCurrentProjectSettings,
    scheduleProjectSettingsSave,
    handlePickProjectFolder,
    projectSaveTimerRef
  } = useProjectHandlers({
    applyProjectContextDeps: {
      projectRootPath,
      projectState,
      settingsState,
      setProjectRootName,
      setProjectRootPath,
      setProjectConfigPath,
      setHasSelectedProject,
      setHasSavedProjectSettings,
      setWorkspaceFiles,
      setPrdGenerationPrompt,
      setPrdGenerationError,
      setSpecGenerationPrompt,
      setSpecGenerationError,
      setChatSessions,
      setActiveSessionId,
      setCavemanStatus,
      setProjectStatusMessage,
      setProjectErrorMessage,
      setWorkspaceNotice,
      latestPathnameRef
    },
    derivedState,
    desktopRuntime,
    hasSavedProjectSettings,
    projectRootName,
    projectRootPath,
    projectState,
    setIsProjectLoading,
    setIsProjectSaving,
    setProjectErrorMessage,
    setProjectStatusMessage
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
    setProjectErrorMessage
  });

  const handleWorkspaceFileOpen = useCallback(
    async (path: string) => {
      const file = workspaceFiles[path];

      if (!file) {
        setWorkspaceNotice(`The file ${path} is not available in the active workspace snapshot.`);
        return;
      }

      if (file.kind === "browser") {
        if (!isOpenableTextFile(file.file)) {
          setWorkspaceNotice(`${file.file.name} is not an openable text/code file.`);
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

      if (!isOpenableWorkspacePath(path)) {
        setWorkspaceNotice(`${file.fileName} is not an openable text/code file.`);
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
        setWorkspaceNotice(
          error instanceof Error
            ? `Unable to open ${file.fileName}: ${error.message}`
            : `Unable to open ${file.fileName}.`
        );
      }
    },
    [projectState, workspaceFiles]
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
      setLatestDiff
    );
  }, [agentState, desktopRuntime, projectState]);

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
      setLatestDiff
    );
  }, [agentState, desktopRuntime]);

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
  });

  useSystemThemePreference(setSystemPrefersDark);
  useDocumentTheme(derivedState.resolvedTheme);
  useWorkspaceSearchShortcuts({
    closeWorkspaceSearch: uiHandlers.closeWorkspaceSearch,
    isReviewRoute,
    isSearchOpen,
    setCommandSearch,
    setIsSearchOpen
  });
  useWorkspaceSearchRouteReset({
    closeWorkspaceSearch: uiHandlers.closeWorkspaceSearch,
    isReviewRoute,
    isSearchOpen
  });
  useWorkspaceSearchFocus({
    isReviewRoute,
    isSearchOpen,
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
    hasAttemptedProjectRestore,
    lastProjectPath: settingsState.lastProjectPath,
    setHasAttemptedProjectRestore,
    setIsProjectLoading,
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

        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to load the selected chat topic."
        );
      });

    return () => {
      isDisposed = true;
    };
  }, [activeChatSession, activeSessionId, desktopRuntime, upsertSession]);

  useEffect(() => {
    if (
      !desktopRuntime ||
      !hasSavedProjectSettings ||
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

        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to create the first chat topic."
        );
      });

    return () => {
      isDisposed = true;
    };
  }, [
    chatSessions.length,
    desktopRuntime,
    hasSavedProjectSettings,
    isChatRoute,
    setActiveSessionId,
    upsertSession
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
    setLatestDiff
  });

  const {
    configurationScreenProps,
    reviewScreenProps,
    settingsScreenProps
  } = useAppScreenProps({
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
  });

  const loadingState = (
    <section className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--text-subtle)]">
      Loading project configuration...
    </section>
  );

  const reviewScreen = hasSavedProjectSettings ? (
    <PrdScreen {...reviewScreenProps} />
  ) : hasAttemptedProjectRestore ? (
    <Navigate replace to="/" />
  ) : (
    loadingState
  );

  const chatScreen = hasSavedProjectSettings ? (
    <ChatScreen
      activeDraft={activeChatDraft}
      activeSession={activeChatSession}
      cavemanChecking={cavemanChecking}
      cavemanMessage={cavemanMessage}
      cavemanReady={cavemanReady}
      configuredModelProviders={derivedState.configuredModelProviders}
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
      workspaceRootName={projectRootName}
    />
  ) : hasAttemptedProjectRestore ? (
    <Navigate replace to="/" />
  ) : (
    loadingState
  );

  const settingsScreen = hasSavedProjectSettings ? (
    <SettingsScreen {...settingsScreenProps} />
  ) : hasAttemptedProjectRestore ? (
    <Navigate replace to="/" />
  ) : (
    loadingState
  );

  return (
    <main className="flex h-screen min-h-0 w-full flex-col overflow-hidden">
      <AppRail hasProjectConfigured={hasSavedProjectSettings} />

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
              element={<Navigate replace to={hasSavedProjectSettings ? "/review" : "/"} />}
              path="*"
            />
          </Routes>
        </Suspense>
      </div>
    </main>
  );
}

export default App;
