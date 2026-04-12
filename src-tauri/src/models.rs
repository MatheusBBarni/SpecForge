use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CliStatus {
    pub(crate) name: String,
    pub(crate) status: String,
    pub(crate) path: Option<String>,
    pub(crate) detail: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct EnvironmentStatus {
    pub(crate) scanned_at: String,
    pub(crate) claude: CliStatus,
    pub(crate) codex: CliStatus,
    pub(crate) git: CliStatus,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) kind: String,
    pub(crate) depth: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceDocument {
    pub(crate) content: String,
    pub(crate) source_path: String,
    pub(crate) file_name: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectSettings {
    pub(crate) selected_model: String,
    pub(crate) selected_reasoning: String,
    pub(crate) prd_prompt: String,
    pub(crate) spec_prompt: String,
    pub(crate) prd_path: String,
    pub(crate) spec_path: String,
    pub(crate) supporting_document_paths: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectContextPayload {
    pub(crate) root_name: String,
    pub(crate) root_path: String,
    pub(crate) settings_path: String,
    pub(crate) has_saved_settings: bool,
    pub(crate) settings: ProjectSettings,
    pub(crate) entries: Vec<WorkspaceEntry>,
    pub(crate) ignored_file_count: usize,
    pub(crate) prd_document: Option<WorkspaceDocument>,
    pub(crate) spec_document: Option<WorkspaceDocument>,
    pub(crate) chat_sessions: Vec<ChatSessionSummary>,
    pub(crate) last_active_session_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceScanResult {
    pub(crate) root_name: String,
    pub(crate) entries: Vec<WorkspaceEntry>,
    pub(crate) ignored_file_count: usize,
    pub(crate) prd_document: Option<WorkspaceDocument>,
    pub(crate) spec_document: Option<WorkspaceDocument>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentStateEvent {
    pub(crate) status: String,
    pub(crate) current_milestone: Option<String>,
    pub(crate) pending_diff: Option<String>,
    pub(crate) summary: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatContextItem {
    pub(crate) id: String,
    pub(crate) kind: String,
    pub(crate) label: String,
    pub(crate) path: Option<String>,
    pub(crate) is_default: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatMessage {
    pub(crate) id: String,
    pub(crate) role: String,
    pub(crate) content: String,
    pub(crate) created_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatRuntimeState {
    pub(crate) status: String,
    pub(crate) terminal_output: Vec<String>,
    pub(crate) current_milestone: Option<String>,
    pub(crate) pending_diff: Option<String>,
    pub(crate) execution_summary: Option<String>,
    pub(crate) awaiting_approval: bool,
    pub(crate) last_error: Option<String>,
    pub(crate) is_busy: bool,
    pub(crate) pending_request: Option<String>,
}

impl Default for ChatRuntimeState {
    fn default() -> Self {
        Self {
            status: String::from("idle"),
            terminal_output: Vec::new(),
            current_milestone: None,
            pending_diff: None,
            execution_summary: None,
            awaiting_approval: false,
            last_error: None,
            is_busy: false,
            pending_request: None,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatSessionSummary {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) status: String,
    pub(crate) last_message_preview: String,
    pub(crate) selected_model: String,
    pub(crate) selected_reasoning: String,
    pub(crate) autonomy_mode: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatSessionSnapshot {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) status: String,
    pub(crate) last_message_preview: String,
    pub(crate) selected_model: String,
    pub(crate) selected_reasoning: String,
    pub(crate) autonomy_mode: String,
    pub(crate) context_items: Vec<ChatContextItem>,
    pub(crate) messages: Vec<ChatMessage>,
    pub(crate) runtime: ChatRuntimeState,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatSessionIndexPayload {
    pub(crate) sessions: Vec<ChatSessionSummary>,
    pub(crate) last_active_session_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CavemanStatusPayload {
    pub(crate) ready: bool,
    pub(crate) detail: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatEventPayload {
    pub(crate) session_id: String,
    pub(crate) event_type: String,
    pub(crate) message: Option<ChatMessage>,
    pub(crate) message_delta: Option<String>,
    pub(crate) terminal_line: Option<String>,
    pub(crate) session: Option<ChatSessionSnapshot>,
    pub(crate) runtime: Option<ChatRuntimeState>,
    pub(crate) summary: Option<ChatSessionSummary>,
}

#[derive(Clone)]
pub(crate) struct SimulatedStep {
    pub(crate) delay_ms: u64,
    pub(crate) line: String,
    pub(crate) milestone: &'static str,
    pub(crate) gate: bool,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum StopState {
    Continue,
    StopRequested,
    Replaced,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum ApprovalWaitOutcome {
    Approved,
    StopRequested,
    Replaced,
}
