import { create } from "zustand";

import type { EnvironmentStatus, ThemeMode, WorkspaceEntry } from "../types";

interface SettingsState {
  theme: ThemeMode;
  cursorApiKeyInput: string;
  lastProjectPath: string;
  environment: EnvironmentStatus;
  workspaceEntries: WorkspaceEntry[];
  setTheme: (theme: ThemeMode) => void;
  setCursorApiKeyInput: (value: string) => void;
  setLastProjectPath: (path: string) => void;
  setEnvironment: (environment: EnvironmentStatus) => void;
  setWorkspaceEntries: (entries: WorkspaceEntry[]) => void;
}

interface PersistedSettings {
  theme: ThemeMode;
  lastProjectPath: string;
}

const SETTINGS_STORAGE_KEY = "specforge.settings";

function createEnvironmentPlaceholder(): EnvironmentStatus {
  return {
    scannedAt: "",
    cursor: {
      name: "Cursor SDK",
      status: "missing",
      path: null,
      detail: "Save a Cursor API key to enable PRD and spec generation."
    },
    git: {
      name: "Git",
      status: "missing",
      path: null,
      detail: "Git diff support will appear once the desktop runtime scans the workspace."
    }
  };
}

function readPersistedSettings(): PersistedSettings {
  const defaults: PersistedSettings = {
    theme: "dracula",
    lastProjectPath: ""
  };

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const rawValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!rawValue) {
      return defaults;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedSettings>;

    return {
      theme: parsedValue.theme ?? defaults.theme,
      lastProjectPath: parsedValue.lastProjectPath ?? defaults.lastProjectPath
    };
  } catch {
    return defaults;
  }
}

function persistSettings(settings: PersistedSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

const persistedSettings = readPersistedSettings();

export const useSettingsStore = create<SettingsState>((set, get) => {
  function setAndPersist(patch: Partial<PersistedSettings>) {
    set(patch);
    const state = get();
    persistSettings({
      theme: state.theme,
      lastProjectPath: state.lastProjectPath
    });
  }

  return {
    theme: persistedSettings.theme,
    cursorApiKeyInput: "",
    lastProjectPath: persistedSettings.lastProjectPath,
    environment: createEnvironmentPlaceholder(),
    workspaceEntries: [],
    setTheme: (theme) => setAndPersist({ theme }),
    setCursorApiKeyInput: (cursorApiKeyInput) => set({ cursorApiKeyInput }),
    setLastProjectPath: (lastProjectPath) => setAndPersist({ lastProjectPath }),
    setEnvironment: (environment) => set({ environment }),
    setWorkspaceEntries: (workspaceEntries) => set({ workspaceEntries })
  };
});
