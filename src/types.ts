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
  | "generating_prd"
  | "generating_spec"
  | "executing"
  | "awaiting_approval"
  | "halted"
  | "error"
  | "completed";
export type CliHealth = "found" | "missing" | "unauthorized";
export type AnnotationTone = "info" | "warning" | "success";
export type ChatContextKind =
  | "prd"
  | "spec"
  | "supporting_document"
  | "workspace_summary"
  | "file";
export type ChatMessageRole = "user" | "assistant";
export type ChatEventType =
  | "messageStarted"
  | "messageDelta"
  | "terminalLine"
  | "approvalRequired"
  | "completed"
  | "halted"
  | "error"
  | "sessionUpdated";

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

export interface ProjectSettings {
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  prdPrompt: string;
  specPrompt: string;
  prdPath: string;
  specPath: string;
  supportingDocumentPaths: string[];
}

export interface ProjectContext {
  rootName: string;
  rootPath: string;
  settingsPath: string;
  hasSavedSettings: boolean;
  settings: ProjectSettings;
  entries: WorkspaceEntry[];
  ignoredFileCount: number;
  prdDocument: WorkspaceDocument | null;
  specDocument: WorkspaceDocument | null;
  chatSessions: ChatSessionSummary[];
  lastActiveSessionId: string | null;
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

export interface ChatContextItem {
  id: string;
  kind: ChatContextKind;
  label: string;
  path: string | null;
  isDefault: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
}

export interface ChatRuntimeState {
  status: AgentStatus;
  terminalOutput: string[];
  currentMilestone: string | null;
  pendingDiff: string | null;
  executionSummary: string | null;
  awaitingApproval: boolean;
  lastError: string | null;
  isBusy: boolean;
  pendingRequest: string | null;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: AgentStatus;
  lastMessagePreview: string;
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  autonomyMode: AutonomyMode;
}

export interface ChatSession extends ChatSessionSummary {
  contextItems: ChatContextItem[];
  messages: ChatMessage[];
  runtime: ChatRuntimeState;
}

export interface ChatSessionIndex {
  sessions: ChatSessionSummary[];
  lastActiveSessionId: string | null;
}

export interface ChatEventPayload {
  sessionId: string;
  eventType: ChatEventType;
  message: ChatMessage | null;
  messageDelta: string | null;
  terminalLine: string | null;
  session: ChatSession | null;
  runtime: ChatRuntimeState | null;
  summary: ChatSessionSummary | null;
}

export interface CavemanStatus {
  ready: boolean;
  detail: string;
}
