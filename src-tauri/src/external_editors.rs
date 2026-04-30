use crate::{models::ExternalEditor, state::SharedState, workspace::resolve_workspace_file_path};
use std::{
    collections::HashSet,
    env,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::State;
use which::which;

struct EditorCandidate {
    id: &'static str,
    label: &'static str,
    commands: &'static [&'static str],
    known_paths: Vec<PathBuf>,
}

#[tauri::command]
pub(crate) fn list_external_editors() -> Vec<ExternalEditor> {
    let mut seen_paths = HashSet::<String>::new();
    editor_candidates()
        .into_iter()
        .filter_map(|candidate| {
            let executable_path = candidate.resolve_executable()?;
            let normalized_path = executable_path.to_string_lossy().to_lowercase();

            if !seen_paths.insert(normalized_path) {
                return None;
            }

            Some(ExternalEditor {
                id: candidate.id.to_string(),
                label: candidate.label.to_string(),
                executable_path: executable_path.display().to_string(),
            })
        })
        .collect()
}

#[tauri::command]
pub(crate) fn open_workspace_file_in_editor(
    state: State<SharedState>,
    file_path: String,
    editor_id: String,
) -> Result<(), String> {
    let resolved_file_path = resolve_workspace_file_path(&state, &file_path)?;
    let candidate = editor_candidates()
        .into_iter()
        .find(|candidate| candidate.id == editor_id)
        .ok_or_else(|| format!("Unknown editor: {editor_id}"))?;
    let executable_path = candidate
        .resolve_executable()
        .ok_or_else(|| format!("{} is not available on this machine.", candidate.label))?;

    spawn_editor(&executable_path, &resolved_file_path).map_err(|error| {
        format!(
            "Unable to open {} in {}: {error}",
            file_path, candidate.label
        )
    })
}

impl EditorCandidate {
    fn resolve_executable(&self) -> Option<PathBuf> {
        for known_path in &self.known_paths {
            if known_path.is_file() {
                return Some(known_path.clone());
            }
        }

        for command in self.commands {
            if let Ok(path) = which(command) {
                return Some(path);
            }
        }

        None
    }
}

fn spawn_editor(executable_path: &Path, file_path: &Path) -> std::io::Result<()> {
    let mut command = Command::new(executable_path);
    command.arg(file_path);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    command.spawn().map(|_| ())
}

fn editor_candidates() -> Vec<EditorCandidate> {
    vec![
        EditorCandidate {
            id: "vscode",
            label: "VS Code",
            commands: &["code", "code.cmd", "code.exe"],
            known_paths: paths_from_env(&[
                (
                    "LOCALAPPDATA",
                    &["Programs", "Microsoft VS Code", "bin", "code.cmd"],
                ),
                (
                    "LOCALAPPDATA",
                    &["Programs", "Microsoft VS Code", "Code.exe"],
                ),
                ("PROGRAMFILES", &["Microsoft VS Code", "bin", "code.cmd"]),
                ("PROGRAMFILES", &["Microsoft VS Code", "Code.exe"]),
            ]),
        },
        EditorCandidate {
            id: "visual-studio",
            label: "Visual Studio",
            commands: &["devenv", "devenv.exe"],
            known_paths: visual_studio_paths(),
        },
        EditorCandidate {
            id: "cursor",
            label: "Cursor",
            commands: &["cursor", "cursor.cmd", "cursor.exe"],
            known_paths: paths_from_env(&[
                (
                    "LOCALAPPDATA",
                    &[
                        "Programs",
                        "Cursor",
                        "resources",
                        "app",
                        "bin",
                        "cursor.cmd",
                    ],
                ),
                ("LOCALAPPDATA", &["Programs", "Cursor", "Cursor.exe"]),
                ("PROGRAMFILES", &["Cursor", "Cursor.exe"]),
            ]),
        },
        EditorCandidate {
            id: "zed",
            label: "Zed",
            commands: &["zed", "zed.exe"],
            known_paths: paths_from_env(&[
                ("LOCALAPPDATA", &["Programs", "Zed", "Zed.exe"]),
                ("PROGRAMFILES", &["Zed", "Zed.exe"]),
            ]),
        },
        EditorCandidate {
            id: "antigravity",
            label: "Antigravity",
            commands: &["antigravity", "antigravity.cmd", "antigravity.exe"],
            known_paths: paths_from_env(&[
                (
                    "LOCALAPPDATA",
                    &["Programs", "Antigravity", "Antigravity.exe"],
                ),
                ("PROGRAMFILES", &["Antigravity", "Antigravity.exe"]),
            ]),
        },
        EditorCandidate {
            id: "notepad-plus-plus",
            label: "Notepad++",
            commands: &["notepad++", "notepad++.exe"],
            known_paths: paths_from_env(&[
                ("PROGRAMFILES", &["Notepad++", "notepad++.exe"]),
                ("PROGRAMFILES(X86)", &["Notepad++", "notepad++.exe"]),
            ]),
        },
        EditorCandidate {
            id: "sublime-text",
            label: "Sublime Text",
            commands: &["subl", "sublime_text", "sublime_text.exe"],
            known_paths: paths_from_env(&[
                ("PROGRAMFILES", &["Sublime Text", "sublime_text.exe"]),
                ("PROGRAMFILES", &["Sublime Text 3", "sublime_text.exe"]),
            ]),
        },
        EditorCandidate {
            id: "notepad",
            label: "Notepad",
            commands: &["notepad", "notepad.exe"],
            known_paths: Vec::new(),
        },
    ]
}

fn paths_from_env(entries: &[(&str, &[&str])]) -> Vec<PathBuf> {
    entries
        .iter()
        .filter_map(|(env_key, segments)| path_from_env(env_key, segments))
        .collect()
}

fn path_from_env(env_key: &str, segments: &[&str]) -> Option<PathBuf> {
    let mut path = PathBuf::from(env::var_os(env_key)?);

    for segment in segments {
        path.push(segment);
    }

    Some(path)
}

fn visual_studio_paths() -> Vec<PathBuf> {
    let editions = ["Enterprise", "Professional", "Community", "BuildTools"];
    let mut paths = Vec::new();

    for edition in editions {
        if let Some(path) = path_from_env(
            "PROGRAMFILES",
            &[
                "Microsoft Visual Studio",
                "2022",
                edition,
                "Common7",
                "IDE",
                "devenv.exe",
            ],
        ) {
            paths.push(path);
        }
    }

    paths
}
