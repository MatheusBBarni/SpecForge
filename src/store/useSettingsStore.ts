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

export const useSettingsStore = create<SettingsState>((set, get) => {
  function setAndPersist(patch: Partial<PersistedSettings>) {
    set(patch);
    const state = get();
    persistSettings({
      theme: state.theme,
      claudePath: state.claudePath,
      codexPath: state.codexPath,
      lastProjectPath: state.lastProjectPath
    });
  }

  return {
    theme: persistedSettings.theme,
    claudePath: persistedSettings.claudePath,
    codexPath: persistedSettings.codexPath,
    lastProjectPath: persistedSettings.lastProjectPath,
    environment: createEnvironmentPlaceholder(),
    workspaceEntries: [],
    setTheme: (theme) => setAndPersist({ theme }),
    setClaudePath: (claudePath) => setAndPersist({ claudePath }),
    setCodexPath: (codexPath) => setAndPersist({ codexPath }),
    setLastProjectPath: (lastProjectPath) => setAndPersist({ lastProjectPath }),
    setEnvironment: (environment) => set({ environment }),
    setWorkspaceEntries: (workspaceEntries) => set({ workspaceEntries })
  };
});
