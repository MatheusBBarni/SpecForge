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
