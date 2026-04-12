mod agent;
mod chat;
mod constants;
mod documents;
mod environment;
mod generation;
mod git;
mod models;
mod paths;
mod project;
mod state;
mod workspace;

use agent::{approve_action, kill_agent_process, spawn_cli_agent};
use chat::{
    approve_chat_session, create_chat_session, delete_chat_session, ensure_caveman_skill,
    load_chat_session, rename_chat_session, save_chat_session, send_chat_message,
    stop_chat_session,
};
use documents::{parse_document, pick_document};
use environment::run_environment_scan;
use generation::{generate_prd_document, generate_spec_document};
use git::git_get_diff;
use project::{load_project_context, pick_project_folder, save_project_settings};
use state::SharedState;
use workspace::{get_workspace_snapshot, open_workspace_folder, read_workspace_file};

pub fn run() {
    tauri::Builder::default()
        .manage(SharedState::default())
        .invoke_handler(tauri::generate_handler![
            run_environment_scan,
            parse_document,
            pick_document,
            pick_project_folder,
            load_project_context,
            save_project_settings,
            open_workspace_folder,
            read_workspace_file,
            get_workspace_snapshot,
            git_get_diff,
            generate_prd_document,
            generate_spec_document,
            spawn_cli_agent,
            approve_action,
            kill_agent_process,
            create_chat_session,
            load_chat_session,
            save_chat_session,
            rename_chat_session,
            delete_chat_session,
            send_chat_message,
            approve_chat_session,
            stop_chat_session,
            ensure_caveman_skill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
