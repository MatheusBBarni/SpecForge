import { create } from "zustand";

import type { WorkspaceFileSource } from "../lib/appShell";
import { DEFAULT_PENDING_DIFF } from "../lib/runtime";
import type { CursorModel, ExternalEditor } from "../types";

const DEFAULT_WORKSPACE_NOTICE = "Finish the setup flow to load a project workspace.";

interface ProjectShellPatch {
  rootName?: string;
  rootPath?: string;
  configPath?: string;
  hasSelectedProject?: boolean;
  hasSavedProjectSettings?: boolean;
}

interface WorkspaceUiState {
  commandSearch: string;
  isImporting: boolean;
  isSearchOpen: boolean;
  isProjectLoading: boolean;
  isProjectSaving: boolean;
  latestDiff: string;
  projectConfigPath: string;
  projectErrorMessage: string;
  projectRootName: string;
  projectRootPath: string;
  projectStatusMessage: string;
  workspaceNotice: string;
  externalEditors: ExternalEditor[];
  cursorModels: CursorModel[];
  hasSavedProjectSettings: boolean;
  hasSelectedProject: boolean;
  hasAttemptedProjectRestore: boolean;
  workspaceFiles: Record<string, WorkspaceFileSource>;
  prdGenerationPrompt: string;
  prdGenerationError: string;
  specGenerationPrompt: string;
  specGenerationError: string;
  setCommandSearch: (commandSearch: string) => void;
  setIsImporting: (isImporting: boolean) => void;
  setIsSearchOpen: (isSearchOpen: boolean) => void;
  setIsProjectLoading: (isProjectLoading: boolean) => void;
  setIsProjectSaving: (isProjectSaving: boolean) => void;
  setLatestDiff: (latestDiff: string) => void;
  resetLatestDiff: () => void;
  setProjectConfigPath: (projectConfigPath: string) => void;
  setProjectErrorMessage: (projectErrorMessage: string) => void;
  setProjectRootName: (projectRootName: string) => void;
  setProjectRootPath: (projectRootPath: string) => void;
  setProjectStatusMessage: (projectStatusMessage: string) => void;
  setWorkspaceNotice: (workspaceNotice: string) => void;
  setExternalEditors: (externalEditors: ExternalEditor[]) => void;
  setCursorModels: (cursorModels: CursorModel[]) => void;
  setHasSavedProjectSettings: (hasSavedProjectSettings: boolean) => void;
  setHasSelectedProject: (hasSelectedProject: boolean) => void;
  setHasAttemptedProjectRestore: (hasAttemptedProjectRestore: boolean) => void;
  setWorkspaceFiles: (workspaceFiles: Record<string, WorkspaceFileSource>) => void;
  setPrdGenerationPrompt: (prdGenerationPrompt: string) => void;
  setPrdGenerationError: (prdGenerationError: string) => void;
  setSpecGenerationPrompt: (specGenerationPrompt: string) => void;
  setSpecGenerationError: (specGenerationError: string) => void;
  clearGenerationState: () => void;
  setProjectShell: (patch: ProjectShellPatch) => void;
  resetWorkspaceUi: () => void;
}

export const useWorkspaceUiStore = create<WorkspaceUiState>((set) => ({
  ...buildInitialWorkspaceUiState(),
  setCommandSearch: (commandSearch) => set({ commandSearch }),
  setIsImporting: (isImporting) => set({ isImporting }),
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  setIsProjectLoading: (isProjectLoading) => set({ isProjectLoading }),
  setIsProjectSaving: (isProjectSaving) => set({ isProjectSaving }),
  setLatestDiff: (latestDiff) => set({ latestDiff }),
  resetLatestDiff: () => set({ latestDiff: DEFAULT_PENDING_DIFF }),
  setProjectConfigPath: (projectConfigPath) => set({ projectConfigPath }),
  setProjectErrorMessage: (projectErrorMessage) => set({ projectErrorMessage }),
  setProjectRootName: (projectRootName) => set({ projectRootName }),
  setProjectRootPath: (projectRootPath) => set({ projectRootPath }),
  setProjectStatusMessage: (projectStatusMessage) => set({ projectStatusMessage }),
  setWorkspaceNotice: (workspaceNotice) => set({ workspaceNotice }),
  setExternalEditors: (externalEditors) => set({ externalEditors }),
  setCursorModels: (cursorModels) => set({ cursorModels }),
  setHasSavedProjectSettings: (hasSavedProjectSettings) => set({ hasSavedProjectSettings }),
  setHasSelectedProject: (hasSelectedProject) => set({ hasSelectedProject }),
  setHasAttemptedProjectRestore: (hasAttemptedProjectRestore) =>
    set({ hasAttemptedProjectRestore }),
  setWorkspaceFiles: (workspaceFiles) => set({ workspaceFiles }),
  setPrdGenerationPrompt: (prdGenerationPrompt) => set({ prdGenerationPrompt }),
  setPrdGenerationError: (prdGenerationError) => set({ prdGenerationError }),
  setSpecGenerationPrompt: (specGenerationPrompt) => set({ specGenerationPrompt }),
  setSpecGenerationError: (specGenerationError) => set({ specGenerationError }),
  clearGenerationState: () =>
    set({
      prdGenerationPrompt: "",
      prdGenerationError: "",
      specGenerationPrompt: "",
      specGenerationError: ""
    }),
  setProjectShell: (patch) =>
    set((state) => ({
      projectRootName: patch.rootName ?? state.projectRootName,
      projectRootPath: patch.rootPath ?? state.projectRootPath,
      projectConfigPath: patch.configPath ?? state.projectConfigPath,
      hasSelectedProject: patch.hasSelectedProject ?? state.hasSelectedProject,
      hasSavedProjectSettings:
        patch.hasSavedProjectSettings ?? state.hasSavedProjectSettings
    })),
  resetWorkspaceUi: () => set(buildInitialWorkspaceUiState())
}));

function buildInitialWorkspaceUiState() {
  return {
    commandSearch: "",
    isImporting: false,
    isSearchOpen: false,
    isProjectLoading: false,
    isProjectSaving: false,
    latestDiff: DEFAULT_PENDING_DIFF,
    projectConfigPath: "",
    projectErrorMessage: "",
    projectRootName: "No project selected",
    projectRootPath: "",
    projectStatusMessage: "",
    workspaceNotice: DEFAULT_WORKSPACE_NOTICE,
    externalEditors: [],
    cursorModels: [],
    hasSavedProjectSettings: false,
    hasSelectedProject: false,
    hasAttemptedProjectRestore: false,
    workspaceFiles: {},
    prdGenerationPrompt: "",
    prdGenerationError: "",
    specGenerationPrompt: "",
    specGenerationError: ""
  };
}
