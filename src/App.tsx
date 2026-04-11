import {
  startTransition,
  useCallback,
  useDeferredValue,
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

import { AppRail } from "./components/AppRail";
import {
  FallbackStep,
  WorkspaceFileSource,
  buildFallbackSteps,
  clearFallbackTimer,
  filterWorkspaceEntries,
  isOpenableWorkspacePath,
  resolveTheme,
  runFallbackStep,
  stampLog,
  type DocumentTarget
} from "./lib/appShell";
import {
  getModelLabel,
  getModelProvider,
  getReasoningLabel
} from "./lib/agentConfig";
import {
  DEFAULT_PROJECT_PRD_PATH,
  DEFAULT_PROJECT_SPEC_PATH,
  SPECFORGE_SETTINGS_RELATIVE_PATH,
  formatSupportingDocumentPaths,
  normalizeProjectRelativePath,
  normalizeProjectSettings,
  parseSupportingDocumentPaths
} from "./lib/projectConfig";
import {
  DEFAULT_PENDING_DIFF,
  approveAgentAction,
  emergencyStop,
  generatePrdDocument,
  generateSpecDocument,
  getGitDiff,
  getWorkspaceSnapshot,
  isTauriRuntime,
  loadProjectContext,
  pickDocument,
  pickProjectFolder,
  readWorkspaceFile,
  runEnvironmentScan,
  saveProjectSettings,
  startAgentRun,
  subscribeToAgentEvents
} from "./lib/runtime";
import {
  isOpenableTextFile,
  parseWorkspaceDocument,
  parseWorkspaceTextFile,
  type ImportableFile
} from "./lib/workspaceImport";
import { ConfigurationScreen } from "./screens/ConfigurationScreen";
import { PrdScreen } from "./screens/PrdScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { useAgentStore } from "./store/useAgentStore";
import { useProjectStore } from "./store/useProjectStore";
import { useSettingsStore } from "./store/useSettingsStore";
import type {
  EnvironmentStatus,
  ModelProvider,
  ProjectContext
} from "./types";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isReviewRoute = location.pathname === "/review";
  const desktopRuntime = isTauriRuntime();

  const agentStatus = useAgentStore((state) => state.status);
  const terminalOutput = useAgentStore((state) => state.terminalOutput);
  const pendingDiff = useAgentStore((state) => state.pendingDiff);
  const executionSummary = useAgentStore((state) => state.executionSummary);
  const resetRun = useAgentStore((state) => state.resetRun);
  const appendTerminalOutput = useAgentStore((state) => state.appendTerminalOutput);
  const setAgentStatus = useAgentStore((state) => state.setStatus);
  const setCurrentMilestone = useAgentStore((state) => state.setCurrentMilestone);
  const setPendingDiff = useAgentStore((state) => state.setPendingDiff);
  const setExecutionSummary = useAgentStore((state) => state.setExecutionSummary);
  const applyAgentEvent = useAgentStore((state) => state.applyEvent);

  const annotations = useProjectStore((state) => state.annotations);
  const activeTab = useProjectStore((state) => state.activeTab);
  const autonomyMode = useProjectStore((state) => state.autonomyMode);
  const configuredPrdPath = useProjectStore((state) => state.configuredPrdPath);
  const configuredSpecPath = useProjectStore((state) => state.configuredSpecPath);
  const isSpecApproved = useProjectStore((state) => state.isSpecApproved);
  const openEditorTabs = useProjectStore((state) => state.openEditorTabs);
  const prdContent = useProjectStore((state) => state.prdContent);
  const prdPaneMode = useProjectStore((state) => state.prdPaneMode);
  const prdPath = useProjectStore((state) => state.prdPath);
  const prdPromptTemplate = useProjectStore((state) => state.prdPromptTemplate);
  const selectedModel = useProjectStore((state) => state.selectedModel);
  const selectedReasoning = useProjectStore((state) => state.selectedReasoning);
  const selectedSpecRange = useProjectStore((state) => state.selectedSpecRange);
  const specContent = useProjectStore((state) => state.specContent);
  const specPaneMode = useProjectStore((state) => state.specPaneMode);
  const specPath = useProjectStore((state) => state.specPath);
  const specPromptTemplate = useProjectStore((state) => state.specPromptTemplate);
  const supportingDocumentPaths = useProjectStore((state) => state.supportingDocumentPaths);
  const approveSpec = useProjectStore((state) => state.approveSpec);
  const closeEditorTab = useProjectStore((state) => state.closeEditorTab);
  const openEditorTab = useProjectStore((state) => state.openEditorTab);
  const resetWorkspaceContext = useProjectStore((state) => state.resetWorkspaceContext);
  const setActiveTab = useProjectStore((state) => state.setActiveTab);
  const setAutonomyMode = useProjectStore((state) => state.setAutonomyMode);
  const setConfiguredPrdPath = useProjectStore((state) => state.setConfiguredPrdPath);
  const setConfiguredSpecPath = useProjectStore((state) => state.setConfiguredSpecPath);
  const setPrdContent = useProjectStore((state) => state.setPrdContent);
  const setPrdPaneMode = useProjectStore((state) => state.setPrdPaneMode);
  const setPrdPromptTemplate = useProjectStore((state) => state.setPrdPromptTemplate);
  const setProjectSettings = useProjectStore((state) => state.setProjectSettings);
  const setReasoningProfile = useProjectStore((state) => state.setReasoningProfile);
  const setSelectedModel = useProjectStore((state) => state.setSelectedModel);
  const setSelectedSpecRange = useProjectStore((state) => state.setSelectedSpecRange);
  const setSpecContent = useProjectStore((state) => state.setSpecContent);
  const setSpecPaneMode = useProjectStore((state) => state.setSpecPaneMode);
  const setSpecPromptTemplate = useProjectStore((state) => state.setSpecPromptTemplate);
  const setSupportingDocumentPaths = useProjectStore((state) => state.setSupportingDocumentPaths);
  const updateEditorTabContent = useProjectStore((state) => state.updateEditorTabContent);

  const claudePath = useSettingsStore((state) => state.claudePath);
  const codexPath = useSettingsStore((state) => state.codexPath);
  const environment = useSettingsStore((state) => state.environment);
  const lastProjectPath = useSettingsStore((state) => state.lastProjectPath);
  const theme = useSettingsStore((state) => state.theme);
  const workspaceEntries = useSettingsStore((state) => state.workspaceEntries);
  const setClaudePath = useSettingsStore((state) => state.setClaudePath);
  const setCodexPath = useSettingsStore((state) => state.setCodexPath);
  const setEnvironment = useSettingsStore((state) => state.setEnvironment);
  const setLastProjectPath = useSettingsStore((state) => state.setLastProjectPath);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setWorkspaceEntries = useSettingsStore((state) => state.setWorkspaceEntries);

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
  const deferredSearch = useDeferredValue(commandSearch);

  const filteredWorkspaceEntries = useMemo(
    () => filterWorkspaceEntries(workspaceEntries, deferredSearch),
    [deferredSearch, workspaceEntries]
  );
  const selectedModelProvider = useMemo(
    () => getModelProvider(selectedModel),
    [selectedModel]
  );
  const isGeneratingPrd = agentStatus === "generating_prd";
  const isGeneratingSpec = agentStatus === "generating_spec";
  const visibleDiff = pendingDiff ?? latestDiff;
  const resolvedTheme = useMemo(
    () => resolveTheme(theme, systemPrefersDark),
    [theme, systemPrefersDark]
  );
  const configuredModelProviders = useMemo<ModelProvider[]>(() => {
    const providers: ModelProvider[] = [];

    if (environment.claude.status === "found") {
      providers.push("claude");
    }

    if (environment.codex.status === "found") {
      providers.push("codex");
    }

    return providers;
  }, [environment.claude.status, environment.codex.status]);
  const mcpItems = useMemo(
    () => [
      { name: environment.codex.name, detail: environment.codex.detail, status: environment.codex.status },
      { name: environment.claude.name, detail: environment.claude.detail, status: environment.claude.status },
      { name: environment.git.name, detail: environment.git.detail, status: environment.git.status }
    ],
    [environment]
  );
  const selectedProviderStatus =
    selectedModelProvider === "claude" ? environment.claude : environment.codex;
  const currentProjectSettings = useMemo(
    () =>
      normalizeProjectSettings({
        selectedModel,
        selectedReasoning,
        prdPrompt: prdPromptTemplate,
        specPrompt: specPromptTemplate,
        prdPath: configuredPrdPath || DEFAULT_PROJECT_PRD_PATH,
        specPath: configuredSpecPath || DEFAULT_PROJECT_SPEC_PATH,
        supportingDocumentPaths
      }),
    [
      configuredPrdPath,
      configuredSpecPath,
      prdPromptTemplate,
      selectedModel,
      selectedReasoning,
      specPromptTemplate,
      supportingDocumentPaths
    ]
  );
  const configPathDisplay = useMemo(() => {
    if (projectConfigPath.trim()) {
      return projectConfigPath;
    }

    if (projectRootPath.trim()) {
      return `${projectRootPath.replace(/\\/g, "/")}/${SPECFORGE_SETTINGS_RELATIVE_PATH}`;
    }

    return SPECFORGE_SETTINGS_RELATIVE_PATH;
  }, [projectConfigPath, projectRootPath]);
  const supportingDocumentsValue = useMemo(
    () => formatSupportingDocumentPaths(supportingDocumentPaths),
    [supportingDocumentPaths]
  );

  const canGeneratePrd = useMemo(
    () =>
      desktopRuntime &&
      !isGeneratingPrd &&
      projectRootPath.trim().length > 0 &&
      configuredPrdPath.trim().length > 0 &&
      prdGenerationPrompt.trim().length > 0,
    [
      configuredPrdPath,
      desktopRuntime,
      isGeneratingPrd,
      prdGenerationPrompt,
      projectRootPath
    ]
  );
  const canGenerateSpec = useMemo(
    () =>
      desktopRuntime &&
      !isGeneratingSpec &&
      projectRootPath.trim().length > 0 &&
      prdContent.trim().length > 0 &&
      configuredSpecPath.trim().length > 0 &&
      specGenerationPrompt.trim().length > 0,
    [
      configuredSpecPath,
      desktopRuntime,
      isGeneratingSpec,
      prdContent,
      projectRootPath,
      specGenerationPrompt
    ]
  );
  const prdGenerationHelperText = useMemo(() => {
    if (!desktopRuntime) {
      return "AI PRD generation requires the desktop runtime.";
    }

    if (!projectRootPath.trim()) {
      return "Choose a project folder in setup before generating a PRD.";
    }

    if (!configuredPrdPath.trim()) {
      return "Configure a PRD path in setup or settings first.";
    }

    if (!configuredPrdPath.toLowerCase().endsWith(".md")) {
      return "Configure the PRD path as a Markdown file if you want generated output saved into the workspace.";
    }

    if (!prdGenerationPrompt.trim()) {
      return "Add the product context you want to append after the saved PRD prompt.";
    }

    if (selectedProviderStatus.status !== "found") {
      return `${selectedProviderStatus.name} is not currently marked ready. Update its path in Settings and refresh if generation fails.`;
    }

    return `This appends your note after the saved PRD prompt from ${configPathDisplay}, runs ${getModelLabel(selectedModel)}, and writes markdown to ${configuredPrdPath}.`;
  }, [
    configPathDisplay,
    configuredPrdPath,
    desktopRuntime,
    prdGenerationPrompt,
    projectRootPath,
    selectedModel,
    selectedProviderStatus.name,
    selectedProviderStatus.status
  ]);
  const specGenerationHelperText = useMemo(() => {
    if (!desktopRuntime) {
      return "AI spec generation requires the desktop runtime.";
    }

    if (!projectRootPath.trim()) {
      return "Choose a project folder in setup before generating a spec.";
    }

    if (!prdContent.trim()) {
      return "Load or generate a PRD first. The spec generator appends your note after the saved spec prompt and includes the current PRD content.";
    }

    if (!configuredSpecPath.trim()) {
      return "Configure a spec path in setup or settings first.";
    }

    if (!configuredSpecPath.toLowerCase().endsWith(".md")) {
      return "Configure the spec path as a Markdown file if you want generated output saved into the workspace.";
    }

    if (!specGenerationPrompt.trim()) {
      return "Add the technical guidance you want to append after the saved spec prompt.";
    }

    if (selectedProviderStatus.status !== "found") {
      return `${selectedProviderStatus.name} is not currently marked ready. Update its path in Settings and refresh if generation fails.`;
    }

    return `This appends your note after the saved spec prompt from ${configPathDisplay}, includes the current PRD content, and writes markdown to ${configuredSpecPath}.`;
  }, [
    configPathDisplay,
    configuredSpecPath,
    desktopRuntime,
    prdContent,
    projectRootPath,
    selectedProviderStatus.name,
    selectedProviderStatus.status,
    specGenerationPrompt
  ]);

  const refreshDiagnostics = useCallback(
    async (previousEnvironment?: EnvironmentStatus) => {
      const [nextEnvironment, snapshotEntries, diff] = await Promise.all([
        runEnvironmentScan({
          claudePath,
          codexPath
        }).catch(() => previousEnvironment ?? environment),
        hasSelectedProject
          ? Promise.resolve(workspaceEntries)
          : getWorkspaceSnapshot().catch(() => workspaceEntries),
        getGitDiff().catch(() => DEFAULT_PENDING_DIFF)
      ]);

      setEnvironment(nextEnvironment);

      if (!hasSelectedProject) {
        setWorkspaceEntries(snapshotEntries);
      }

      setLatestDiff(diff);
    },
    [
      claudePath,
      codexPath,
      environment,
      hasSelectedProject,
      setEnvironment,
      setWorkspaceEntries,
      workspaceEntries
    ]
  );

  const assignDocument = useCallback(
    (target: DocumentTarget, content: string, path: string) => {
      startTransition(() => {
        if (target === "prd") {
          setPrdContent(content, path);
          setPrdPaneMode("preview");
          return;
        }

        setSpecContent(content, path);
        setSpecPaneMode("preview");
      });

      if (target === "prd") {
        setPrdGenerationPrompt("");
        setPrdGenerationError("");
        return;
      }

      setSpecGenerationPrompt("");
      setSpecGenerationError("");
    },
    [setPrdContent, setPrdPaneMode, setSpecContent, setSpecPaneMode]
  );

  const applyProjectContext = useCallback(
    (context: ProjectContext, options?: { navigateToReview?: boolean }) => {
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

      resetWorkspaceContext();
      setProjectRootName(context.rootName);
      setProjectRootPath(context.rootPath);
      setProjectConfigPath(context.settingsPath);
      setHasSelectedProject(true);
      setHasSavedProjectSettings(context.hasSavedSettings);
      setWorkspaceEntries(context.entries);
      setWorkspaceFiles(nextWorkspaceFiles);
      setLastProjectPath(context.rootPath);
      setProjectSettings(context.settings);
      setPrdGenerationPrompt("");
      setPrdGenerationError("");
      setSpecGenerationPrompt("");
      setSpecGenerationError("");
      setProjectStatusMessage(
        context.hasSavedSettings
          ? `Loaded project settings from ${context.settingsPath}.`
          : `Selected ${context.rootName}. Save the setup to create ${context.settingsPath}.`
      );
      setProjectErrorMessage("");
      setWorkspaceNotice(buildWorkspaceNotice(context));

      startTransition(() => {
        setPrdContent(context.prdDocument?.content ?? "", context.prdDocument?.sourcePath ?? context.settings.prdPath);
        setSpecContent(context.specDocument?.content ?? "", context.specDocument?.sourcePath ?? context.settings.specPath);
        setPrdPaneMode("preview");
        setSpecPaneMode("preview");
      });

      if (options?.navigateToReview) {
        navigate("/review");
      }
    },
    [
      navigate,
      resetWorkspaceContext,
      setLastProjectPath,
      setPrdContent,
      setPrdPaneMode,
      setProjectSettings,
      setSpecContent,
      setSpecPaneMode,
      setWorkspaceEntries
    ]
  );

  const saveCurrentProjectSettings = useCallback(
    async ({
      reloadProject = false,
      navigateToReview = false
    }: {
      reloadProject?: boolean;
      navigateToReview?: boolean;
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
        const savedSettings = await saveProjectSettings({
          folderPath: projectRootPath,
          settings: currentProjectSettings
        });

        setProjectSettings(savedSettings);
        setHasSavedProjectSettings(true);
        setProjectStatusMessage(`Saved project settings to ${configPathDisplay}.`);

        if (reloadProject || navigateToReview) {
          const reloadedContext = await loadProjectContext(projectRootPath);
          applyProjectContext(reloadedContext, { navigateToReview });
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
      configPathDisplay,
      currentProjectSettings,
      desktopRuntime,
      projectRootPath,
      setProjectSettings
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

      applyProjectContext(nextProjectContext, {
        navigateToReview: nextProjectContext.hasSavedSettings
      });

      if (!nextProjectContext.hasSavedSettings) {
        navigate("/");
      }
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

  const handleWorkspaceFolderSelection = useCallback(
    (_event: ChangeEvent<HTMLInputElement>) => undefined,
    []
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
        openEditorTab({
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
        openEditorTab({
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
    [openEditorTab, workspaceFiles]
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
    if (!specContent.trim()) {
      return;
    }

    approveSpec();
    appendTerminalOutput(stampLog("review", "Specification approved. Build controls are now armed."));
  }, [appendTerminalOutput, approveSpec, specContent]);

  const handleStartBuild = useCallback(async () => {
    if (!isSpecApproved) {
      return;
    }

    const modelLabel = getModelLabel(selectedModel);
    const reasoningLabel = getReasoningLabel(selectedModel, selectedReasoning);

    clearFallbackTimer(fallbackTimerRef);
    resetRun();
    setActiveTab("execute");
    setAgentStatus("executing");
    setCurrentMilestone("Pre-flight Check");
    appendTerminalOutput(
      stampLog("build", `Starting spec-driven build run with ${modelLabel} (${reasoningLabel} reasoning).`)
    );

    if (desktopRuntime) {
      try {
        await startAgentRun(specContent, autonomyMode, selectedModel, selectedReasoning);
        return;
      } catch (error) {
        appendTerminalOutput(
          stampLog(
            "error",
            `${error instanceof Error ? error.message : "Agent startup failed."} Falling back to the local simulator.`
          )
        );
      }
    }

    fallbackStepsRef.current = buildFallbackSteps(autonomyMode, modelLabel, reasoningLabel);
    fallbackIndexRef.current = 0;
    runFallbackStep(useAgentStore.getState(), fallbackStepsRef, fallbackIndexRef, fallbackTimerRef, setLatestDiff);
  }, [
    appendTerminalOutput,
    autonomyMode,
    desktopRuntime,
    isSpecApproved,
    resetRun,
    selectedModel,
    selectedReasoning,
    setActiveTab,
    setAgentStatus,
    setCurrentMilestone,
    specContent
  ]);

  const handleApproveExecutionGate = useCallback(async () => {
    if (agentStatus !== "awaiting_approval") {
      return;
    }

    if (desktopRuntime) {
      try {
        await approveAgentAction();
        appendTerminalOutput(stampLog("gate", "Approval received. Resuming execution."));
        setPendingDiff(null);
        setAgentStatus("executing");
      } catch (error) {
        appendTerminalOutput(
          stampLog(
            "error",
            error instanceof Error ? error.message : "Unable to approve the current execution gate."
          )
        );
      }
      return;
    }

    appendTerminalOutput(stampLog("gate", "Approval received. Resuming execution."));
    setPendingDiff(null);
    setAgentStatus("executing");
    runFallbackStep(useAgentStore.getState(), fallbackStepsRef, fallbackIndexRef, fallbackTimerRef, setLatestDiff);
  }, [agentStatus, appendTerminalOutput, desktopRuntime, setAgentStatus, setPendingDiff]);

  const handleEmergencyStop = useCallback(async () => {
    if (desktopRuntime) {
      try {
        await emergencyStop();
        setAgentStatus("halted");
        setExecutionSummary("Execution stopped by the operator.");
        setPendingDiff(null);
        appendTerminalOutput(stampLog("halt", "Emergency stop triggered. Agent loop is paused."));
      } catch (error) {
        appendTerminalOutput(
          stampLog(
            "error",
            error instanceof Error ? error.message : "Unable to stop the current execution run."
          )
        );
      }
      return;
    }

    clearFallbackTimer(fallbackTimerRef);
    setAgentStatus("halted");
    setExecutionSummary("Execution stopped by the operator.");
    setPendingDiff(null);
    appendTerminalOutput(stampLog("halt", "Emergency stop triggered. Agent loop is paused."));
  }, [appendTerminalOutput, desktopRuntime, setAgentStatus, setExecutionSummary, setPendingDiff]);

  const handlePrdContentChange = useCallback(
    (value: string) => setPrdContent(value, prdPath),
    [prdPath, setPrdContent]
  );

  const handleSpecContentChange = useCallback(
    (value: string) => {
      if (value.trim()) {
        setSpecGenerationError("");
      }

      setSpecContent(value, specPath);
    },
    [setSpecContent, specPath]
  );

  const handleSpecSelect = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const { selectionStart, selectionEnd, value } = event.target;
      setSelectedSpecRange(
        selectionStart === selectionEnd
          ? null
          : {
              start: selectionStart,
              end: selectionEnd,
              text: value.slice(selectionStart, selectionEnd)
            }
      );
    },
    [setSelectedSpecRange]
  );

  const handlePrdGenerationPromptChange = useCallback((value: string) => {
    setPrdGenerationPrompt(value);

    if (prdGenerationError) {
      setPrdGenerationError("");
    }

    if (agentStatus === "error") {
      setAgentStatus("idle");
    }
  }, [agentStatus, prdGenerationError, setAgentStatus]);

  const handleSpecGenerationPromptChange = useCallback((value: string) => {
    setSpecGenerationPrompt(value);

    if (specGenerationError) {
      setSpecGenerationError("");
    }

    if (agentStatus === "error") {
      setAgentStatus("idle");
    }
  }, [agentStatus, setAgentStatus, specGenerationError]);

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

    if (!currentProjectSettings.prdPath.toLowerCase().endsWith(".md")) {
      setPrdGenerationError("Configure the PRD path as a Markdown file before generating.");
      return;
    }

    if (!trimmedPrompt) {
      setPrdGenerationError("Add the product context you want the AI to consider.");
      return;
    }

    setPrdGenerationError("");
    setAgentStatus("generating_prd");
    appendTerminalOutput(
      stampLog(
        "prd",
        `Generating a PRD draft with ${getModelLabel(selectedModel)} (${getReasoningLabel(selectedModel, selectedReasoning)} reasoning).`
      )
    );

    try {
      const generatedPrd = await generatePrdDocument({
        workspaceRoot: projectRootPath,
        outputPath: currentProjectSettings.prdPath,
        promptTemplate: currentProjectSettings.prdPrompt,
        userPrompt: trimmedPrompt,
        provider: selectedModelProvider,
        model: selectedModel,
        reasoning: selectedReasoning,
        claudePath,
        codexPath
      });

      startTransition(() => {
        setPrdContent(generatedPrd.content, generatedPrd.sourcePath);
        setPrdPaneMode("preview");
      });
      setPrdGenerationPrompt("");
      setAgentStatus("idle");
      appendTerminalOutput(
        stampLog(
          "prd",
          `PRD draft generated, saved to ${generatedPrd.fileName}, and loaded into the review pane.`
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate a PRD.";
      setPrdGenerationError(message);
      setAgentStatus("error");
      appendTerminalOutput(stampLog("error", message));
    }
  }, [
    appendTerminalOutput,
    claudePath,
    codexPath,
    currentProjectSettings.prdPath,
    currentProjectSettings.prdPrompt,
    desktopRuntime,
    prdGenerationPrompt,
    projectRootPath,
    selectedModel,
    selectedModelProvider,
    selectedReasoning,
    setAgentStatus,
    setPrdContent,
    setPrdPaneMode
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

    if (!prdContent.trim()) {
      setSpecGenerationError("Load or generate a PRD before drafting a specification.");
      return;
    }

    if (!currentProjectSettings.specPath.toLowerCase().endsWith(".md")) {
      setSpecGenerationError("Configure the spec path as a Markdown file before generating.");
      return;
    }

    if (!trimmedPrompt) {
      setSpecGenerationError("Add the technical guidance you want the AI to consider.");
      return;
    }

    setSpecGenerationError("");
    setAgentStatus("generating_spec");
    appendTerminalOutput(
      stampLog(
        "spec",
        `Generating a technical specification with ${getModelLabel(selectedModel)} (${getReasoningLabel(selectedModel, selectedReasoning)} reasoning).`
      )
    );

    try {
      const generatedSpec = await generateSpecDocument({
        workspaceRoot: projectRootPath,
        outputPath: currentProjectSettings.specPath,
        prdContent,
        promptTemplate: currentProjectSettings.specPrompt,
        userPrompt: trimmedPrompt,
        provider: selectedModelProvider,
        model: selectedModel,
        reasoning: selectedReasoning,
        claudePath,
        codexPath
      });

      startTransition(() => {
        setSpecContent(generatedSpec.content, generatedSpec.sourcePath);
        setSpecPaneMode("preview");
      });
      setSpecGenerationPrompt("");
      setAgentStatus("idle");
      appendTerminalOutput(
        stampLog(
          "spec",
          `Specification draft generated, saved to ${generatedSpec.fileName}, and loaded into the review pane.`
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate a specification.";
      setSpecGenerationError(message);
      setAgentStatus("error");
      appendTerminalOutput(stampLog("error", message));
    }
  }, [
    appendTerminalOutput,
    claudePath,
    codexPath,
    currentProjectSettings.specPath,
    currentProjectSettings.specPrompt,
    desktopRuntime,
    prdContent,
    projectRootPath,
    selectedModel,
    selectedModelProvider,
    selectedReasoning,
    setAgentStatus,
    setSpecContent,
    setSpecPaneMode,
    specGenerationPrompt
  ]);

  const handleProjectModelChange = useCallback((model: typeof selectedModel) => {
    setSelectedModel(model);
    scheduleProjectSettingsSave(false);
  }, [scheduleProjectSettingsSave, setSelectedModel]);

  const handleProjectReasoningChange = useCallback((reasoning: typeof selectedReasoning) => {
    setReasoningProfile(reasoning);
    scheduleProjectSettingsSave(false);
  }, [scheduleProjectSettingsSave, setReasoningProfile]);

  const handlePrdPromptTemplateChange = useCallback((value: string) => {
    setPrdPromptTemplate(value);
    scheduleProjectSettingsSave(false);
  }, [scheduleProjectSettingsSave, setPrdPromptTemplate]);

  const handleSpecPromptTemplateChange = useCallback((value: string) => {
    setSpecPromptTemplate(value);
    scheduleProjectSettingsSave(false);
  }, [scheduleProjectSettingsSave, setSpecPromptTemplate]);

  const handleConfiguredPrdPathChange = useCallback((value: string) => {
    setConfiguredPrdPath(normalizeProjectRelativePath(value));
    scheduleProjectSettingsSave(true);
  }, [scheduleProjectSettingsSave, setConfiguredPrdPath]);

  const handleConfiguredSpecPathChange = useCallback((value: string) => {
    setConfiguredSpecPath(normalizeProjectRelativePath(value));
    scheduleProjectSettingsSave(true);
  }, [scheduleProjectSettingsSave, setConfiguredSpecPath]);

  const handleSupportingDocumentsChange = useCallback((value: string) => {
    setSupportingDocumentPaths(parseSupportingDocumentPaths(value));
    scheduleProjectSettingsSave(false);
  }, [scheduleProjectSettingsSave, setSupportingDocumentPaths]);

  const handleCommandSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setCommandSearch(event.target.value),
    []
  );

  const closeWorkspaceSearch = useCallback(() => {
    setIsSearchOpen(false);
    setCommandSearch("");
  }, []);

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

  const handleWorkspaceFileOpenClick = useCallback((path: string) => {
    void handleWorkspaceFileOpen(path);
  }, [handleWorkspaceFileOpen]);

  const handleGeneratePrdClick = useCallback(() => {
    void handleGeneratePrd();
  }, [handleGeneratePrd]);

  const handleGenerateSpecClick = useCallback(() => {
    void handleGenerateSpec();
  }, [handleGenerateSpec]);

  const handleSaveConfigurationAndContinue = useCallback(() => {
    void saveCurrentProjectSettings({ reloadProject: true, navigateToReview: true });
  }, [saveCurrentProjectSettings]);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mediaQuery.matches);
    const handleThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dracula");
  }, [resolvedTheme]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const isFindShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "f";

      if (isFindShortcut) {
        if (!isReviewRoute) {
          return;
        }

        event.preventDefault();
        setIsSearchOpen((currentValue) => {
          if (currentValue) {
            setCommandSearch("");
            return false;
          }

          return true;
        });
        return;
      }

      if (event.key === "Escape" && isSearchOpen) {
        event.preventDefault();
        closeWorkspaceSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeWorkspaceSearch, isReviewRoute, isSearchOpen]);

  useEffect(() => {
    if (!isReviewRoute && isSearchOpen) {
      closeWorkspaceSearch();
    }
  }, [closeWorkspaceSearch, isReviewRoute, isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen || !isReviewRoute) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [isReviewRoute, isSearchOpen]);

  useEffect(() => {
    if (hasScannedEnvironmentRef.current) {
      return;
    }

    hasScannedEnvironmentRef.current = true;
    void refreshDiagnostics(environment);
  }, [environment, refreshDiagnostics]);

  useEffect(() => {
    if (hasAttemptedProjectRestore || !desktopRuntime) {
      return;
    }

    if (!lastProjectPath.trim()) {
      setHasAttemptedProjectRestore(true);
      return;
    }

    let isDisposed = false;
    setIsProjectLoading(true);

    void loadProjectContext(lastProjectPath)
      .then((context) => {
        if (isDisposed) {
          return;
        }

        applyProjectContext(context, {
          navigateToReview: context.hasSavedSettings
        });
      })
      .catch(() => {
        if (isDisposed) {
          return;
        }

        setLastProjectPath("");
      })
      .finally(() => {
        if (isDisposed) {
          return;
        }

        setIsProjectLoading(false);
        setHasAttemptedProjectRestore(true);
      });

    return () => {
      isDisposed = true;
    };
  }, [
    applyProjectContext,
    desktopRuntime,
    hasAttemptedProjectRestore,
    lastProjectPath,
    setLastProjectPath
  ]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isDisposed = false;

    void subscribeToAgentEvents({
      onLine: appendTerminalOutput,
      onState: (payload) => {
        applyAgentEvent(payload);
        if (payload.pendingDiff) {
          setLatestDiff(payload.pendingDiff);
        }
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
      clearFallbackTimer(fallbackTimerRef);

      if (projectSaveTimerRef.current !== null) {
        window.clearTimeout(projectSaveTimerRef.current);
        projectSaveTimerRef.current = null;
      }
    };
  }, [appendTerminalOutput, applyAgentEvent]);

  const reviewScreen = hasSavedProjectSettings ? (
    <PrdScreen
      agentStatus={agentStatus}
      commandSearch={commandSearch}
      controlColumnProps={{
        configuredModelProviders,
        autonomyMode,
        mcpItems,
        onModeChange: setAutonomyMode,
        onModelChange: handleProjectModelChange,
        onReasoningChange: handleProjectReasoningChange,
        selectedModel,
        selectedReasoning
      }}
      inspectorColumnProps={{
        emptyStateMessage: deferredSearch.trim()
          ? `No files match "${deferredSearch.trim()}".`
          : "Choose another project folder from setup if you want to switch workspaces.",
        folderInputRef,
        hasWorkspaceEntries: workspaceEntries.length > 0,
        onFileOpen: handleWorkspaceFileOpenClick,
        onFolderChange: handleWorkspaceFolderSelection,
        onOpenFolder: handlePickProjectFolder,
        workspaceEntries: filteredWorkspaceEntries,
        workspaceNotice,
        workspaceRootName: projectRootName
      }}
      isSearchOpen={isSearchOpen}
      isSpecApproved={isSpecApproved}
      mainWorkspaceProps={{
        activeTab,
        agentStatus,
        canGeneratePrd,
        canGenerateSpec,
        configPath: configPathDisplay,
        executionSummary,
        isGeneratingPrd,
        isGeneratingSpec,
        isSpecApproved,
        onActiveTabChange: setActiveTab,
        onApproveExecutionGate: handleApproveExecutionGateClick,
        onApproveSpec: handleApproveSpec,
        onEditorTabChange: updateEditorTabContent,
        onEditorTabClose: closeEditorTab,
        onEmergencyStop: handleEmergencyStopClick,
        onGeneratePrd: handleGeneratePrdClick,
        onGenerateSpec: handleGenerateSpecClick,
        onLoadPrd: handleOpenPrdImportClick,
        onLoadSpec: handleOpenSpecImportClick,
        onPrdContentChange: handlePrdContentChange,
        onPrdGenerationPromptChange: handlePrdGenerationPromptChange,
        onPrdPaneModeChange: setPrdPaneMode,
        onSpecContentChange: handleSpecContentChange,
        onSpecGenerationPromptChange: handleSpecGenerationPromptChange,
        onSpecPaneModeChange: setSpecPaneMode,
        onSpecSelect: handleSpecSelect,
        openEditorTabs,
        prdContent,
        prdGenerationError,
        prdGenerationHelperText,
        prdGenerationPrompt,
        prdPaneMode,
        prdPath,
        prdPromptTemplate,
        specContent,
        specGenerationError,
        specGenerationHelperText,
        specGenerationPrompt,
        specPaneMode,
        specPath,
        specPromptTemplate,
        terminalOutput,
        visibleDiff,
        workspaceRootName: projectRootName
      }}
      onCommandSearchChange={handleCommandSearchChange}
      onRefresh={handleRefresh}
      onStartBuild={handleStartBuildClick}
      searchInputRef={searchInputRef}
      workspaceRootName={projectRootName}
    />
  ) : hasAttemptedProjectRestore ? (
    <Navigate replace to="/" />
  ) : (
    <section className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--text-subtle)]">
      Loading project configuration...
    </section>
  );

  const settingsScreen = hasSavedProjectSettings ? (
    <SettingsScreen
      agentStatus={agentStatus}
      onRefresh={handleRefresh}
      settingsViewProps={{
        annotations,
        claudePath,
        codexPath,
        configPath: configPathDisplay,
        environment,
        onClaudePathChange: setClaudePath,
        onCodexPathChange: setCodexPath,
        onModelChange: handleProjectModelChange,
        onPrdPathChange: handleConfiguredPrdPathChange,
        onPrdPromptChange: handlePrdPromptTemplateChange,
        onReasoningChange: handleProjectReasoningChange,
        onSpecPathChange: handleConfiguredSpecPathChange,
        onSpecPromptChange: handleSpecPromptTemplateChange,
        onSupportingDocumentsChange: handleSupportingDocumentsChange,
        onThemeChange: setTheme,
        prdPath: configuredPrdPath,
        prdPrompt: prdPromptTemplate,
        projectErrorMessage,
        projectStatusMessage,
        selectedModel,
        selectedReasoning,
        specPath: configuredSpecPath,
        specPrompt: specPromptTemplate,
        supportingDocumentsValue,
        theme,
        workspaceRootName: projectRootName
      }}
    />
  ) : hasAttemptedProjectRestore ? (
    <Navigate replace to="/" />
  ) : (
    <section className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--text-subtle)]">
      Loading project configuration...
    </section>
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
            element={
              <ConfigurationScreen
                claudePath={claudePath}
                codexPath={codexPath}
                desktopRuntime={desktopRuntime}
                environment={environment}
                errorMessage={projectErrorMessage}
                hasSavedSettings={hasSavedProjectSettings}
                isProjectLoading={isProjectLoading || isImporting}
                isSaving={isProjectSaving}
                onClaudePathChange={setClaudePath}
                onCodexPathChange={setCodexPath}
                onContinue={handleSaveConfigurationAndContinue}
                onModelChange={handleProjectModelChange}
                onPickFolder={handlePickProjectFolder}
                onPrdPathChange={handleConfiguredPrdPathChange}
                onPrdPromptChange={handlePrdPromptTemplateChange}
                onReasoningChange={handleProjectReasoningChange}
                onRefresh={handleRefresh}
                onSpecPathChange={handleConfiguredSpecPathChange}
                onSpecPromptChange={handleSpecPromptTemplateChange}
                onSupportingDocumentsChange={handleSupportingDocumentsChange}
                prdPath={configuredPrdPath}
                prdPrompt={prdPromptTemplate}
                selectedModel={selectedModel}
                selectedReasoning={selectedReasoning}
                settingsPath={configPathDisplay}
                specPath={configuredSpecPath}
                specPrompt={specPromptTemplate}
                statusMessage={projectStatusMessage}
                supportingDocumentsValue={supportingDocumentsValue}
                workspaceRootName={projectRootName}
                workspaceRootPath={projectRootPath}
              />
            }
            path="/"
          />
          <Route element={reviewScreen} path="/review" />
          <Route element={settingsScreen} path="/settings" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </div>
    </main>
  );
}

export default App;

function buildWorkspaceNotice(context: ProjectContext) {
  const loadedDocuments = [
    context.prdDocument?.fileName ? `PRD: ${context.prdDocument.fileName}` : null,
    context.specDocument?.fileName ? `SPEC: ${context.specDocument.fileName}` : null
  ].filter((value): value is string => value !== null);

  if (loadedDocuments.length === 0) {
    return `${context.rootName} is configured. No document exists yet at ${context.settings.prdPath} or ${context.settings.specPath}.`;
  }

  return `${context.rootName} is configured. Loaded ${loadedDocuments.join(" and ")} from the saved project paths.`;
}
