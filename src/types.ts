export type ModelId =
  | "gpt-5.4"
  | "gpt-5.4-mini"
  | "gpt-5.3-codex"
  | "gpt-5.2"
  | "claude-opus-4-1-20250805"
  | "claude-opus-4-20250514"
  | "claude-sonnet-4-20250514"
  | "claude-3-7-sonnet-20250219"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-sonnet-20240620"
  | "claude-3-5-haiku-20241022"
  | "claude-3-haiku-20240307";
export type ModelProvider = "claude" | "codex";
export type ReasoningProfileId = "low" | "medium" | "high" | "max";
export type AutonomyMode = "stepped" | "milestone" | "god_mode";
export type ThemeMode = "dracula" | "light" | "system";
export type WorkspaceBaseTab = "review" | "execute";
export type WorkspaceTab = WorkspaceBaseTab | `file:${string}`;
export type PaneMode = "preview" | "edit";
export type AgentStatus =
  | "idle"
  | "generating_spec"
  | "executing"
  | "awaiting_approval"
  | "halted"
  | "error"
  | "completed";
export type CliHealth = "found" | "missing" | "unauthorized";
export type AnnotationTone = "info" | "warning" | "success";

export interface SelectionRange {
  start: number;
  end: number;
  text: string;
}

export interface SpecAnnotation {
  id: string;
  tone: AnnotationTone;
  title: string;
  body: string;
}

export interface CliStatus {
  name: string;
  status: CliHealth;
  path: string | null;
  detail: string;
}

export interface EnvironmentStatus {
  scannedAt: string;
  claude: CliStatus;
  codex: CliStatus;
  git: CliStatus;
}

export interface WorkspaceEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
  depth: number;
}

export interface WorkspaceDocument {
  content: string;
  sourcePath: string;
  fileName: string;
}

export interface WorkspaceScanResult {
  rootName: string;
  entries: WorkspaceEntry[];
  ignoredFileCount: number;
  prdDocument: WorkspaceDocument | null;
  specDocument: WorkspaceDocument | null;
}

export interface EditorTab {
  id: `file:${string}`;
  title: string;
  path: string;
  content: string;
}

export interface AgentEventPayload {
  status: AgentStatus;
  currentMilestone: string | null;
  pendingDiff: string | null;
  summary: string | null;
}
