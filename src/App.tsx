import {
  CodeBracketsSquare,
  Flask,
  Folder,
  Page,
  PlaySolid,
  Search,
  Settings
} from "iconoir-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type ChangeEvent
} from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation
} from "react-router-dom";

import bundledPrd from "../docs/PRD.md?raw";
import bundledSpec from "../docs/SPEC.md?raw";
import { ControlColumn } from "./components/ControlColumn";
import { InspectorColumn } from "./components/InspectorColumn";
import { MainWorkspace } from "./components/MainWorkspace";
import { SettingsView } from "./components/SettingsView";
import {
  DEFAULT_PENDING_DIFF,
  approveAgentAction,
  emergencyStop,
  getGitDiff,
  getWorkspaceSnapshot,
  isTauriRuntime,
  parseDocument,
  runEnvironmentScan,
  startAgentRun,
  subscribeToAgentEvents
} from "./lib/runtime";
import {
  buildWorkspaceImportSnapshot,
  findProjectDocuments,
  parseWorkspaceDocument,
  type ImportableFile
} from "./lib/workspaceImport";
import { useAgentStore } from "./store/useAgentStore";
import { useProjectStore } from "./store/useProjectStore";
import { useSettingsStore } from "./store/useSettingsStore";
import type { AgentStatus, AutonomyMode, EnvironmentStatus, ThemeMode } from "./types";

type DocumentTarget = "prd" | "spec";

interface FallbackStep {
  delayMs: number;
  line: string;
  milestone: string;
  gateLabel?: string;
  diff?: string;
  status?: AgentStatus;
  summary?: string;
}

function App() {
  const location = useLocation();
  const isSettingsRoute = location.pathname === "/settings";
  const project = useProjectStore();
  const agent = useAgentStore();
  const settings = useSettingsStore();
  const [commandSearch, setCommandSearch] = useState("");
  const [importPath, setImportPath] = useState("docs/PRD.md");
  const [importTarget, setImportTarget] = useState<DocumentTarget>("prd");
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [latestDiff, setLatestDiff] = useState(DEFAULT_PENDING_DIFF);
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [workspaceRootName, setWorkspaceRootName] = useState("SpecForge");
  const [workspaceNotice, setWorkspaceNotice] = useState(
    "Open a folder to scan for PRD/spec files and build the workspace tree."
  );
  const [hasOpenedWorkspaceFolder, setHasOpenedWorkspaceFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const fallbackStepsRef = useRef<FallbackStep[]>([]);
  const fallbackIndexRef = useRef(0);
  const deferredSearch = useDeferredValue(commandSearch);
  const filteredWorkspaceEntries = settings.workspaceEntries.filter((entry) =>
    entry.path.toLowerCase().includes(deferredSearch.toLowerCase())
  );
  const visibleDiff = agent.pendingDiff ?? latestDiff;
  const resolvedTheme = resolveTheme(settings.theme, systemPrefersDark);

  useEffect(() => {
    startTransition(() => {
      project.setPrdContent(bundledPrd, "docs/PRD.md");
      project.setSpecContent(bundledSpec, "docs/SPEC.md");
    });
  }, []);

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
    void refreshDiagnostics(settings.environment);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void subscribeToAgentEvents({
      onLine: (line) => agent.appendTerminalOutput(line),
      onState: (payload) => {
        agent.applyEvent(payload);
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
  }, []);

  async function refreshDiagnostics(previousEnvironment?: EnvironmentStatus) {
    const [environment, workspaceEntries, diff] = await Promise.all([
      runEnvironmentScan({
        claudePath: settings.claudePath,
        codexPath: settings.codexPath
      }).catch(() => previousEnvironment ?? settings.environment),
      getWorkspaceSnapshot().catch(() => settings.workspaceEntries),
      getGitDiff().catch(() => DEFAULT_PENDING_DIFF)
    ]);

    settings.setEnvironment(environment);

    if (!hasOpenedWorkspaceFolder) {
      settings.setWorkspaceEntries(workspaceEntries);
    }

    setLatestDiff(diff);
  }

  async function handlePathImport() {
    setIsImporting(true);
    setImportError("");

    try {
      assignDocument(importTarget, await parseDocument(importPath), importPath);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to parse the requested document.");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] as ImportableFile | undefined;

    if (!file) {
      return;
    }

    try {
      const document = await parseWorkspaceDocument(file);
      assignDocument(importTarget, document.content, document.sourcePath);
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The selected file could not be imported.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleWorkspaceFolderSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []) as ImportableFile[];

    if (files.length === 0) {
      return;
    }

    const snapshot = buildWorkspaceImportSnapshot(files);
    const matches = findProjectDocuments(files);
    const loadedDocuments: string[] = [];

    settings.setWorkspaceEntries(snapshot.entries);
    setWorkspaceRootName(snapshot.rootName);
    setHasOpenedWorkspaceFolder(true);

    try {
      if (matches.prdFile) {
        const document = await parseWorkspaceDocument(matches.prdFile);
        project.setPrdContent(document.content, document.sourcePath);
        loadedDocuments.push(matches.prdFile.name);
      }

      if (matches.specFile) {
        const document = await parseWorkspaceDocument(matches.specFile);
        project.setSpecContent(document.content, document.sourcePath);
        loadedDocuments.push(matches.specFile.name);
      }

      if (loadedDocuments.length > 0) {
        setWorkspaceNotice(`Loaded ${loadedDocuments.join(" and ")} from ${snapshot.rootName}.`);
        agent.appendTerminalOutput(
          stampLog("workspace", `Loaded workspace folder ${snapshot.rootName} and detected ${loadedDocuments.join(", ")}.`)
        );
      } else {
        setWorkspaceNotice(
          `${snapshot.rootName} opened successfully, but no matching PRD/spec files were found.`
        );
      }
    } catch (error) {
      setWorkspaceNotice(
        error instanceof Error
          ? `${snapshot.rootName} opened, but document parsing failed: ${error.message}`
          : `${snapshot.rootName} opened, but one of the detected documents could not be parsed.`
      );
    } finally {
      event.target.value = "";
    }
  }

  function assignDocument(target: DocumentTarget, content: string, path: string) {
    startTransition(() => {
      if (target === "prd") {
        project.setPrdContent(content, path);
      } else {
        project.setSpecContent(content, path);
        project.setSpecPaneMode("edit");
      }
    });
  }

  function handleApproveSpec() {
    project.approveSpec();
    agent.appendTerminalOutput(stampLog("review", "Specification approved. Build controls are now armed."));
  }

  async function handleStartBuild() {
    if (!project.isSpecApproved) {
      return;
    }

    clearFallbackTimer(fallbackTimerRef);
    agent.resetRun();
    project.setActiveTab("execute");
    agent.setStatus("executing");
    agent.setCurrentMilestone("Pre-flight Check");
    agent.appendTerminalOutput(stampLog("build", "Starting spec-driven build run."));

    if (isTauriRuntime()) {
      try {
        await startAgentRun(project.specContent, project.autonomyMode);
        return;
      } catch (error) {
        agent.appendTerminalOutput(
          stampLog(
            "error",
            `${error instanceof Error ? error.message : "Agent startup failed."} Falling back to the local simulator.`
          )
        );
      }
    }

    fallbackStepsRef.current = buildFallbackSteps(project.autonomyMode);
    fallbackIndexRef.current = 0;
    runFallbackStep(agent, fallbackStepsRef, fallbackIndexRef, fallbackTimerRef, setLatestDiff);
  }

  async function handleApproveExecutionGate() {
    if (agent.status !== "awaiting_approval") {
      return;
    }

    agent.appendTerminalOutput(stampLog("gate", "Approval received. Resuming execution."));
    agent.setPendingDiff(null);

    if (isTauriRuntime()) {
      await approveAgentAction();
      return;
    }

    agent.setStatus("executing");
    runFallbackStep(agent, fallbackStepsRef, fallbackIndexRef, fallbackTimerRef, setLatestDiff);
  }

  async function handleEmergencyStop() {
    clearFallbackTimer(fallbackTimerRef);
    agent.setStatus("halted");
    agent.setExecutionSummary("Execution stopped by the operator.");
    agent.setPendingDiff(null);
    agent.appendTerminalOutput(stampLog("halt", "Emergency stop triggered. Agent loop is paused."));

    if (isTauriRuntime()) {
      await emergencyStop();
    }
  }

  return (
    <main className="app-shell">
      <aside className="app-rail">
        <div className="rail-logo">SF</div>
        <NavLink className={getRailLinkClassName} end to="/">
          <Page />
        </NavLink>
        <button className="rail-button" type="button">
          <CodeBracketsSquare />
        </button>
        <button className="rail-button" type="button">
          <Flask />
        </button>
        <button className="rail-button" type="button">
          <Folder />
        </button>
        <div className="rail-spacer" />
        <NavLink className={getRailLinkClassName} to="/settings">
          <Settings />
        </NavLink>
      </aside>

      <div className="app-frame">
        <header className="topbar">
          {isSettingsRoute ? (
            <div className="topbar-title-block">
              <p className="eyebrow">Navigation</p>
              <h1>Settings</h1>
            </div>
          ) : (
            <div className="topbar-search">
              <Search />
              <input
                aria-label="Search workspace"
                onChange={(event) => setCommandSearch(event.target.value)}
                placeholder="Search SpecForge"
                value={commandSearch}
              />
              <span className="topbar-kbd">Ctrl+K</span>
            </div>
          )}

          <div className="topbar-actions">
            <span className={`status-pill status-pill-${agent.status}`}>{formatAgentStatus(agent.status)}</span>
            <button className="ghost-button" onClick={() => void refreshDiagnostics()} type="button">
              Refresh
            </button>
            {!isSettingsRoute ? (
              <button
                className="primary-button"
                disabled={!project.isSpecApproved}
                onClick={() => void handleStartBuild()}
                type="button"
              >
                <PlaySolid />
                Start Build
              </button>
            ) : null}
          </div>
        </header>

        <Routes>
          <Route
            element={
              <div className="workspace-grid">
                <ControlColumn
                  annotations={project.annotations}
                  autonomyMode={project.autonomyMode}
                  fileInputRef={fileInputRef}
                  importError={importError}
                  importPath={importPath}
                  importTarget={importTarget}
                  isImporting={isImporting}
                  isSpecApproved={project.isSpecApproved}
                  onApplyRefinement={() => project.applyRefinement()}
                  onApproveSpec={handleApproveSpec}
                  onFileChange={handleFileSelection}
                  onFilePick={() => fileInputRef.current?.click()}
                  onImportPathChange={setImportPath}
                  onImportTargetChange={setImportTarget}
                  onModeChange={project.setAutonomyMode}
                  onModelChange={project.setSelectedModel}
                  onPathImport={() => void handlePathImport()}
                  onReviewPromptChange={project.setReviewPrompt}
                  reviewPrompt={project.reviewPrompt}
                  selectedModel={project.selectedModel}
                  selectedSpecText={project.selectedSpecRange?.text.trim() || ""}
                />

                <MainWorkspace
                  activeTab={project.activeTab}
                  agentStatus={agent.status}
                  executionSummary={agent.executionSummary}
                  onActiveTabChange={project.setActiveTab}
                  onApproveExecutionGate={() => void handleApproveExecutionGate()}
                  onEmergencyStop={() => void handleEmergencyStop()}
                  onPrdContentChange={(value) => project.setPrdContent(value, project.prdPath)}
                  onPrdPaneModeChange={project.setPrdPaneMode}
                  onSpecContentChange={(value) => project.setSpecContent(value, project.specPath)}
                  onSpecPaneModeChange={project.setSpecPaneMode}
                  onSpecSelect={(event) => {
                    const { selectionStart, selectionEnd, value } = event.target;
                    project.setSelectedSpecRange(
                      selectionStart === selectionEnd
                        ? null
                        : {
                            start: selectionStart,
                            end: selectionEnd,
                            text: value.slice(selectionStart, selectionEnd)
                          }
                    );
                  }}
                  prdContent={project.prdContent}
                  prdPaneMode={project.prdPaneMode}
                  prdPath={project.prdPath}
                  specContent={project.specContent}
                  specPaneMode={project.specPaneMode}
                  specPath={project.specPath}
                  terminalOutput={agent.terminalOutput}
                  visibleDiff={visibleDiff}
                />

                <InspectorColumn
                  folderInputRef={folderInputRef}
                  onFolderChange={handleWorkspaceFolderSelection}
                  onOpenFolder={() => folderInputRef.current?.click()}
                  workspaceEntries={filteredWorkspaceEntries}
                  workspaceNotice={workspaceNotice}
                  workspaceRootName={workspaceRootName}
                />
              </div>
            }
            path="/"
          />
          <Route
            element={
              <div className="settings-route">
                <SettingsView
                  claudePath={settings.claudePath}
                  codexPath={settings.codexPath}
                  environment={settings.environment}
                  onClaudePathChange={settings.setClaudePath}
                  onCodexPathChange={settings.setCodexPath}
                  onRefresh={() => void refreshDiagnostics()}
                  onThemeChange={settings.setTheme}
                  theme={settings.theme}
                />
              </div>
            }
            path="/settings"
          />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </div>
    </main>
  );
}

function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean) {
  if (theme === "system") {
    return systemPrefersDark ? "dracula" : "light";
  }

  return theme;
}

function formatAgentStatus(status: AgentStatus) {
  if (status === "awaiting_approval") {
    return "Awaiting approval";
  }

  return `${status[0]?.toUpperCase()}${status.slice(1).replace("_", " ")}`;
}

function stampLog(scope: string, message: string) {
  return `${new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })}  [${scope}] ${message}`;
}

function getRailLinkClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "rail-button rail-button-active" : "rail-button";
}

function clearFallbackTimer(timerRef: { current: number | null }) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function runFallbackStep(
  agent: ReturnType<typeof useAgentStore.getState>,
  stepsRef: { current: FallbackStep[] },
  indexRef: { current: number },
  timerRef: { current: number | null },
  setLatestDiff: (diff: string) => void
) {
  clearFallbackTimer(timerRef);
  const nextStep = stepsRef.current[indexRef.current];

  if (!nextStep) {
    return;
  }

  timerRef.current = window.setTimeout(() => {
    agent.appendTerminalOutput(stampLog("cli", nextStep.line));
    agent.setCurrentMilestone(nextStep.milestone);

    if (nextStep.gateLabel) {
      agent.setStatus("awaiting_approval");
      agent.setExecutionSummary(nextStep.gateLabel);
      agent.setPendingDiff(nextStep.diff ?? DEFAULT_PENDING_DIFF);
      setLatestDiff(nextStep.diff ?? DEFAULT_PENDING_DIFF);
      indexRef.current += 1;
      return;
    }

    if (nextStep.status) {
      agent.setStatus(nextStep.status);
    }

    if (nextStep.summary) {
      agent.setExecutionSummary(nextStep.summary);
    }

    if (nextStep.diff) {
      setLatestDiff(nextStep.diff);
    }

    indexRef.current += 1;
    runFallbackStep(agent, stepsRef, indexRef, timerRef, setLatestDiff);
  }, nextStep.delayMs);
}

function buildFallbackSteps(mode: AutonomyMode): FallbackStep[] {
  const steps: FallbackStep[] = [
    {
      delayMs: 500,
      line: "Validating approved specification and loading execution context.",
      milestone: "Pre-flight Check",
      status: "executing"
    },
    {
      delayMs: 700,
      line: "Scanning CLI environment and staging the workspace diff review.",
      milestone: "Pre-flight Check"
    },
    {
      delayMs: 800,
      line: "Mapping milestones for React, Zustand, and Tauri command surfaces.",
      milestone: "Milestone Planning"
    }
  ];

  if (mode === "stepped") {
    steps.push({
      delayMs: 650,
      line: "A write action is about to run against the approved spec.",
      milestone: "Stepped Approval",
      gateLabel: "Approve this write before the agent mutates code or shell state.",
      diff: DEFAULT_PENDING_DIFF,
      status: "awaiting_approval"
    });
  }

  steps.push(
    {
      delayMs: 700,
      line: "Writing Dracula theme tokens and desktop shell layout.",
      milestone: "Compose Review Workspace"
    },
    {
      delayMs: 650,
      line: "Connecting state stores to the review surface and execution dashboard.",
      milestone: "Compose Review Workspace"
    }
  );

  if (mode === "milestone") {
    steps.push({
      delayMs: 650,
      line: "Milestone complete. Review the diff before continuing to the next chunk.",
      milestone: "Milestone Approval",
      gateLabel: "Milestone boundary reached. Review the staged diff and approve to continue.",
      diff: DEFAULT_PENDING_DIFF,
      status: "awaiting_approval"
    });
  }

  steps.push(
    {
      delayMs: 700,
      line: "Streaming console output and enabling interruption controls.",
      milestone: "Execution Dashboard"
    },
    {
      delayMs: 650,
      line: "Refreshing final diff state and packaging the handoff summary.",
      milestone: "Execution Dashboard"
    },
    {
      delayMs: 500,
      line: "Fallback execution completed. Review the diff and continue in your IDE.",
      milestone: "Complete",
      status: "completed",
      summary: "Fallback simulation completed. The approved spec, diff, and execution stream are ready for handoff."
    }
  );

  return steps;
}

export default App;
