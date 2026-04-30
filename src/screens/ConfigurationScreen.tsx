import {
  Button,
  Card,
  Input
} from "@heroui/react";
import { Folder, GitSolid, NavArrowRight, Refresh, Terminal } from "iconoir-react";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";

import { CliHealthCard } from "../components/CliHealthCard";
import { ProjectAiSettingsCard } from "../components/ProjectAiSettingsCard";
import { ProjectDocumentsCard } from "../components/ProjectDocumentsCard";
import {
  FIELD_LABEL_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SETTINGS_PANEL_CLASS,
  SETTINGS_SURFACE_CLASS
} from "../components/SettingsPrimitives";
import { buildConfigPathDisplay } from "../lib/appState";
import { formatSupportingDocumentPaths } from "../lib/projectConfig";
import { useProjectStore } from "../store/useProjectStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useWorkspaceUiStore } from "../store/useWorkspaceUiStore";
import type { ModelId, ReasoningProfileId } from "../types";

interface ConfigurationScreenProps {
  desktopRuntime: boolean;
  onPickFolder: () => void;
  onOpenRecentProject: (path: string) => void;
  onRefresh: () => void;
  onContinue: () => void;
  onCursorApiKeyInputChange: (value: string) => void;
  onSaveCursorApiKey: () => void;
  onDeleteCursorApiKey: () => void;
  onModelChange: (model: ModelId) => void;
  onReasoningChange: (reasoning: ReasoningProfileId) => void;
  onPrdPromptChange: (value: string) => void;
  onSpecPromptChange: (value: string) => void;
  onExecutionAgentDescriptionChange: (value: string) => void;
  onPrdPathChange: (value: string) => void;
  onSpecPathChange: (value: string) => void;
  onSupportingDocumentsChange: (value: string) => void;
}

export const ConfigurationScreen = memo(function ConfigurationScreen({
  desktopRuntime,
  onPickFolder,
  onOpenRecentProject,
  onRefresh,
  onContinue,
  onCursorApiKeyInputChange,
  onSaveCursorApiKey,
  onDeleteCursorApiKey,
  onModelChange,
  onReasoningChange,
  onPrdPromptChange,
  onSpecPromptChange,
  onExecutionAgentDescriptionChange,
  onPrdPathChange,
  onSpecPathChange,
  onSupportingDocumentsChange
}: ConfigurationScreenProps) {
  const {
    cursorApiKeyInput,
    environment,
    recentProjects
  } = useSettingsStore(
    useShallow((state) => ({
      cursorApiKeyInput: state.cursorApiKeyInput,
      environment: state.environment,
      recentProjects: state.recentProjects
    }))
  );
  const {
    executionAgentDescription,
    prdPath,
    prdPrompt,
    selectedModel,
    selectedReasoning,
    specPath,
    specPrompt,
    supportingDocumentsValue
  } = useProjectStore(
    useShallow((state) => ({
      executionAgentDescription: state.executionAgentDescription,
      prdPath: state.configuredPrdPath,
      prdPrompt: state.prdPromptTemplate,
      selectedModel: state.selectedModel,
      selectedReasoning: state.selectedReasoning,
      specPath: state.configuredSpecPath,
      specPrompt: state.specPromptTemplate,
      supportingDocumentsValue: formatSupportingDocumentPaths(state.supportingDocumentPaths)
    }))
  );
  const {
    cursorModels,
    errorMessage,
    hasSavedSettings,
    isProjectLoading,
    isSaving,
    settingsPath,
    workspaceRootName,
    workspaceRootPath
  } = useWorkspaceUiStore(
    useShallow((state) => ({
      cursorModels: state.cursorModels,
      errorMessage: state.projectErrorMessage,
      hasSavedSettings: state.hasSavedProjectSettings,
      isProjectLoading: state.isProjectLoading || state.isImporting,
      isSaving: state.isProjectSaving,
      settingsPath: buildConfigPathDisplay(state.projectConfigPath, state.projectRootName),
      workspaceRootName: state.projectRootName,
      workspaceRootPath: state.projectRootPath
    }))
  );
  const canContinue = desktopRuntime && workspaceRootPath.length > 0 && !isSaving;
  const folderActionLabel = isProjectLoading
    ? "Opening..."
    : hasSavedSettings
      ? "Open New Folder"
      : "Select Folder";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-5 pb-5 pt-5">
      <div className="mx-auto grid w-full max-w-[1400px] gap-5">
        <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
              Projects
            </p>
            <h1 className="m-0 text-[2rem] font-semibold leading-10 text-[var(--text-main)]">
              Workspace Initialization
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-6 text-[var(--text-subtle)]">
              Connect a local repository or select an existing project to begin your SpecForge
              review session.
            </p>
          </div>

          <Button className={SECONDARY_BUTTON_CLASS} onPress={onRefresh}>
            <Refresh className="size-5" />
            Refresh
          </Button>
        </header>

        {errorMessage ? (
          <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
            <Card.Content className="grid gap-2 px-5 py-4">
              <p className="m-0 text-sm leading-6 text-[var(--danger)]">{errorMessage}</p>
            </Card.Content>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
            <Card.Content className="flex min-h-[280px] flex-col items-center justify-center gap-5 border-2 border-dashed border-[var(--border-soft)] px-8 py-10 text-center transition hover:border-[var(--accent)]">
              <div className="grid size-16 place-items-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-app)] text-[var(--accent)]">
                <Folder className="size-8" />
              </div>

              <div>
                <h2 className="m-0 text-2xl font-semibold text-[var(--text-main)]">
                  Select Local Workspace
                </h2>
                <p className="mx-auto mb-0 mt-2 max-w-md text-sm leading-6 text-[var(--text-subtle)]">
                  Browse your local file system to load a project directory into SpecForge.
                  Settings are saved under `.specforge/settings.json`.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button className={PRIMARY_BUTTON_CLASS} onPress={onPickFolder}>
                  <Folder className="size-5" />
                  {folderActionLabel}
                </Button>
              </div>

              <div className={`${SETTINGS_SURFACE_CLASS} grid w-full max-w-2xl gap-2 px-4 py-4 text-left font-[var(--font-mono)] text-sm text-[var(--text-main)]`}>
                <div>Workspace: {workspaceRootName || "No folder selected yet"}</div>
                <div>Path: {workspaceRootPath || "Pick a folder to begin"}</div>
                <div>Settings file: {settingsPath || ".specforge/settings.json"}</div>
              </div>
            </Card.Content>
          </Card>

          <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
            <Card.Content className="relative flex min-h-[280px] flex-col gap-4 overflow-hidden px-5 py-5">
              <GitSolid className="absolute -right-2 top-2 size-24 text-[var(--text-muted)] opacity-10" />
              <div className="relative z-10 flex items-center gap-3">
                <GitSolid className="size-5 text-[var(--success)]" />
                <h2 className="m-0 text-lg font-semibold text-[var(--text-main)]">
                  Secure Clone
                </h2>
              </div>
              <p className="relative z-10 m-0 text-sm leading-6 text-[var(--text-subtle)]">
                Connect securely to your remote Git repository via SSH or enterprise credentials.
                Cloning is not wired yet.
              </p>
              <label className="relative z-10 mt-auto grid gap-2">
                <span className={FIELD_LABEL_CLASS}>Repository URL</span>
                <div className="flex gap-2">
                  <Input
                    className={INPUT_CLASS}
                    disabled
                    placeholder="git@github.com:org/repo.git"
                    type="text"
                  />
                  <Button className={SECONDARY_BUTTON_CLASS} isDisabled>
                    Clone
                  </Button>
                </div>
              </label>
            </Card.Content>
          </Card>
        </div>

        <section className="grid gap-4">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-2">
            <h2 className="m-0 text-xl font-semibold text-[var(--text-main)]">
              Recent Projects
            </h2>
            <span className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
              Stored in this browser
            </span>
          </div>

          {recentProjects.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recentProjects.map((project) => {
                const isActiveProject = workspaceRootPath === project.path;

                return (
                  <Card
                    className={`${SETTINGS_PANEL_CLASS} rounded-lg transition hover:border-[var(--accent)]`}
                    key={project.path}
                  >
                    <Card.Content className="flex h-full min-h-40 flex-col gap-4 px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="m-0 truncate text-base font-semibold text-[var(--text-main)]">
                            {project.name}
                          </h3>
                          <p className="m-0 mt-2 line-clamp-2 font-[var(--font-mono)] text-xs leading-5 text-[var(--text-muted)]">
                            {project.path}
                          </p>
                        </div>
                        {isActiveProject ? (
                          <span className="shrink-0 rounded border border-[var(--success)]/40 bg-[rgba(80,250,123,0.12)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--success)]">
                            Active
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-3">
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatRecentProjectDate(project.lastOpenedAt)}
                        </span>
                        <Button
                          className={SECONDARY_BUTTON_CLASS}
                          isDisabled={isProjectLoading}
                          onPress={() => onOpenRecentProject(project.path)}
                        >
                          Open
                          <NavArrowRight className="size-4" />
                        </Button>
                      </div>
                    </Card.Content>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg border-dashed`}>
              <Card.Content className="px-5 py-5">
                <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">
                  Open a project folder to add it to your recent projects.
                </p>
              </Card.Content>
            </Card>
          )}
        </section>

        <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-2">
          <h2 className="m-0 text-xl font-semibold text-[var(--text-main)]">
            Workspace Configuration
          </h2>
          <span className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
            Project-scoped defaults
          </span>
        </div>

        <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
          <Card.Content className="grid gap-4 px-5 py-5">
            <StepHeading
              number="2"
              title="Connect Cursor"
              description="SpecForge keeps the Cursor API key in the OS credential store, not in project settings."
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <CliHealthCard entry={environment.cursor} />
              <CliHealthCard entry={environment.git} />
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className={FIELD_LABEL_CLASS}>Cursor API key</span>
                <Input
                  className={INPUT_CLASS}
                  onChange={(event) => onCursorApiKeyInputChange(event.target.value)}
                  placeholder="key_..."
                  type="password"
                  value={cursorApiKeyInput}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <Button className={PRIMARY_BUTTON_CLASS} onPress={onSaveCursorApiKey}>
                  Save Cursor Key
                </Button>
                <Button className={SECONDARY_BUTTON_CLASS} onPress={onDeleteCursorApiKey}>
                  Clear Cursor Key
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="grid gap-4">
            <StepHeading
              number="3"
              title="Set AI Defaults"
              description="These prompt templates, model preferences, and reasoning defaults are saved per project."
            />
            <ProjectAiSettingsCard
              configPath={settingsPath}
              cursorModels={cursorModels}
              onModelChange={onModelChange}
              onExecutionAgentDescriptionChange={onExecutionAgentDescriptionChange}
              onPrdPromptChange={onPrdPromptChange}
              onReasoningChange={onReasoningChange}
              onSpecPromptChange={onSpecPromptChange}
              prdPrompt={prdPrompt}
              selectedModel={selectedModel}
              selectedReasoning={selectedReasoning}
              specPrompt={specPrompt}
              executionAgentDescription={executionAgentDescription}
              workspaceRootName={workspaceRootName}
            />
          </div>

          <div className="grid gap-4">
            <StepHeading
              number="4"
              title="Point To The Project Documents"
              description="Store the PRD, SPEC, and any supporting references relative to the selected workspace."
            />
            <ProjectDocumentsCard
              configPath={settingsPath}
              onPrdPathChange={onPrdPathChange}
              onSpecPathChange={onSpecPathChange}
              onSupportingDocumentsChange={onSupportingDocumentsChange}
              prdPath={prdPath}
              specPath={specPath}
              supportingDocumentsValue={supportingDocumentsValue}
              workspaceRootName={workspaceRootName}
            />
          </div>
        </div>

        <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
          <Card.Content className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 text-[var(--text-main)]">
                <Terminal className="size-5 text-[var(--accent-2)]" />
                <span className="text-sm font-semibold uppercase tracking-[0.08em]">
                  Ready To Continue
                </span>
              </div>
              <p className="mb-0 mt-3 text-sm leading-7 text-[var(--text-subtle)]">
                {desktopRuntime
                  ? "Save the current project settings into `.specforge/settings.json` and continue into the review workspace."
                  : "The desktop runtime is required to create `.specforge/settings.json` inside the selected project folder."}
              </p>
            </div>

            <Button
              className={`${PRIMARY_BUTTON_CLASS} ${!canContinue ? "cursor-not-allowed opacity-50 hover:translate-y-0" : ""}`}
              isDisabled={!canContinue}
              onPress={onContinue}
            >
              {isSaving
                ? "Saving..."
                : hasSavedSettings
                  ? "Save Changes and Continue"
                  : "Create .specforge and Continue"}
            </Button>
          </Card.Content>
        </Card>
      </div>
    </section>
  );
});

function formatRecentProjectDate(value: string) {
  if (!value) {
    return "Opened recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Opened recently";
  }

  return `Opened ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`;
}

function StepHeading({
  number,
  title,
  description
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)] font-semibold text-[var(--text-main)]">
        {number}
      </span>
      <div>
        <h2 className="m-0 text-lg font-semibold text-[var(--text-main)]">{title}</h2>
        <p className="mb-0 mt-2 text-sm leading-7 text-[var(--text-subtle)]">{description}</p>
      </div>
    </div>
  );
}
