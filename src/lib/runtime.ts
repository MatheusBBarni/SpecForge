import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AgentEventPayload,
  AutonomyMode,
  EnvironmentStatus,
  ModelId,
  ModelProvider,
  ReasoningProfileId,
  WorkspaceDocument,
  WorkspaceScanResult,
  WorkspaceEntry
} from "../types";

export const DEFAULT_PENDING_DIFF = `diff --git a/src/App.tsx b/src/App.tsx
index 0000000..forge42 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@
- Render placeholder starter card
+ Introduce PRD/spec review workspace with execution controls
+ Add Dracula-first theme tokens and persisted preferences
+ Surface CLI health, diff approvals, and terminal streaming`;

export const FALLBACK_WORKSPACE: WorkspaceEntry[] = [
  { name: ".githooks", path: ".githooks", kind: "directory", depth: 0 },
  { name: ".github", path: ".github", kind: "directory", depth: 0 },
  { name: "docs", path: "docs", kind: "directory", depth: 0 },
  { name: "src", path: "src", kind: "directory", depth: 0 },
  { name: "src-tauri", path: "src-tauri", kind: "directory", depth: 0 },
  { name: "AGENTS.md", path: "AGENTS.md", kind: "file", depth: 0 },
  { name: "CLAUDE.md", path: "CLAUDE.md", kind: "file", depth: 0 },
  { name: "HANDOFF.md", path: "HANDOFF.md", kind: "file", depth: 0 },
  { name: "package.json", path: "package.json", kind: "file", depth: 0 },
  { name: "tsconfig.json", path: "tsconfig.json", kind: "file", depth: 0 }
];

function fallbackStatus(name: string, detail: string) {
  return {
    name,
    status: "missing" as const,
    path: null,
    detail
  };
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

export async function runEnvironmentScan(paths?: {
  claudePath?: string;
  codexPath?: string;
}): Promise<EnvironmentStatus> {
  if (!isTauriRuntime()) {
    return {
      scannedAt: new Date().toISOString(),
      claude: fallbackStatus("Claude CLI", "Desktop runtime not detected. Start Tauri to scan local binaries."),
      codex: fallbackStatus("Codex CLI", "Desktop runtime not detected. Start Tauri to scan local binaries."),
      git: fallbackStatus("Git", "Desktop runtime not detected. Diff output falls back to the sample review.")
    };
  }

  return invoke<EnvironmentStatus>("run_environment_scan", {
    claudePath: emptyToNull(paths?.claudePath),
    codexPath: emptyToNull(paths?.codexPath)
  });
}

export async function parseDocument(filePath: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Path imports require the desktop runtime.");
  }

  return invoke<string>("parse_document", { filePath });
}

export async function pickDocument(): Promise<WorkspaceDocument | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<WorkspaceDocument | null>("pick_document");
}

export async function openWorkspaceFolder(): Promise<WorkspaceScanResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<WorkspaceScanResult | null>("open_workspace_folder");
}

export async function readWorkspaceFile(filePath: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Desktop runtime not detected.");
  }

  return invoke<string>("read_workspace_file", { filePath });
}

export async function getWorkspaceSnapshot(): Promise<WorkspaceEntry[]> {
  if (!isTauriRuntime()) {
    return FALLBACK_WORKSPACE;
  }

  try {
    return await invoke<WorkspaceEntry[]>("get_workspace_snapshot");
  } catch {
    return FALLBACK_WORKSPACE;
  }
}

export async function getGitDiff(): Promise<string> {
  if (!isTauriRuntime()) {
    return DEFAULT_PENDING_DIFF;
  }

  try {
    const diff = await invoke<string>("git_get_diff");
    return diff.trim() ? diff : DEFAULT_PENDING_DIFF;
  } catch {
    return DEFAULT_PENDING_DIFF;
  }
}

export async function startAgentRun(
  specPayload: string,
  mode: AutonomyMode,
  model: ModelId,
  reasoning: ReasoningProfileId
): Promise<void> {
  await invoke("spawn_cli_agent", { specPayload, mode, model, reasoning });
}

export async function generateSpecDocument(payload: {
  prdPath: string;
  prdContent: string;
  userPrompt: string;
  provider: ModelProvider;
  model: ModelId;
  reasoning: ReasoningProfileId;
  claudePath?: string;
  codexPath?: string;
}): Promise<WorkspaceDocument> {
  if (!isTauriRuntime()) {
    throw new Error("AI spec generation requires the desktop runtime.");
  }

  return invoke<WorkspaceDocument>("generate_spec_document", {
    prdPath: payload.prdPath,
    prdContent: payload.prdContent,
    userPrompt: payload.userPrompt,
    provider: payload.provider,
    model: payload.model,
    reasoning: payload.reasoning,
    claudePath: emptyToNull(payload.claudePath),
    codexPath: emptyToNull(payload.codexPath)
  });
}

export async function approveAgentAction(): Promise<void> {
  await invoke("approve_action");
}

export async function emergencyStop(): Promise<void> {
  await invoke("kill_agent_process");
}

export async function subscribeToAgentEvents(handlers: {
  onLine: (line: string) => void;
  onState: (payload: AgentEventPayload) => void;
}): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  const [unlistenOutput, unlistenState] = await Promise.all([
    listen<string>("cli-output", (event) => handlers.onLine(event.payload)),
    listen<AgentEventPayload>("agent-state", (event) => handlers.onState(event.payload))
  ]);

  return () => {
    callUnlisten(unlistenOutput);
    callUnlisten(unlistenState);
  };
}

function callUnlisten(unlisten: UnlistenFn) {
  unlisten();
}

function emptyToNull(value?: string) {
  const nextValue = value?.trim();
  return nextValue ? nextValue : null;
}
