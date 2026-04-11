import { create } from "zustand";

import type { EnvironmentStatus, ThemeMode, WorkspaceEntry } from "../types";

interface SettingsState {
  theme: ThemeMode;
  claudePath: string;
  codexPath: string;
  lastProjectPath: string;
  environment: EnvironmentStatus;
  workspaceEntries: WorkspaceEntry[];
  setTheme: (theme: ThemeMode) => void;
  setClaudePath: (path: string) => void;
  setCodexPath: (path: string) => void;
  setLastProjectPath: (path: string) => void;
  setEnvironment: (environment: EnvironmentStatus) => void;
  setWorkspaceEntries: (entries: WorkspaceEntry[]) => void;
}

interface PersistedSettings {
  theme: ThemeMode;
  claudePath: string;
  codexPath: string;
  lastProjectPath: string;
}

const SETTINGS_STORAGE_KEY = "specforge.settings";

function createEnvironmentPlaceholder(): EnvironmentStatus {
  return {
    scannedAt: "",
    claude: {
      name: "Claude CLI",
      status: "missing",
      path: null,
      detail: "Run an environment scan to resolve CLI availability."
    },
    codex: {
      name: "Codex CLI",
      status: "missing",
      path: null,
      detail: "Run an environment scan to resolve CLI availability."
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
  if (typeof window === "undefined") {
    return {
      theme: "dracula",
      claudePath: "",
      codexPath: "",
      lastProjectPath: ""
    };
  }

  try {
    const rawValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!rawValue) {
      return {
        theme: "dracula",
        claudePath: "",
        codexPath: "",
        lastProjectPath: ""
      };
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedSettings>;

    return {
      theme: parsedValue.theme ?? "dracula",
      claudePath: parsedValue.claudePath ?? "",
      codexPath: parsedValue.codexPath ?? "",
      lastProjectPath: parsedValue.lastProjectPath ?? ""
    };
  } catch {
    return {
      theme: "dracula",
      claudePath: "",
      codexPath: "",
      lastProjectPath: ""
    };
  }
}

function persistSettings(settings: PersistedSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

const persistedSettings = readPersistedSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: persistedSettings.theme,
  claudePath: persistedSettings.claudePath,
  codexPath: persistedSettings.codexPath,
  lastProjectPath: persistedSettings.lastProjectPath,
  environment: createEnvironmentPlaceholder(),
  workspaceEntries: [],
  setTheme: (theme) => {
    set({ theme });
    persistSettings({
      theme,
      claudePath: get().claudePath,
      codexPath: get().codexPath,
      lastProjectPath: get().lastProjectPath
    });
  },
  setClaudePath: (claudePath) => {
    set({ claudePath });
    persistSettings({
      theme: get().theme,
      claudePath,
      codexPath: get().codexPath,
      lastProjectPath: get().lastProjectPath
    });
  },
  setCodexPath: (codexPath) => {
    set({ codexPath });
    persistSettings({
      theme: get().theme,
      claudePath: get().claudePath,
      codexPath,
      lastProjectPath: get().lastProjectPath
    });
  },
  setLastProjectPath: (lastProjectPath) => {
    set({ lastProjectPath });
    persistSettings({
      theme: get().theme,
      claudePath: get().claudePath,
      codexPath: get().codexPath,
      lastProjectPath
    });
  },
  setEnvironment: (environment) => set({ environment }),
  setWorkspaceEntries: (workspaceEntries) => set({ workspaceEntries })
}));
