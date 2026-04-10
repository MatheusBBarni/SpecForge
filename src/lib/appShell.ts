import { useAgentStore } from "../store/useAgentStore";
import type {
  AgentStatus,
  AutonomyMode,
  ThemeMode,
  WorkspaceDocument,
  WorkspaceEntry
} from "../types";
import { DEFAULT_PENDING_DIFF } from "./runtime";
import type { ImportableFile } from "./workspaceImport";

export type DocumentTarget = "prd" | "spec";

export type WorkspaceFileSource =
  | {
      kind: "browser";
      file: ImportableFile;
    }
  | {
      kind: "desktop";
      fileName: string;
    };

export interface WorkspaceSelectionPayload {
  rootName: string;
  entries: WorkspaceEntry[];
  ignoredFileCount: number;
  files: Record<string, WorkspaceFileSource>;
  prdDocument: WorkspaceDocument | null;
  specDocument: WorkspaceDocument | null;
}

export interface FallbackStep {
  delayMs: number;
  line: string;
  milestone: string;
  gateLabel?: string;
  diff?: string;
  status?: AgentStatus;
  summary?: string;
}

interface DirectoryPickerOptions {
  mode?: "read" | "readwrite";
}

type DirectoryPicker = (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;

export function getDirectoryPicker(): DirectoryPicker | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeWindow = window as Window & {
    showDirectoryPicker?: DirectoryPicker;
  };

  return maybeWindow.showDirectoryPicker?.bind(window) ?? null;
}

export async function collectWorkspaceFiles(
  directoryHandle: FileSystemDirectoryHandle,
  parentPath = directoryHandle.name
): Promise<ImportableFile[]> {
  const files: ImportableFile[] = [];
  const asyncDirectory = directoryHandle as unknown as AsyncIterable<
    [string, FileSystemDirectoryHandle | FileSystemFileHandle]
  >;

  for await (const [entryName, entry] of asyncDirectory) {
    const relativePath = parentPath ? `${parentPath}/${entryName}` : entryName;

    if (entry.kind === "directory") {
      files.push(...(await collectWorkspaceFiles(entry, relativePath)));
      continue;
    }

    const file = (await entry.getFile()) as ImportableFile;
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: relativePath
    });
    files.push(file);
  }

  return files;
}

export function isDirectoryPickerAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean) {
  if (theme === "system") {
    return systemPrefersDark ? "dracula" : "light";
  }

  return theme;
}

export function formatAgentStatus(status: AgentStatus) {
  if (status === "awaiting_approval") {
    return "Awaiting approval";
  }

  return `${status[0]?.toUpperCase()}${status.slice(1).replace("_", " ")}`;
}

export function stampLog(scope: string, message: string) {
  return `${new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })}  [${scope}] ${message}`;
}

export function clearFallbackTimer(timerRef: { current: number | null }) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function runFallbackStep(
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

export function buildFallbackSteps(
  mode: AutonomyMode,
  modelLabel: string,
  reasoningLabel: string
): FallbackStep[] {
  const steps: FallbackStep[] = [
    {
      delayMs: 500,
      line: `Launching ${modelLabel} with ${reasoningLabel.toLowerCase()} reasoning against the approved specification.`,
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
      summary:
        "Fallback simulation completed. The approved spec, diff, and execution stream are ready for handoff."
    }
  );

  return steps;
}

export function normalizeWorkspacePath(path: string, rootName: string) {
  const normalizedPath = path.replace(/\\/g, "/").replace(/^\/+/, "");

  if (normalizedPath.startsWith(`${rootName}/`)) {
    return normalizedPath.slice(rootName.length + 1);
  }

  return normalizedPath;
}

export function isOpenableWorkspacePath(path: string) {
  const normalizedPath = path.toLowerCase();

  if (normalizedPath.endsWith("/.gitignore") || normalizedPath === ".gitignore") {
    return true;
  }

  return OPENABLE_TEXT_EXTENSIONS.has(normalizedPath.split(".").pop() ?? "");
}

export function filterWorkspaceEntries(entries: WorkspaceEntry[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return entries;
  }

  const visiblePaths = new Set<string>();

  for (const entry of entries) {
    const normalizedPath = entry.path.toLowerCase();
    const normalizedName = entry.name.toLowerCase();

    if (
      !normalizedPath.includes(normalizedQuery) &&
      !normalizedName.includes(normalizedQuery)
    ) {
      continue;
    }

    let currentPath = entry.path;

    while (currentPath) {
      visiblePaths.add(currentPath);
      const nextSlashIndex = currentPath.lastIndexOf("/");
      currentPath = nextSlashIndex >= 0 ? currentPath.slice(0, nextSlashIndex) : "";
    }
  }

  return entries.filter((entry) => visiblePaths.has(entry.path));
}

const OPENABLE_TEXT_EXTENSIONS = new Set([
  "css",
  "gitignore",
  "html",
  "js",
  "json",
  "jsx",
  "lock",
  "md",
  "rs",
  "toml",
  "ts",
  "tsx",
  "txt",
  "yaml",
  "yml"
]);
