import {
  useCallback,
  startTransition,
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
  useLocation
} from "react-router-dom";

import bundledPrd from "../docs/PRD.md?raw";
import bundledSpec from "../docs/SPEC.md?raw";
import { AppRail } from "./components/AppRail";
import {
  DocumentTarget,
  FallbackStep,
  WorkspaceFileSource,
  WorkspaceSelectionPayload,
  buildFallbackSteps,
  clearFallbackTimer,
  collectWorkspaceFiles,
  filterWorkspaceEntries,
  getDirectoryPicker,
  isDirectoryPickerAbort,
  isOpenableWorkspacePath,
  normalizeWorkspacePath,
  resolveTheme,
  runFallbackStep,
  stampLog
} from "./lib/appShell";
import {
  getModelLabel,
  getModelOptions,
  getModelProvider,
  getReasoningLabel
} from "./lib/agentConfig";
import {
  DEFAULT_PENDING_DIFF,
  approveAgentAction,
  emergencyStop,
  getGitDiff,
  getWorkspaceSnapshot,
  isTauriRuntime,
  openWorkspaceFolder,
  parseDocument,
  readWorkspaceFile,
  runEnvironmentScan,
  startAgentRun,
  subscribeToAgentEvents
} from "./lib/runtime";
import {
  buildWorkspaceImportSnapshot,
  filterWorkspaceFiles,
  findProjectDocuments,
  isOpenableTextFile,
  parseWorkspaceDocument,
  parseWorkspaceTextFile,
  type ImportableFile
} from "./lib/workspaceImport";
import { useAgentStore } from "./store/useAgentStore";
import { useProjectStore } from "./store/useProjectStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { PrdScreen } from "./screens/PrdScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import type {
  EnvironmentStatus,
  ModelProvider
} from "./types";

function App() {
  const location = useLocation();
  const isSettingsRoute = location.pathname === "/settings";
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
  const isSpecApproved = useProjectStore((state) => state.isSpecApproved);
  const openEditorTabs = useProjectStore((state) => state.openEditorTabs);
  const prdContent = useProjectStore((state) => state.prdContent);
  const prdPaneMode = useProjectStore((state) => state.prdPaneMode);
  const prdPath = useProjectStore((state) => state.prdPath);
  const reviewPrompt = useProjectStore((state) => state.reviewPrompt);
  const selectedModel = useProjectStore((state) => state.selectedModel);
  const selectedReasoning = useProjectStore((state) => state.selectedReasoning);
  const selectedSpecRange = useProjectStore((state) => state.selectedSpecRange);
  const specContent = useProjectStore((state) => state.specContent);
  const specPaneMode = useProjectStore((state) => state.specPaneMode);
  const specPath = useProjectStore((state) => state.specPath);
  const approveSpec = useProjectStore((state) => state.approveSpec);
  const applyRefinement = useProjectStore((state) => state.applyRefinement);
  const closeEditorTab = useProjectStore((state) => state.closeEditorTab);
  const openEditorTab = useProjectStore((state) => state.openEditorTab);
  const setActiveTab = useProjectStore((state) => state.setActiveTab);
  const setAutonomyMode = useProjectStore((state) => state.setAutonomyMode);
  const setPrdContent = useProjectStore((state) => state.setPrdContent);
  const setPrdPaneMode = useProjectStore((state) => state.setPrdPaneMode);
  const setReasoningProfile = useProjectStore((state) => state.setReasoningProfile);
  const setReviewPrompt = useProjectStore((state) => state.setReviewPrompt);
  const setSelectedModel = useProjectStore((state) => state.setSelectedModel);
  const setSelectedSpecRange = useProjectStore((state) => state.setSelectedSpecRange);
  const setSpecContent = useProjectStore((state) => state.setSpecContent);
  const setSpecPaneMode = useProjectStore((state) => state.setSpecPaneMode);
  const updateEditorTabContent = useProjectStore((state) => state.updateEditorTabContent);

  const claudePath = useSettingsStore((state) => state.claudePath);
  const codexPath = useSettingsStore((state) => state.codexPath);
  const environment = useSettingsStore((state) => state.environment);
  const theme = useSettingsStore((state) => state.theme);
  const workspaceEntries = useSettingsStore((state) => state.workspaceEntries);
  const setClaudePath = useSettingsStore((state) => state.setClaudePath);
  const setCodexPath = useSettingsStore((state) => state.setCodexPath);
  const setEnvironment = useSettingsStore((state) => state.setEnvironment);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setWorkspaceEntries = useSettingsStore((state) => state.setWorkspaceEntries);
  const [commandSearch, setCommandSearch] = useState("");
  const [importPath, setImportPath] = useState("docs/PRD.md");
  const [importTarget, setImportTarget] = useState<DocumentTarget>("prd");
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [latestDiff, setLatestDiff] = useState(DEFAULT_PENDING_DIFF);
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [workspaceRootName, setWorkspaceRootName] = useState("SpecForge");
  const [workspaceNotice, setWorkspaceNotice] = useState(
    "Open a folder to scan for PRD/spec files and build the workspace tree."
  );
  const [hasOpenedWorkspaceFolder, setHasOpenedWorkspaceFolder] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, WorkspaceFileSource>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const fallbackStepsRef = useRef<FallbackStep[]>([]);
  const fallbackIndexRef = useRef(0);
  const hasInitializedDocumentsRef = useRef(false);
  const hasScannedEnvironmentRef = useRef(false);
  const deferredSearch = useDeferredValue(commandSearch);
  const filteredWorkspaceEntries = useMemo(
    () => filterWorkspaceEntries(workspaceEntries, deferredSearch),
    [deferredSearch, workspaceEntries]
  );
  const selectedSpecText = useMemo(
    () => selectedSpecRange?.text.trim() || "",
    [selectedSpecRange]
  );
  const visibleDiff = pendingDiff ?? latestDiff;
  const resolvedTheme = useMemo(
    () => resolveTheme(theme, systemPrefersDark),
    [theme, systemPrefersDark]
  );
  const configuredModelProviders = useMemo<ModelProvider[]>(() => {
    const providers: ModelProvider[] = [];

    if (claudePath.trim() || environment.claude.status === "found") {
      providers.push("claude");
    }

    if (codexPath.trim() || environment.codex.status === "found") {
      providers.push("codex");
    }

    return providers;
  }, [claudePath, codexPath, environment.claude.status, environment.codex.status]);

  const refreshDiagnostics = useCallback(
    async (previousEnvironment?: EnvironmentStatus) => {
      const [nextEnvironment, snapshotEntries, diff] = await Promise.all([
        runEnvironmentScan({
          claudePath,
          codexPath
        }).catch(() => previousEnvironment ?? environment),
        getWorkspaceSnapshot().catch(() => workspaceEntries),
        getGitDiff().catch(() => DEFAULT_PENDING_DIFF)
      ]);

      setEnvironment(nextEnvironment);

      if (!hasOpenedWorkspaceFolder) {
        setWorkspaceEntries(snapshotEntries);
      }

      setLatestDiff(diff);
    },
    [
      claudePath,
      codexPath,
      environment,
      hasOpenedWorkspaceFolder,
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
          return;
        }

        setSpecContent(content, path);
        setSpecPaneMode("edit");
      });
    },
    [setPrdContent, setSpecContent, setSpecPaneMode]
  );

  const applyWorkspaceSelection = useCallback(
    ({
      rootName,
      entries,
      ignoredFileCount,
      files,
      prdDocument,
      specDocument
    }: WorkspaceSelectionPayload) => {
      const loadedDocuments: string[] = [];

      setWorkspaceEntries(entries);
      setWorkspaceRootName(rootName);
      setHasOpenedWorkspaceFolder(true);
      setWorkspaceFiles(files);

      startTransition(() => {
        if (prdDocument) {
          setPrdContent(prdDocument.content, prdDocument.sourcePath);
          loadedDocuments.push(prdDocument.fileName);
        }

        if (specDocument) {
          setSpecContent(specDocument.content, specDocument.sourcePath);
          setSpecPaneMode("edit");
          loadedDocuments.push(specDocument.fileName);
        }
      });

      if (loadedDocuments.length > 0) {
        setWorkspaceNotice(
          `Loaded ${loadedDocuments.join(" and ")} from ${rootName}.${ignoredFileCount > 0 ? ` Ignored ${ignoredFileCount} file(s) from .gitignore.` : ""}`
        );
        appendTerminalOutput(
          stampLog(
            "workspace",
            `Loaded workspace folder ${rootName} and detected ${loadedDocuments.join(", ")}.`
          )
        );
        return;
      }

      setWorkspaceNotice(
        `${rootName} opened successfully, but no matching PRD/spec files were found.${ignoredFileCount > 0 ? ` Ignored ${ignoredFileCount} file(s) from .gitignore.` : ""}`
      );
    },
    [
      appendTerminalOutput,
      setPrdContent,
      setSpecContent,
      setSpecPaneMode,
      setWorkspaceEntries
    ]
  );

  const importWorkspaceFiles = useCallback(
    async (files: ImportableFile[]) => {
      if (files.length === 0) {
        return;
      }

      const filteredFiles = await filterWorkspaceFiles(files);
      const snapshot = buildWorkspaceImportSnapshot(filteredFiles);
      const matches = findProjectDocuments(filteredFiles);
      const ignoredFileCount = files.length - filteredFiles.length;
      const nextWorkspaceFiles = filteredFiles.reduce<Record<string, WorkspaceFileSource>>(
        (accumulator, file) => {
          const normalizedPath = normalizeWorkspacePath(
            file.webkitRelativePath || file.name,
            snapshot.rootName
          );
          accumulator[normalizedPath] = {
            kind: "browser",
            file
          };
          return accumulator;
        },
        {}
      );

      try {
        const [prdDocument, specDocument] = await Promise.all([
          matches.prdFile ? parseWorkspaceDocument(matches.prdFile) : Promise.resolve(null),
          matches.specFile ? parseWorkspaceDocument(matches.specFile) : Promise.resolve(null)
        ]);

        applyWorkspaceSelection({
          rootName: snapshot.rootName,
          entries: snapshot.entries,
          ignoredFileCount,
          files: nextWorkspaceFiles,
          prdDocument: prdDocument
            ? {
                content: prdDocument.content,
                sourcePath: prdDocument.sourcePath,
                fileName: matches.prdFile?.name ?? prdDocument.sourcePath
              }
            : null,
          specDocument: specDocument
            ? {
                content: specDocument.content,
                sourcePath: specDocument.sourcePath,
                fileName: matches.specFile?.name ?? specDocument.sourcePath
              }
            : null
        });
      } catch (error) {
        setWorkspaceNotice(
          error instanceof Error
            ? `${snapshot.rootName} opened, but document parsing failed: ${error.message}`
            : `${snapshot.rootName} opened, but one of the detected documents could not be parsed.`
        );
      }
    },
    [applyWorkspaceSelection]
  );

  const handlePathImport = useCallback(async () => {
    setIsImporting(true);
    setImportError("");

    try {
      assignDocument(importTarget, await parseDocument(importPath), importPath);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to parse the requested document.");
    } finally {
      setIsImporting(false);
    }
  }, [assignDocument, importPath, importTarget]);

  const handleFileSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] as ImportableFile | undefined;

      if (!file) {
        return;
      }

      try {
        const document = await parseWorkspaceDocument(file);
        assignDocument(importTarget, document.content, document.sourcePath);
        setImportError("");
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "The selected file could not be imported."
        );
      } finally {
        event.target.value = "";
      }
    },
    [assignDocument, importTarget]
  );

  const handleWorkspaceFolderSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      try {
        await importWorkspaceFiles(Array.from(event.target.files ?? []) as ImportableFile[]);
      } finally {
        event.target.value = "";
      }
    },
    [importWorkspaceFiles]
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
        const content = await readWorkspaceFile(file.sourcePath);
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

  const handleApproveSpec = useCallback(() => {
    approveSpec();
    appendTerminalOutput(stampLog("review", "Specification approved. Build controls are now armed."));
  }, [appendTerminalOutput, approveSpec]);

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

    if (isTauriRuntime()) {
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
    isSpecApproved,
    resetRun,
    setActiveTab,
    setAgentStatus,
    setCurrentMilestone,
    selectedModel,
    selectedReasoning,
    specContent
  ]);

  const handleApproveExecutionGate = useCallback(async () => {
    if (agentStatus !== "awaiting_approval") {
      return;
    }

    appendTerminalOutput(stampLog("gate", "Approval received. Resuming execution."));
    setPendingDiff(null);

    if (isTauriRuntime()) {
      await approveAgentAction();
      return;
    }

    setAgentStatus("executing");
    runFallbackStep(useAgentStore.getState(), fallbackStepsRef, fallbackIndexRef, fallbackTimerRef, setLatestDiff);
  }, [agentStatus, appendTerminalOutput, setAgentStatus, setPendingDiff]);

  const handleEmergencyStop = useCallback(async () => {
    clearFallbackTimer(fallbackTimerRef);
    setAgentStatus("halted");
    setExecutionSummary("Execution stopped by the operator.");
    setPendingDiff(null);
    appendTerminalOutput(stampLog("halt", "Emergency stop triggered. Agent loop is paused."));

    if (isTauriRuntime()) {
      await emergencyStop();
    }
  }, [appendTerminalOutput, setAgentStatus, setExecutionSummary, setPendingDiff]);

  const handleCommandSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setCommandSearch(event.target.value),
    []
  );

  const closeWorkspaceSearch = useCallback(() => {
    setIsSearchOpen(false);
    setCommandSearch("");
  }, []);

  const handleImportTargetChange = useCallback((target: DocumentTarget) => {
    setImportTarget(target);
  }, []);

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

  const handleOpenImportFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleOpenWorkspaceFolder = useCallback(async () => {
    if (isTauriRuntime()) {
      try {
        const workspaceFolder = await openWorkspaceFolder();

        if (!workspaceFolder) {
          return;
        }

        const nextWorkspaceFiles = Object.fromEntries(
          Object.entries(workspaceFolder.filePaths).map(([path, sourcePath]) => [
            path,
            {
              kind: "desktop",
              sourcePath,
              fileName: path.split("/").slice(-1)[0] ?? path
            } satisfies WorkspaceFileSource
          ])
        );

        applyWorkspaceSelection({
          rootName: workspaceFolder.rootName,
          entries: workspaceFolder.entries,
          ignoredFileCount: workspaceFolder.ignoredFileCount,
          files: nextWorkspaceFiles,
          prdDocument: workspaceFolder.prdDocument,
          specDocument: workspaceFolder.specDocument
        });
        return;
      } catch (error) {
        setWorkspaceNotice(
          error instanceof Error
            ? `Workspace import failed: ${error.message}`
            : "Workspace import failed."
        );
        return;
      }
    }

    const pickDirectory = getDirectoryPicker();

    if (pickDirectory) {
      try {
        const directoryHandle = await pickDirectory({ mode: "read" });
        await importWorkspaceFiles(await collectWorkspaceFiles(directoryHandle));
        return;
      } catch (error) {
        if (isDirectoryPickerAbort(error)) {
          return;
        }
      }
    }

    folderInputRef.current?.click();
  }, [applyWorkspaceSelection, importWorkspaceFiles]);

  const handleRefresh = useCallback(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handlePathImportClick = useCallback(() => {
    void handlePathImport();
  }, [handlePathImport]);

  const handleStartBuildClick = useCallback(() => {
    void handleStartBuild();
  }, [handleStartBuild]);

  const handleApproveExecutionGateClick = useCallback(() => {
    void handleApproveExecutionGate();
  }, [handleApproveExecutionGate]);

  const handleEmergencyStopClick = useCallback(() => {
    void handleEmergencyStop();
  }, [handleEmergencyStop]);

  const handleWorkspaceFileOpenClick = useCallback(
    (path: string) => {
      void handleWorkspaceFileOpen(path);
    },
    [handleWorkspaceFileOpen]
  );

  const handlePrdContentChange = useCallback(
    (value: string) => setPrdContent(value, prdPath),
    [prdPath, setPrdContent]
  );

  const handleSpecContentChange = useCallback(
    (value: string) => setSpecContent(value, specPath),
    [setSpecContent, specPath]
  );

  useEffect(() => {
    if (hasInitializedDocumentsRef.current) {
      return;
    }

    hasInitializedDocumentsRef.current = true;
    startTransition(() => {
      setPrdContent(bundledPrd, "docs/PRD.md");
      setSpecContent(bundledSpec, "docs/SPEC.md");
    });
  }, [setPrdContent, setSpecContent]);

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
    if (configuredModelProviders.length !== 1) {
      return;
    }

    const onlyConfiguredProvider = configuredModelProviders[0];

    if (getModelProvider(selectedModel) === onlyConfiguredProvider) {
      return;
    }

    const nextModel = getModelOptions(onlyConfiguredProvider)[0]?.value;

    if (nextModel) {
      setSelectedModel(nextModel);
    }
  }, [configuredModelProviders, selectedModel, setSelectedModel]);

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
        event.preventDefault();

        if (!isSettingsRoute) {
          setIsSearchOpen((currentValue) => {
            if (currentValue) {
              setCommandSearch("");
              return false;
            }

            return true;
          });
        }

        return;
      }

      if (event.key === "Escape" && isSearchOpen) {
        event.preventDefault();
        closeWorkspaceSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeWorkspaceSearch, isSearchOpen, isSettingsRoute]);

  useEffect(() => {
    if (isSettingsRoute && isSearchOpen) {
      closeWorkspaceSearch();
    }
  }, [closeWorkspaceSearch, isSearchOpen, isSettingsRoute]);

  useEffect(() => {
    if (!isSearchOpen || isSettingsRoute) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [isSearchOpen, isSettingsRoute]);

  useEffect(() => {
    if (hasScannedEnvironmentRef.current) {
      return;
    }

    hasScannedEnvironmentRef.current = true;
    void refreshDiagnostics(environment);
  }, [environment, refreshDiagnostics]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void subscribeToAgentEvents({
      onLine: appendTerminalOutput,
      onState: (payload) => {
        applyAgentEvent(payload);
        if (payload.pendingDiff) {
          setLatestDiff(payload.pendingDiff);
        }
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
      clearFallbackTimer(fallbackTimerRef);
    };
  }, [appendTerminalOutput, applyAgentEvent]);

  return (
    <main className="min-h-screen w-full">
      <AppRail />

      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col lg:ml-[72px]">
        <Routes>
          <Route
            element={
              <PrdScreen
                agentStatus={agentStatus}
                commandSearch={commandSearch}
                controlColumnProps={{
                  configuredModelProviders,
                  autonomyMode,
                  fileInputRef,
                  importError,
                  importPath,
                  importTarget,
                  isImporting,
                  isSpecApproved,
                  onApplyRefinement: applyRefinement,
                  onApproveSpec: handleApproveSpec,
                  onFileChange: handleFileSelection,
                  onFilePick: handleOpenImportFile,
                  onImportPathChange: setImportPath,
                  onImportTargetChange: handleImportTargetChange,
                  onModeChange: setAutonomyMode,
                  onModelChange: setSelectedModel,
                  onReasoningChange: setReasoningProfile,
                  onPathImport: handlePathImportClick,
                  onReviewPromptChange: setReviewPrompt,
                  reviewPrompt,
                  selectedModel,
                  selectedReasoning,
                  selectedSpecText
                }}
                inspectorColumnProps={{
                  emptyStateMessage: deferredSearch.trim()
                    ? `No files match "${deferredSearch.trim()}".`
                    : "Open a folder to scan its documents and build a workspace tree.",
                  folderInputRef,
                  hasWorkspaceEntries: workspaceEntries.length > 0,
                  onFileOpen: handleWorkspaceFileOpenClick,
                  onFolderChange: handleWorkspaceFolderSelection,
                  onOpenFolder: handleOpenWorkspaceFolder,
                  workspaceEntries: filteredWorkspaceEntries,
                  workspaceNotice,
                  workspaceRootName
                }}
                isSearchOpen={isSearchOpen}
                isSpecApproved={isSpecApproved}
                mainWorkspaceProps={{
                  activeTab,
                  agentStatus,
                  executionSummary,
                  onEditorTabChange: updateEditorTabContent,
                  onEditorTabClose: closeEditorTab,
                  onActiveTabChange: setActiveTab,
                  onApproveExecutionGate: handleApproveExecutionGateClick,
                  onEmergencyStop: handleEmergencyStopClick,
                  openEditorTabs,
                  onPrdContentChange: handlePrdContentChange,
                  onPrdPaneModeChange: setPrdPaneMode,
                  onSpecContentChange: handleSpecContentChange,
                  onSpecPaneModeChange: setSpecPaneMode,
                  onSpecSelect: handleSpecSelect,
                  prdContent,
                  prdPaneMode,
                  prdPath,
                  specContent,
                  specPaneMode,
                  specPath,
                  terminalOutput,
                  visibleDiff,
                  workspaceRootName
                }}
                onCommandSearchChange={handleCommandSearchChange}
                onRefresh={handleRefresh}
                onStartBuild={handleStartBuildClick}
                searchInputRef={searchInputRef}
              />
            }
            path="/"
          />
          <Route
            element={
              <SettingsScreen
                agentStatus={agentStatus}
                onRefresh={handleRefresh}
                settingsViewProps={{
                  annotations,
                  claudePath,
                  codexPath,
                  environment,
                  onClaudePathChange: setClaudePath,
                  onCodexPathChange: setCodexPath,
                  onThemeChange: setTheme,
                  theme
                }}
              />
            }
            path="/settings"
          />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </div>
    </main>
  );
}

export default App;
