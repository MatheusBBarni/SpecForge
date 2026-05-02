use crate::models::CliStatus;
use keyring_core::{Entry, Error as KeyringError};
use std::path::PathBuf;

const CODEX_KEY_SERVICE: &str = "SpecForge";
const CODEX_KEY_USER: &str = "codex-api-key";

#[tauri::command]
pub(crate) fn save_cursor_api_key(api_key: String) -> Result<(), String> {
    let trimmed_key = api_key.trim();

    if trimmed_key.is_empty() {
        return Err(String::from("Enter a Codex API key before saving."));
    }

    codex_key_entry()?
        .set_password(trimmed_key)
        .map_err(|error| format!("Unable to save the Codex API key: {error}"))
}

#[tauri::command]
pub(crate) fn delete_cursor_api_key() -> Result<(), String> {
    match codex_key_entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("Unable to delete the Cursor API key: {error}")),
    }
}

pub(crate) fn cursor_key_status() -> CliStatus {
    if local_codex_auth_dir().is_some_and(|path| path.exists()) {
        return CliStatus {
            name: String::from("Codex Provider"),
            status: String::from("found"),
            path: None,
            detail: String::from("Local Codex subscription authentication was detected."),
        };
    }

    match read_cursor_api_key() {
        Ok(Some(_)) => CliStatus {
            name: String::from("Codex Provider"),
            status: String::from("found"),
            path: None,
            detail: String::from("Codex API key is stored in the OS credential store."),
        },
        Ok(None) => CliStatus {
            name: String::from("Codex Provider"),
            status: String::from("missing"),
            path: None,
            detail: String::from("No local Codex subscription auth or Codex API key is available."),
        },
        Err(error) => CliStatus {
            name: String::from("Codex Provider"),
            status: String::from("unauthorized"),
            path: None,
            detail: error,
        },
    }
}

pub(crate) fn read_cursor_api_key() -> Result<Option<String>, String> {
    match codex_key_entry()?.get_password() {
        Ok(value) if value.trim().is_empty() => Ok(None),
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("Unable to read the Codex API key: {error}")),
    }
}

fn codex_key_entry() -> Result<Entry, String> {
    keyring::use_native_store(false)
        .map_err(|error| format!("Unable to open the OS credential store: {error}"))?;
    Entry::new(CODEX_KEY_SERVICE, CODEX_KEY_USER)
        .map_err(|error| format!("Unable to open the OS credential store: {error}"))
}

fn local_codex_auth_dir() -> Option<PathBuf> {
    std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".codex")))
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".codex")))
}
