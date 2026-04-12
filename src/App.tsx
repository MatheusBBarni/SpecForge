import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
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
  buildFallbackSteps,
  clearFallbackTimer,
  isOpenableWorkspacePath,
  runFallbackStep,
  stampLog,
  type DocumentTarget,
  type FallbackStep,
  type WorkspaceFileSource
} from "./lib/appShell";
import {
  getModelLabel,
  getReasoningLabel
} from "./lib/agentConfig";
import {
  buildCurrentProjectSettings,
  buildConfigPathDisplay,
  buildWorkspaceNotice,
  waitForNextPaint
} from "./lib/appState";
import {
  DEFAULT_PENDING_DIFF,
  approveChatSession,
  approveAgentAction,
  createChatSession,
  deleteChatSession,
  emergencyStop,
  generatePrdDocument,
  generateSpecDocument,
  getGitDiff,
  getWorkspaceSnapshot,
  isTauriRuntime,
  loadChatSession,
  loadProjectContext,
  pickDocument,
  pickProjectFolder,
  readWorkspaceFile,
  renameChatSession,
  runEnvironmentScan,
  saveProjectSettings,
  saveChatSession,
  sendChatMessage,
  startAgentRun,
  stopChatSession,
  subscribeToChatSessionEvents
} from "./lib/runtime";
import {
  isOpenableTextFile,
  parseWorkspaceDocument,
  parseWorkspaceTextFile,
  type ImportableFile
} from "./lib/workspaceImport";
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
import { ConfigurationScreen } from "./screens/ConfigurationScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { PrdScreen } from "./screens/PrdScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { useAgentStore } from "./store/useAgentStore";
import { useChatStore } from "./store/useChatStore";
import { useProjectStore } from "./store/useProjectStore";
import type {
  ChatContextItem,
  ChatSession,
  EnvironmentStatus,
  ProjectContext
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
  const projectSaveTimerRef = useRef<number | null>(null);
  const pendingProjectReloadRef = useRef(false);
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
        runEnvironmentScan({
          claudePath: settingsState.claudePath,
          codexPath: settingsState.codexPath
        }).catch(() => previousEnvironment ?? settingsState.environment),
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

  const assignDocument = useCallback(
    (target: DocumentTarget, content: string, path: string) => {
      startTransition(() => {
        if (target === "prd") {
          projectState.setPrdContent(content, path);
          projectState.setPrdPaneMode("preview");
          return;
        }

        projectState.setSpecContent(content, path);
        projectState.setSpecPaneMode("preview");
      });

      if (target === "prd") {
        setPrdGenerationPrompt("");
        setPrdGenerationError("");
        return;
      }

      setSpecGenerationPrompt("");
      setSpecGenerationError("");
    },
    [projectState]
  );

  const applyProjectContext = useCallback(
    (context: ProjectContext, options?: { navigateToChat?: boolean }) => {
      const normalizedCurrentProjectPath = projectRootPath
        .replace(/\\/g, "/")
        .replace(/\/+$/, "")
        .toLowerCase();
      const normalizedNextProjectPath = context.rootPath
        .replace(/\\/g, "/")
        .replace(/\/+$/, "")
        .toLowerCase();
      const isSameProject =
        normalizedCurrentProjectPath.length > 0 &&
        normalizedCurrentProjectPath === normalizedNextProjectPath;
      const nextPrdSourcePath =
        context.prdDocument?.sourcePath ?? context.settings.prdPath;
      const nextSpecSourcePath =
        context.specDocument?.sourcePath ?? context.settings.specPath;
      const preserveEditingPrd =
        isSameProject &&
        projectState.prdPaneMode === "edit" &&
        projectState.prdPath === nextPrdSourcePath;
      const preserveEditingSpec =
        isSameProject &&
        projectState.specPaneMode === "edit" &&
        projectState.specPath === nextSpecSourcePath;
      const settingsPathDisplay = buildConfigPathDisplay(
        context.settingsPath,
        context.rootName
      );
      const nextWorkspaceFiles = Object.fromEntries(
        context.entries
          .filter((entry) => entry.kind === "file")
          .map((entry) => [
            entry.path,
            {
              kind: "desktop",
              fileName: entry.name
            } satisfies WorkspaceFileSource
          ])
      );

      if (!isSameProject) {
        projectState.resetWorkspaceContext();
      }
      setProjectRootName(context.rootName);
      setProjectRootPath(context.rootPath);
      setProjectConfigPath(context.settingsPath);
      setHasSelectedProject(true);
      setHasSavedProjectSettings(context.hasSavedSettings);
      settingsState.setWorkspaceEntries(context.entries);
      setWorkspaceFiles(nextWorkspaceFiles);
      settingsState.setLastProjectPath(context.rootPath);
      projectState.setProjectSettings(context.settings);
      setPrdGenerationPrompt("");
      setPrdGenerationError("");
      setSpecGenerationPrompt("");
      setSpecGenerationError("");
      setChatSessions(context.chatSessions);
      setActiveSessionId(context.lastActiveSessionId ?? context.chatSessions[0]?.id ?? null);
      setCavemanStatus({
        ready: true,
        message: "Caveman mode is built into every topic."
      });
      setProjectStatusMessage(
        context.hasSavedSettings
          ? `Loaded project settings from ${context.rootName}/${settingsPathDisplay}.`
          : `Selected ${context.rootName}. Save the setup to create ${context.rootName}/${settingsPathDisplay}.`
      );
      setProjectErrorMessage("");
      setWorkspaceNotice(buildWorkspaceNotice(context));

      startTransition(() => {
        if (!preserveEditingPrd) {
          projectState.setPrdContent(
            context.prdDocument?.content ?? "",
            nextPrdSourcePath
          );
          projectState.setPrdPaneMode("preview");
        }

        if (!preserveEditingSpec) {
          projectState.setSpecContent(
            context.specDocument?.content ?? "",
            nextSpecSourcePath
          );
          projectState.setSpecPaneMode("preview");
        }
      });

      if (options?.navigateToChat && latestPathnameRef.current === "/") {
        navigate("/chat");
      }
    },
    [
      navigate,
      projectState,
      setActiveSessionId,
      setCavemanStatus,
      setChatSessions,
      settingsState
    ]
  );

  const saveCurrentProjectSettings = useCallback(
    async ({
      reloadProject = false,
      navigateToChat = false
    }: {
      reloadProject?: boolean;
      navigateToChat?: boolean;
    } = {}) => {
      if (!desktopRuntime) {
        setProjectErrorMessage("Project configuration requires the desktop runtime.");
        return;
      }

      if (!projectRootPath.trim()) {
        setProjectErrorMessage("Choose a project folder before saving.");
        return;
      }

      setProjectErrorMessage("");
      setProjectStatusMessage("");
      setIsProjectSaving(true);

      try {
        const latestProjectState = useProjectStore.getState();
        const currentProjectSettings = buildCurrentProjectSettings({
          configuredPrdPath: latestProjectState.configuredPrdPath,
          configuredSpecPath: latestProjectState.configuredSpecPath,
          prdPromptTemplate: latestProjectState.prdPromptTemplate,
          selectedModel: latestProjectState.selectedModel,
          selectedReasoning: latestProjectState.selectedReasoning,
          specPromptTemplate: latestProjectState.specPromptTemplate,
          supportingDocumentPaths: latestProjectState.supportingDocumentPaths
        });
        const savedSettings = await saveProjectSettings({
          folderPath: projectRootPath,
          settings: currentProjectSettings
        });

        projectState.setProjectSettings(savedSettings);
        setHasSavedProjectSettings(true);
        setProjectStatusMessage(
          projectRootName
            ? `Saved project settings to ${projectRootName}/${derivedState.configPathDisplay}.`
            : `Saved project settings to ${derivedState.configPathDisplay}.`
        );

        if (reloadProject || navigateToChat) {
          const reloadedContext = await loadProjectContext(projectRootPath);
          applyProjectContext(reloadedContext, { navigateToChat });
        }
      } catch (error) {
        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to save the current project settings."
        );
      } finally {
        setIsProjectSaving(false);
      }
    },
    [
      applyProjectContext,
      derivedState.configPathDisplay,
      desktopRuntime,
      projectRootName,
      projectRootPath,
      projectState
    ]
  );

  const scheduleProjectSettingsSave = useCallback(
    (reloadProject = false) => {
      if (!desktopRuntime || !hasSavedProjectSettings || !projectRootPath.trim()) {
        return;
      }

      pendingProjectReloadRef.current = pendingProjectReloadRef.current || reloadProject;

      if (projectSaveTimerRef.current !== null) {
        window.clearTimeout(projectSaveTimerRef.current);
      }

      projectSaveTimerRef.current = window.setTimeout(() => {
        const shouldReload = pendingProjectReloadRef.current;
        pendingProjectReloadRef.current = false;
        projectSaveTimerRef.current = null;
        void saveCurrentProjectSettings({ reloadProject: shouldReload });
      }, 700);
    },
    [desktopRuntime, hasSavedProjectSettings, projectRootPath, saveCurrentProjectSettings]
  );

  const projectSettingsHandlers = useProjectSettingsHandlers({
    saveCurrentProjectSettings,
    scheduleProjectSettingsSave,
    setConfiguredPrdPath: projectState.setConfiguredPrdPath,
    setConfiguredSpecPath: projectState.setConfiguredSpecPath,
    setPrdPromptTemplate: projectState.setPrdPromptTemplate,
    setReasoningProfile: projectState.setReasoningProfile,
    setSelectedModel: projectState.setSelectedModel,
    setSpecPromptTemplate: projectState.setSpecPromptTemplate,
    setSupportingDocumentPaths: projectState.setSupportingDocumentPaths
  });

  const handlePickProjectFolder = useCallback(async () => {
    if (!desktopRuntime) {
      setProjectErrorMessage("Project configuration requires the desktop runtime.");
      return;
    }

    setProjectErrorMessage("");
    setProjectStatusMessage("");
    setIsProjectLoading(true);

    try {
      const nextProjectContext = await pickProjectFolder();

      if (!nextProjectContext) {
        return;
      }

      applyProjectContext(nextProjectContext);
      navigate("/");
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to open the selected project folder."
      );
    } finally {
      setIsProjectLoading(false);
    }
  }, [applyProjectContext, desktopRuntime, navigate]);

  const handleFileSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] as ImportableFile | undefined;

      if (!file) {
        return;
      }

      try {
        const document = await parseWorkspaceDocument(file);
        assignDocument(pendingImportTargetRef.current, document.content, document.sourcePath);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The selected file could not be imported.";

        if (pendingImportTargetRef.current === "prd") {
          setPrdGenerationError(message);
        } else {
          setSpecGenerationError(message);
        }
      } finally {
        event.target.value = "";
      }
    },
    [assignDocument]
  );

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

  const handleOpenImportFile = useCallback(
    async (target: DocumentTarget) => {
      pendingImportTargetRef.current = target;

      if (desktopRuntime) {
        setIsImporting(true);

        try {
          const document = await pickDocument();

          if (document) {
            assignDocument(target, document.content, document.sourcePath);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "The selected file could not be imported.";

          if (target === "prd") {
            setPrdGenerationError(message);
          } else {
            setSpecGenerationError(message);
          }
        } finally {
          setIsImporting(false);
        }

        return;
      }

      fileInputRef.current?.click();
    },
    [assignDocument, desktopRuntime]
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

  const handleGeneratePrd = useCallback(async () => {
    const trimmedPrompt = prdGenerationPrompt.trim();

    if (!desktopRuntime) {
      setPrdGenerationError("AI PRD generation requires the desktop runtime.");
      return;
    }

    if (!projectRootPath.trim()) {
      setPrdGenerationError("Choose a project folder before generating a PRD.");
      return;
    }

    if (!derivedState.currentProjectSettings.prdPath.toLowerCase().endsWith(".md")) {
      setPrdGenerationError("Configure the PRD path as a Markdown file before generating.");
      return;
    }

    if (!trimmedPrompt) {
      setPrdGenerationError("Add the product context you want the AI to consider.");
      return;
    }

    setPrdGenerationError("");
    agentState.setStatus("generating_prd");
    agentState.appendTerminalOutput(
      stampLog(
        "prd",
        `Generating a PRD draft with ${getModelLabel(projectState.selectedModel)} (${getReasoningLabel(projectState.selectedModel, projectState.selectedReasoning)} reasoning).`
      )
    );

    try {
      await waitForNextPaint();

      const generatedPrd = await generatePrdDocument({
        workspaceRoot: projectRootPath,
        outputPath: derivedState.currentProjectSettings.prdPath,
        promptTemplate: derivedState.currentProjectSettings.prdPrompt,
        userPrompt: trimmedPrompt,
        provider: derivedState.selectedModelProvider,
        model: projectState.selectedModel,
        reasoning: projectState.selectedReasoning,
        claudePath: settingsState.claudePath,
        codexPath: settingsState.codexPath
      });

      startTransition(() => {
        projectState.setPrdContent(generatedPrd.content, generatedPrd.sourcePath);
        projectState.setPrdPaneMode("preview");
      });
      setPrdGenerationPrompt("");
      agentState.setStatus("idle");
      agentState.appendTerminalOutput(
        stampLog(
          "prd",
          `PRD draft generated, saved to ${generatedPrd.fileName}, and loaded into the review pane.`
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate a PRD.";
      setPrdGenerationError(message);
      agentState.setStatus("error");
      agentState.appendTerminalOutput(stampLog("error", message));
    }
  }, [
    agentState,
    derivedState.currentProjectSettings,
    derivedState.selectedModelProvider,
    desktopRuntime,
    prdGenerationPrompt,
    projectRootPath,
    projectState,
    settingsState
  ]);

  const handleGenerateSpec = useCallback(async () => {
    const trimmedPrompt = specGenerationPrompt.trim();

    if (!desktopRuntime) {
      setSpecGenerationError("AI spec generation requires the desktop runtime.");
      return;
    }

    if (!projectRootPath.trim()) {
      setSpecGenerationError("Choose a project folder before generating a spec.");
      return;
    }

    if (!projectState.prdContent.trim()) {
      setSpecGenerationError("Load or generate a PRD before drafting a specification.");
      return;
    }

    if (!derivedState.currentProjectSettings.specPath.toLowerCase().endsWith(".md")) {
      setSpecGenerationError("Configure the spec path as a Markdown file before generating.");
      return;
    }

    if (!trimmedPrompt) {
      setSpecGenerationError("Add the technical guidance you want the AI to consider.");
      return;
    }

    setSpecGenerationError("");
    agentState.setStatus("generating_spec");
    agentState.appendTerminalOutput(
      stampLog(
        "spec",
        `Generating a technical specification with ${getModelLabel(projectState.selectedModel)} (${getReasoningLabel(projectState.selectedModel, projectState.selectedReasoning)} reasoning).`
      )
    );

    try {
      await waitForNextPaint();

      const generatedSpec = await generateSpecDocument({
        workspaceRoot: projectRootPath,
        outputPath: derivedState.currentProjectSettings.specPath,
        prdContent: projectState.prdContent,
        promptTemplate: derivedState.currentProjectSettings.specPrompt,
        userPrompt: trimmedPrompt,
        provider: derivedState.selectedModelProvider,
        model: projectState.selectedModel,
        reasoning: projectState.selectedReasoning,
        claudePath: settingsState.claudePath,
        codexPath: settingsState.codexPath
      });

      startTransition(() => {
        projectState.setSpecContent(generatedSpec.content, generatedSpec.sourcePath);
        projectState.setSpecPaneMode("preview");
      });
      setSpecGenerationPrompt("");
      agentState.setStatus("idle");
      agentState.appendTerminalOutput(
        stampLog(
          "spec",
          `Specification draft generated, saved to ${generatedSpec.fileName}, and loaded into the review pane.`
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate a specification.";
      setSpecGenerationError(message);
      agentState.setStatus("error");
      agentState.appendTerminalOutput(stampLog("error", message));
    }
  }, [
    agentState,
    derivedState.currentProjectSettings,
    derivedState.selectedModelProvider,
    desktopRuntime,
    projectRootPath,
    projectState,
    settingsState,
    specGenerationPrompt
  ]);

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
    specGenerationError
  });

  const persistChatSession = useCallback(
    async (payload: {
      sessionId: string;
      selectedModel: ChatSession["selectedModel"];
      selectedReasoning: ChatSession["selectedReasoning"];
      autonomyMode: ChatSession["autonomyMode"];
      contextItems: ChatContextItem[];
    }) => {
      const nextSession = await saveChatSession(payload);
      upsertSession(nextSession);
      return nextSession;
    },
    [upsertSession]
  );

  const handleCreateChatSessionClick = useCallback(async () => {
    try {
      const nextSession = await createChatSession();
      upsertSession(nextSession);
      setActiveSessionId(nextSession.id);
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to create a new chat topic."
      );
    }
  }, [setActiveSessionId, upsertSession]);

  const handleSelectChatSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
    },
    [setActiveSessionId]
  );

  const handleRenameChatSession = useCallback(
    async (sessionId: string, title: string) => {
      try {
        await renameChatSession({ sessionId, title });
        const nextSession = await loadChatSession(sessionId);
        upsertSession(nextSession);
      } catch (error) {
        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to rename the selected chat topic."
        );
      }
    },
    [upsertSession]
  );

  const handleDeleteChatSession = useCallback(
    async (sessionId: string) => {
      const confirmed = window.confirm("Delete this topic and its saved context?");

      if (!confirmed) {
        return;
      }

      try {
        const nextIndex = await deleteChatSession(sessionId);
        deleteChatSessionState(sessionId, nextIndex.lastActiveSessionId);
        setChatSessions(nextIndex.sessions);

        if (nextIndex.lastActiveSessionId) {
          setActiveSessionId(nextIndex.lastActiveSessionId);
        }
      } catch (error) {
        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to delete the selected chat topic."
        );
      }
    },
    [deleteChatSessionState, setActiveSessionId, setChatSessions]
  );

  const handleChatDraftChange = useCallback(
    (value: string) => {
      if (!activeSessionId) {
        return;
      }

      setChatDraft(activeSessionId, value);
    },
    [activeSessionId, setChatDraft]
  );

  const handleSendChatMessage = useCallback(async () => {
    if (!activeChatSession || !activeChatDraft.trim()) {
      return;
    }

    try {
      await sendChatMessage({
        sessionId: activeChatSession.id,
        message: activeChatDraft,
        claudePath: settingsState.claudePath,
        codexPath: settingsState.codexPath
      });
      setChatDraft(activeChatSession.id, "");
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to send the current chat message."
      );
    }
  }, [activeChatDraft, activeChatSession, setChatDraft, settingsState]);

  const handleApproveChatSession = useCallback(async () => {
    if (!activeChatSession) {
      return;
    }

    try {
      await approveChatSession(activeChatSession.id);
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to approve the active chat topic."
      );
    }
  }, [activeChatSession]);

  const handleStopChatSession = useCallback(async () => {
    if (!activeChatSession) {
      return;
    }

    try {
      await stopChatSession(activeChatSession.id);
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to stop the active chat topic."
      );
    }
  }, [activeChatSession]);

  const handleSaveChatSessionConfig = useCallback(
    async (payload: {
      sessionId: string;
      selectedModel: ChatSession["selectedModel"];
      selectedReasoning: ChatSession["selectedReasoning"];
      autonomyMode: ChatSession["autonomyMode"];
      contextItems: ChatContextItem[];
    }) => {
      setSessionConfig(payload);
      setChatContextItems(payload.sessionId, payload.contextItems);

      try {
        await persistChatSession(payload);
      } catch (error) {
        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to save the current chat topic."
        );
      }
    },
    [persistChatSession, setChatContextItems, setSessionConfig]
  );

  const handleAttachChatFile = useCallback(
    (path: string) => {
      if (!activeChatSession) {
        return;
      }

      if (activeChatSession.contextItems.some((item) => item.path === path)) {
        return;
      }

      const nextContextItems = [
        ...activeChatSession.contextItems,
        {
          id: `file-${Date.now().toString(36)}`,
          kind: "file" as const,
          label: path.split("/").pop() ?? path,
          path,
          isDefault: false
        }
      ];

      void handleSaveChatSessionConfig({
        sessionId: activeChatSession.id,
        selectedModel: activeChatSession.selectedModel,
        selectedReasoning: activeChatSession.selectedReasoning,
        autonomyMode: activeChatSession.autonomyMode,
        contextItems: nextContextItems
      });
    },
    [activeChatSession, handleSaveChatSessionConfig]
  );

  const handleRemoveChatContextItem = useCallback(
    (itemId: string) => {
      if (!activeChatSession) {
        return;
      }

      const nextContextItems = activeChatSession.contextItems.filter(
        (item) => item.id !== itemId
      );

      void handleSaveChatSessionConfig({
        sessionId: activeChatSession.id,
        selectedModel: activeChatSession.selectedModel,
        selectedReasoning: activeChatSession.selectedReasoning,
        autonomyMode: activeChatSession.autonomyMode,
        contextItems: nextContextItems
      });
    },
    [activeChatSession, handleSaveChatSessionConfig]
  );

  const handleOpenChat = useCallback(() => {
    navigate("/chat");
  }, [navigate]);

  const handleOpenReview = useCallback(() => {
    navigate("/review");
  }, [navigate]);

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

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:ml-[72px]">
        <input
          accept={desktopRuntime ? ".md,.pdf" : ".md"}
          className="hidden"
          onChange={handleFileSelection}
          ref={fileInputRef}
          type="file"
        />

        <Routes>
          <Route
            element={<ConfigurationScreen {...configurationScreenProps} />}
            path="/"
          />
          <Route element={chatScreen} path="/chat" />
          <Route element={reviewScreen} path="/review" />
          <Route element={settingsScreen} path="/settings" />
          <Route
            element={<Navigate replace to={hasSavedProjectSettings ? "/chat" : "/"} />}
            path="*"
          />
        </Routes>
      </div>
    </main>
  );
}

export default App;
