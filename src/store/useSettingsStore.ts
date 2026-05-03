import { create } from "zustand";

import type { EnvironmentStatus, ThemeMode, WorkspaceEntry } from "../types";

export interface RecentProject {
  name: string;
  path: string;
  lastOpenedAt: string;
}

interface SettingsState {
  theme: ThemeMode;
  cursorApiKeyInput: string;
  lastProjectPath: string;
  recentProjects: RecentProject[];
  environment: EnvironmentStatus;
  workspaceEntries: WorkspaceEntry[];
  setTheme: (theme: ThemeMode) => void;
  setCursorApiKeyInput: (value: string) => void;
  setLastProjectPath: (path: string) => void;
  rememberRecentProject: (project: Omit<RecentProject, "lastOpenedAt">) => void;
  setEnvironment: (environment: EnvironmentStatus) => void;
  setWorkspaceEntries: (entries: WorkspaceEntry[]) => void;
}

interface PersistedSettings {
  theme: ThemeMode;
  lastProjectPath: string;
  recentProjects: RecentProject[];
}

const SETTINGS_STORAGE_KEY = "specforge.settings";

function createEnvironmentPlaceholder(): EnvironmentStatus {
  return {
    scannedAt: "",
    cursor: {
      name: "Codex Provider",
      status: "missing",
      path: null,
      detail: "Configure Codex authentication to enable Sandcastle turns."
    },
    codex: {
      name: "Codex CLI",
      status: "missing",
      path: null,
      detail: "Install Codex CLI to discover models and prepare runtime turns."
    },
    docker: {
      name: "Docker",
      status: "missing",
      path: null,
      detail: "Install Docker and start the daemon to enable the runtime sandbox."
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
    lastProjectPath: "",
    recentProjects: []
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
      lastProjectPath: parsedValue.lastProjectPath ?? defaults.lastProjectPath,
      recentProjects: normalizeRecentProjects(parsedValue.recentProjects)
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
      lastProjectPath: state.lastProjectPath,
      recentProjects: state.recentProjects
    });
  }

  return {
    theme: persistedSettings.theme,
    cursorApiKeyInput: "",
    lastProjectPath: persistedSettings.lastProjectPath,
    recentProjects: persistedSettings.recentProjects,
    environment: createEnvironmentPlaceholder(),
    workspaceEntries: [],
    setTheme: (theme) => setAndPersist({ theme }),
    setCursorApiKeyInput: (cursorApiKeyInput) => set({ cursorApiKeyInput }),
    setLastProjectPath: (lastProjectPath) => setAndPersist({ lastProjectPath }),
    rememberRecentProject: (project) => {
      const normalizedPath = normalizeStoredProjectPath(project.path.trim());

      if (!normalizedPath) {
        return;
      }

      const recentProject: RecentProject = {
        name: project.name.trim() || normalizedPath,
        path: normalizedPath,
        lastOpenedAt: new Date().toISOString()
      };
      const normalizedLookup = normalizePathForComparison(normalizedPath);
      const recentProjects = [
        recentProject,
        ...get().recentProjects.filter(
          (entry) => normalizePathForComparison(entry.path) !== normalizedLookup
        )
      ].slice(0, 8);

      setAndPersist({
        lastProjectPath: normalizedPath,
        recentProjects
      });
    },
    setEnvironment: (environment) => set({ environment }),
    setWorkspaceEntries: (workspaceEntries) => set({ workspaceEntries })
  };
});

function normalizeRecentProjects(value: unknown): RecentProject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const projects: RecentProject[] = [];
  const seenPaths = new Set<string>();

  for (const entry of value) {
    const candidate = parseRecentProject(entry);

    if (!candidate) {
      continue;
    }

    const normalizedPath = normalizePathForComparison(candidate.path);

    if (seenPaths.has(normalizedPath)) {
      continue;
    }

    seenPaths.add(normalizedPath);
    projects.push({
      ...candidate
    });

    if (projects.length >= 8) {
      break;
    }
  }

  return projects;
}

function parseRecentProject(value: unknown): RecentProject | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<RecentProject>;
  const path = typeof candidate.path === "string"
    ? normalizeStoredProjectPath(candidate.path.trim())
    : "";

  if (!path) {
    return null;
  }

  return {
    name: typeof candidate.name === "string" && candidate.name.trim()
      ? candidate.name.trim()
      : path,
    path,
    lastOpenedAt: typeof candidate.lastOpenedAt === "string"
      ? candidate.lastOpenedAt
      : ""
  };
}

function normalizePathForComparison(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function normalizeStoredProjectPath(path: string) {
  return path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\/i, "");
}
