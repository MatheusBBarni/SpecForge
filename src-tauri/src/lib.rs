mod agent;
mod chat;
mod constants;
mod cursor_agent;
mod documents;
mod environment;
mod generation;
mod git;
mod models;
mod paths;
mod project;
mod secrets;
mod state;
mod workspace;

use agent::{approve_action, kill_agent_process, spawn_cli_agent};
use chat::{
    approve_chat_session, create_chat_session, delete_chat_session, load_chat_session,
    rename_chat_session, save_chat_session, send_chat_message, stop_chat_session,
};
use cursor_agent::run_cursor_agent_prompt;
use documents::{parse_document, pick_document, save_workspace_document};
use environment::run_environment_scan;
use git::git_get_diff;
use project::{load_project_context, pick_project_folder, save_project_settings};
use secrets::{delete_cursor_api_key, get_cursor_api_key, save_cursor_api_key};
use state::SharedState;
use workspace::{get_workspace_snapshot, open_workspace_folder, read_workspace_file};

pub fn run() {
    tauri::Builder::default()
        .manage(SharedState::default())
        .invoke_handler(tauri::generate_handler![
            run_environment_scan,
            run_cursor_agent_prompt,
            get_cursor_api_key,
            save_cursor_api_key,
            delete_cursor_api_key,
            parse_document,
            pick_document,
            save_workspace_document,
            pick_project_folder,
            load_project_context,
            save_project_settings,
            open_workspace_folder,
            read_workspace_file,
            get_workspace_snapshot,
            git_get_diff,
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
            stop_chat_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
