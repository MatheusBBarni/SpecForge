use crate::models::WorkspaceScanResult;
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Condvar, Mutex},
};

#[derive(Default)]
pub(crate) struct SharedState {
    pub(crate) runtime: Arc<ExecutionRuntime>,
    pub(crate) workspace: Mutex<Option<WorkspaceContext>>,
}

#[derive(Default)]
pub(crate) struct ExecutionRuntime {
    pub(crate) control: Mutex<ExecutionControl>,
    pub(crate) signal: Condvar,
}

#[derive(Default)]
pub(crate) struct ExecutionControl {
    pub(crate) run_id: u64,
    pub(crate) awaiting_approval: bool,
    pub(crate) stop_requested: bool,
}

pub(crate) struct WorkspaceContext {
    pub(crate) root: PathBuf,
    pub(crate) files: HashMap<String, PathBuf>,
}

pub(crate) struct ScannedWorkspace {
    pub(crate) result: WorkspaceScanResult,
    pub(crate) context: WorkspaceContext,
}
