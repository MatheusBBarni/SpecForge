import {
  type MutableRefObject, 
  startTransition,
  useCallback,
  useRef
} from "react";
import { useNavigate } from "react-router-dom";
import type { WorkspaceFileSource } from "../lib/appShell";
import {
  buildConfigPathDisplay,
  buildCurrentProjectSettings,
  buildWorkspaceNotice
} from "../lib/appState";
import {
  loadProjectContext,
  pickProjectFolder,
  saveProjectSettings
} from "../lib/runtime";
import { useProjectStore } from "../store/useProjectStore";
import { normalizeStoredProjectPath } from "../store/useSettingsStore";
import type { ChatSessionSummary, ProjectContext } from "../types";
import type {
  ProjectStoreSlice,
  SettingsStoreSlice,
  WorkspaceUiStoreSlice
} from "./useAppStoreSlices";
import type { AppDerivedState } from "./useAppView";

interface UseProjectHandlersOptions {
  applyProjectContextDeps: {
    projectState: ProjectStoreSlice;
    settingsState: SettingsStoreSlice;
    workspaceUiState: WorkspaceUiStoreSlice;
    setChatSessions: (sessions: ChatSessionSummary[]) => void;
    setActiveSessionId: (id: string | null) => void;
    setCavemanStatus: (status: { ready: boolean; message: string }) => void;
    latestPathnameRef: MutableRefObject<string>;
  };
  derivedState: AppDerivedState;
  desktopRuntime: boolean;
  projectState: ProjectStoreSlice;
  workspaceUiState: WorkspaceUiStoreSlice;
}

export function useProjectHandlers({
  applyProjectContextDeps,
  derivedState,
  desktopRuntime,
  projectState,
  workspaceUiState
}: UseProjectHandlersOptions) {
  const navigate = useNavigate();
  const pendingProjectReloadRef = useRef(false);
  const projectSaveTimerRef = useRef<number | null>(null);

  const ensureProjectSettings = useCallback(async (context: ProjectContext) => {
    if (context.hasSavedSettings) {
      return { context, createdDefaults: false };
    }

    await saveProjectSettings({
      folderPath: context.rootPath,
      settings: context.settings
    });

    return {
      context: await loadProjectContext(context.rootPath),
      createdDefaults: true
    };
  }, []);

  const applyProjectContext = useCallback(
    (context: ProjectContext, options?: { navigateToChat?: boolean }) => {
      const {
        projectState: ps,
        settingsState: ss,
        workspaceUiState: uiState,
        setChatSessions,
        setActiveSessionId,
        setCavemanStatus,
        latestPathnameRef
      } = applyProjectContextDeps;

      const normalizedCurrentProjectPath = uiState.projectRootPath
        .replace(/\\/g, "/")
        .replace(/\/+$/, "")
        .toLowerCase();
      const normalizedNextProjectPath = context.rootPath
        .replace(/\\/g, "/")
        .replace(/\/+$/, "")
        .toLowerCase();
      const isSameProject =
        normalizedCurrentProjectPath.length > 0 &&
        normalizedCurrentProjectPath === normalizedNextProjectPath;
      const nextPrdSourcePath =
        context.prdDocument?.sourcePath ?? context.settings.prdPath;
      const nextSpecSourcePath =
        context.specDocument?.sourcePath ?? context.settings.specPath;
      const preserveEditingPrd =
        isSameProject &&
        ps.prdPaneMode === "edit" &&
        ps.prdPath === nextPrdSourcePath;
      const preserveEditingSpec =
        isSameProject &&
        ps.specPaneMode === "edit" &&
        ps.specPath === nextSpecSourcePath;
      const settingsPathDisplay = buildConfigPathDisplay(
        context.settingsPath,
        context.rootName
      );
      const nextWorkspaceFiles = Object.fromEntries(
        context.entries
          .filter((entry) => entry.kind === "file")
          .map((entry) => [
            entry.path,
            {
              kind: "desktop",
              fileName: entry.name
            } satisfies WorkspaceFileSource
          ])
      );

      if (!isSameProject) {
        ps.resetWorkspaceContext();
      }
      uiState.setProjectShell({
        rootName: context.rootName,
        rootPath: context.rootPath,
        configPath: context.settingsPath,
        hasSelectedProject: true,
        hasSavedProjectSettings: context.hasSavedSettings
      });
      ss.setWorkspaceEntries(context.entries);
      uiState.setWorkspaceFiles(nextWorkspaceFiles);
      ss.setLastProjectPath(context.rootPath);
      ss.rememberRecentProject({
        name: context.rootName,
        path: context.rootPath
      });
      ps.setProjectSettings(context.settings);
      uiState.clearGenerationState();
      setChatSessions(context.chatSessions);
      setActiveSessionId(context.lastActiveSessionId ?? context.chatSessions[0]?.id ?? null);
      setCavemanStatus({
        ready: true,
        message: "Caveman mode is built into every topic."
      });
      uiState.setProjectStatusMessage(
        context.hasSavedSettings
          ? `Loaded project settings from ${context.rootName}/${settingsPathDisplay}.`
          : `Selected ${context.rootName}. Save the setup to create ${context.rootName}/${settingsPathDisplay}.`
      );
      uiState.setProjectErrorMessage("");
      uiState.setWorkspaceNotice(buildWorkspaceNotice(context));

      startTransition(() => {
        if (!preserveEditingPrd) {
          ps.setPrdContent(
            context.prdDocument?.content ?? "",
            nextPrdSourcePath
          );
          ps.setPrdPaneMode("preview");
        }

        if (!preserveEditingSpec) {
          ps.setSpecContent(
            context.specDocument?.content ?? "",
            nextSpecSourcePath
          );
          ps.setSpecPaneMode("preview");
        }
      });

      if (options?.navigateToChat && latestPathnameRef.current === "/") {
        navigate("/review");
      }
    },
    [applyProjectContextDeps, navigate]
  );

  const saveCurrentProjectSettings = useCallback(
    async ({
      reloadProject = false,
      navigateToChat = false
    }: {
      reloadProject?: boolean;
      navigateToChat?: boolean;
    } = {}) => {
      if (!desktopRuntime) {
        workspaceUiState.setProjectErrorMessage("Project configuration requires the desktop runtime.");
        return;
      }

      if (!workspaceUiState.projectRootPath.trim()) {
        workspaceUiState.setProjectErrorMessage("Choose a project folder before saving.");
        return;
      }

      workspaceUiState.setProjectErrorMessage("");
      workspaceUiState.setProjectStatusMessage("");
      workspaceUiState.setIsProjectSaving(true);

      try {
        const latestProjectState = useProjectStore.getState();
        const currentProjectSettings = buildCurrentProjectSettings({
          configuredPrdPath: latestProjectState.configuredPrdPath,
          configuredSpecPath: latestProjectState.configuredSpecPath,
          prdAgentDescription: latestProjectState.prdPromptTemplate,
          selectedModel: latestProjectState.selectedModel,
          selectedReasoning: latestProjectState.selectedReasoning,
          specAgentDescription: latestProjectState.specPromptTemplate,
          executionAgentDescription: latestProjectState.executionAgentDescription,
          supportingDocumentPaths: latestProjectState.supportingDocumentPaths
        });
        const savedSettings = await saveProjectSettings({
          folderPath: workspaceUiState.projectRootPath,
          settings: currentProjectSettings
        });

        projectState.setProjectSettings(savedSettings);
        workspaceUiState.setHasSavedProjectSettings(true);
        workspaceUiState.setProjectStatusMessage(
          workspaceUiState.projectRootName
            ? `Saved project settings to ${workspaceUiState.projectRootName}/${derivedState.configPathDisplay}.`
            : `Saved project settings to ${derivedState.configPathDisplay}.`
        );

        if (reloadProject || navigateToChat) {
          const reloadedContext = await loadProjectContext(workspaceUiState.projectRootPath);
          applyProjectContext(reloadedContext, { navigateToChat });
        }
      } catch (error) {
        workspaceUiState.setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to save the current project settings."
        );
      } finally {
        workspaceUiState.setIsProjectSaving(false);
      }
    },
    [
      applyProjectContext,
      derivedState.configPathDisplay,
      desktopRuntime,
      projectState,
      workspaceUiState
    ]
  );

  const scheduleProjectSettingsSave = useCallback(
    (reloadProject = false) => {
      if (
        !desktopRuntime ||
        !workspaceUiState.hasSavedProjectSettings ||
        !workspaceUiState.projectRootPath.trim()
      ) {
        return;
      }

      pendingProjectReloadRef.current = pendingProjectReloadRef.current || reloadProject;

      if (projectSaveTimerRef.current !== null) {
        window.clearTimeout(projectSaveTimerRef.current);
      }

      projectSaveTimerRef.current = window.setTimeout(() => {
        const shouldReload = pendingProjectReloadRef.current;
        pendingProjectReloadRef.current = false;
        projectSaveTimerRef.current = null;
        void saveCurrentProjectSettings({ reloadProject: shouldReload });
      }, 700);
    },
    [desktopRuntime, saveCurrentProjectSettings, workspaceUiState]
  );

  const handlePickProjectFolder = useCallback(async () => {
    if (!desktopRuntime) {
      workspaceUiState.setProjectErrorMessage("Project configuration requires the desktop runtime.");
      return;
    }

    workspaceUiState.setProjectErrorMessage("");
    workspaceUiState.setProjectStatusMessage("");
    workspaceUiState.setIsProjectLoading(true);

    try {
      const nextProjectContext = await pickProjectFolder();

      if (!nextProjectContext) {
        return;
      }

      const {
        context,
        createdDefaults
      } = await ensureProjectSettings(nextProjectContext);

      applyProjectContext(context);

      if (createdDefaults) {
        workspaceUiState.setProjectStatusMessage(
          `Created default SpecForge settings for ${context.rootName}. Configure project defaults in Settings.`
        );
      }

      navigate("/review");
    } catch (error) {
      workspaceUiState.setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to open the selected project folder."
      );
    } finally {
      workspaceUiState.setIsProjectLoading(false);
    }
  }, [applyProjectContext, desktopRuntime, ensureProjectSettings, navigate, workspaceUiState]);

  const handleOpenRecentProject = useCallback(
    async (path: string) => {
      if (!desktopRuntime) {
        workspaceUiState.setProjectErrorMessage("Project configuration requires the desktop runtime.");
        return;
      }

      if (!path.trim()) {
        return;
      }

      workspaceUiState.setProjectErrorMessage("");
      workspaceUiState.setProjectStatusMessage("");
      workspaceUiState.setIsProjectLoading(true);

      try {
        const nextProjectContext = await loadProjectContext(normalizeStoredProjectPath(path));
        const {
          context,
          createdDefaults
        } = await ensureProjectSettings(nextProjectContext);

        applyProjectContext(context);

        if (createdDefaults) {
          workspaceUiState.setProjectStatusMessage(
            `Created default SpecForge settings for ${context.rootName}. Configure project defaults in Settings.`
          );
        }

        navigate("/review");
      } catch (error) {
        workspaceUiState.setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to open the selected recent project."
        );
      } finally {
        workspaceUiState.setIsProjectLoading(false);
      }
    },
    [
      applyProjectContext,
      desktopRuntime,
      ensureProjectSettings,
      navigate,
      workspaceUiState
    ]
  );

  return {
    applyProjectContext,
    saveCurrentProjectSettings,
    scheduleProjectSettingsSave,
    handlePickProjectFolder,
    handleOpenRecentProject,
    projectSaveTimerRef
  };
}
