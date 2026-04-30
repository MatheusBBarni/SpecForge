use crate::models::CliStatus;
use keyring_core::{Entry, Error as KeyringError};

const CURSOR_KEY_SERVICE: &str = "SpecForge";
const CURSOR_KEY_USER: &str = "cursor-api-key";

#[tauri::command]
pub(crate) fn save_cursor_api_key(api_key: String) -> Result<(), String> {
    let trimmed_key = api_key.trim();

    if trimmed_key.is_empty() {
        return Err(String::from("Enter a Cursor API key before saving."));
    }

    cursor_key_entry()?
        .set_password(trimmed_key)
        .map_err(|error| format!("Unable to save the Cursor API key: {error}"))
}

#[tauri::command]
pub(crate) fn delete_cursor_api_key() -> Result<(), String> {
    match cursor_key_entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("Unable to delete the Cursor API key: {error}")),
    }
}

pub(crate) fn cursor_key_status() -> CliStatus {
    match read_cursor_api_key() {
        Ok(Some(_)) => CliStatus {
            name: String::from("Cursor SDK"),
            status: String::from("found"),
            path: None,
            detail: String::from("Cursor API key is stored in the OS credential store."),
        },
        Ok(None) => CliStatus {
            name: String::from("Cursor SDK"),
            status: String::from("missing"),
            path: None,
            detail: String::from("No Cursor API key is saved yet."),
        },
        Err(error) => CliStatus {
            name: String::from("Cursor SDK"),
            status: String::from("unauthorized"),
            path: None,
            detail: error,
        },
    }
}

pub(crate) fn read_cursor_api_key() -> Result<Option<String>, String> {
    match cursor_key_entry()?.get_password() {
        Ok(value) if value.trim().is_empty() => Ok(None),
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("Unable to read the Cursor API key: {error}")),
    }
}

fn cursor_key_entry() -> Result<Entry, String> {
    keyring::use_native_store(false)
        .map_err(|error| format!("Unable to open the OS credential store: {error}"))?;
    Entry::new(CURSOR_KEY_SERVICE, CURSOR_KEY_USER)
        .map_err(|error| format!("Unable to open the OS credential store: {error}"))
}
