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
import type { ChatSessionSummary, ProjectContext } from "../types";
import type { ProjectStoreSlice, SettingsStoreSlice } from "./useAppStoreSlices";
import type { AppDerivedState } from "./useAppView";

interface UseProjectHandlersOptions {
  applyProjectContextDeps: {
    projectRootPath: string;
    projectState: ProjectStoreSlice;
    settingsState: SettingsStoreSlice;
    setProjectRootName: (value: string) => void;
    setProjectRootPath: (value: string) => void;
    setProjectConfigPath: (value: string) => void;
    setHasSelectedProject: (value: boolean) => void;
    setHasSavedProjectSettings: (value: boolean) => void;
    setWorkspaceFiles: (files: Record<string, WorkspaceFileSource>) => void;
    setPrdGenerationPrompt: (value: string) => void;
    setPrdGenerationError: (value: string) => void;
    setSpecGenerationPrompt: (value: string) => void;
    setSpecGenerationError: (value: string) => void;
    setChatSessions: (sessions: ChatSessionSummary[]) => void;
    setActiveSessionId: (id: string | null) => void;
    setCavemanStatus: (status: { ready: boolean; message: string }) => void;
    setProjectStatusMessage: (message: string) => void;
    setProjectErrorMessage: (message: string) => void;
    setWorkspaceNotice: (notice: string) => void;
    latestPathnameRef: MutableRefObject<string>;
  };
  derivedState: AppDerivedState;
  desktopRuntime: boolean;
  hasSavedProjectSettings: boolean;
  projectRootName: string;
  projectRootPath: string;
  projectState: ProjectStoreSlice;
  setIsProjectLoading: (value: boolean) => void;
  setIsProjectSaving: (value: boolean) => void;
  setProjectErrorMessage: (message: string) => void;
  setProjectStatusMessage: (message: string) => void;
}

export function useProjectHandlers({
  applyProjectContextDeps,
  derivedState,
  desktopRuntime,
  hasSavedProjectSettings,
  projectRootName,
  projectRootPath,
  projectState,
  setIsProjectLoading,
  setIsProjectSaving,
  setProjectErrorMessage,
  setProjectStatusMessage
}: UseProjectHandlersOptions) {
  const navigate = useNavigate();
  const pendingProjectReloadRef = useRef(false);
  const projectSaveTimerRef = useRef<number | null>(null);

  const applyProjectContext = useCallback(
    (context: ProjectContext, options?: { navigateToChat?: boolean }) => {
      const {
        projectRootPath: currentProjectRootPath,
        projectState: ps,
        settingsState: ss,
        setProjectRootName,
        setProjectRootPath,
        setProjectConfigPath,
        setHasSelectedProject,
        setHasSavedProjectSettings: setHasSaved,
        setWorkspaceFiles,
        setPrdGenerationPrompt,
        setPrdGenerationError,
        setSpecGenerationPrompt,
        setSpecGenerationError,
        setChatSessions,
        setActiveSessionId,
        setCavemanStatus,
        setProjectStatusMessage: setStatusMsg,
        setProjectErrorMessage: setErrorMsg,
        setWorkspaceNotice,
        latestPathnameRef
      } = applyProjectContextDeps;

      const normalizedCurrentProjectPath = currentProjectRootPath
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
      setProjectRootName(context.rootName);
      setProjectRootPath(context.rootPath);
      setProjectConfigPath(context.settingsPath);
      setHasSelectedProject(true);
      setHasSaved(context.hasSavedSettings);
      ss.setWorkspaceEntries(context.entries);
      setWorkspaceFiles(nextWorkspaceFiles);
      ss.setLastProjectPath(context.rootPath);
      ps.setProjectSettings(context.settings);
      setPrdGenerationPrompt("");
      setPrdGenerationError("");
      setSpecGenerationPrompt("");
      setSpecGenerationError("");
      setChatSessions(context.chatSessions);
      setActiveSessionId(context.lastActiveSessionId ?? context.chatSessions[0]?.id ?? null);
      setCavemanStatus({
        ready: true,
        message: "Caveman mode is built into every topic."
      });
      setStatusMsg(
        context.hasSavedSettings
          ? `Loaded project settings from ${context.rootName}/${settingsPathDisplay}.`
          : `Selected ${context.rootName}. Save the setup to create ${context.rootName}/${settingsPathDisplay}.`
      );
      setErrorMsg("");
      setWorkspaceNotice(buildWorkspaceNotice(context));

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
        navigate("/chat");
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
        setProjectErrorMessage("Project configuration requires the desktop runtime.");
        return;
      }

      if (!projectRootPath.trim()) {
        setProjectErrorMessage("Choose a project folder before saving.");
        return;
      }

      setProjectErrorMessage("");
      setProjectStatusMessage("");
      setIsProjectSaving(true);

      try {
        const latestProjectState = useProjectStore.getState();
        const currentProjectSettings = buildCurrentProjectSettings({
          configuredPrdPath: latestProjectState.configuredPrdPath,
          configuredSpecPath: latestProjectState.configuredSpecPath,
          prdPromptTemplate: latestProjectState.prdPromptTemplate,
          selectedModel: latestProjectState.selectedModel,
          selectedReasoning: latestProjectState.selectedReasoning,
          specPromptTemplate: latestProjectState.specPromptTemplate,
          supportingDocumentPaths: latestProjectState.supportingDocumentPaths
        });
        const savedSettings = await saveProjectSettings({
          folderPath: projectRootPath,
          settings: currentProjectSettings
        });

        projectState.setProjectSettings(savedSettings);
        applyProjectContextDeps.setHasSavedProjectSettings(true);
        setProjectStatusMessage(
          projectRootName
            ? `Saved project settings to ${projectRootName}/${derivedState.configPathDisplay}.`
            : `Saved project settings to ${derivedState.configPathDisplay}.`
        );

        if (reloadProject || navigateToChat) {
          const reloadedContext = await loadProjectContext(projectRootPath);
          applyProjectContext(reloadedContext, { navigateToChat });
        }
      } catch (error) {
        setProjectErrorMessage(
          error instanceof Error ? error.message : "Unable to save the current project settings."
        );
      } finally {
        setIsProjectSaving(false);
      }
    },
    [
      applyProjectContext,
      applyProjectContextDeps,
      derivedState.configPathDisplay,
      desktopRuntime,
      projectRootName,
      projectRootPath,
      projectState,
      setIsProjectSaving,
      setProjectErrorMessage,
      setProjectStatusMessage
    ]
  );

  const scheduleProjectSettingsSave = useCallback(
    (reloadProject = false) => {
      if (!desktopRuntime || !hasSavedProjectSettings || !projectRootPath.trim()) {
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
    [desktopRuntime, hasSavedProjectSettings, projectRootPath, saveCurrentProjectSettings]
  );

  const handlePickProjectFolder = useCallback(async () => {
    if (!desktopRuntime) {
      setProjectErrorMessage("Project configuration requires the desktop runtime.");
      return;
    }

    setProjectErrorMessage("");
    setProjectStatusMessage("");
    setIsProjectLoading(true);

    try {
      const nextProjectContext = await pickProjectFolder();

      if (!nextProjectContext) {
        return;
      }

      applyProjectContext(nextProjectContext);
      navigate("/");
    } catch (error) {
      setProjectErrorMessage(
        error instanceof Error ? error.message : "Unable to open the selected project folder."
      );
    } finally {
      setIsProjectLoading(false);
    }
  }, [applyProjectContext, desktopRuntime, navigate, setIsProjectLoading, setProjectErrorMessage, setProjectStatusMessage]);

  return {
    applyProjectContext,
    saveCurrentProjectSettings,
    scheduleProjectSettingsSave,
    handlePickProjectFolder,
    projectSaveTimerRef
  };
}
