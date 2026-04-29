import {
  Button,
  Card,
  Input
} from "@heroui/react";
import { Folder, Refresh, Terminal } from "iconoir-react";
import { memo } from "react";

import { CliHealthCard } from "../components/CliHealthCard";
import { ProjectAiSettingsCard } from "../components/ProjectAiSettingsCard";
import { ProjectDocumentsCard } from "../components/ProjectDocumentsCard";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SETTINGS_PANEL_CLASS,
  SETTINGS_SURFACE_CLASS
} from "../components/SettingsPrimitives";
import type { EnvironmentStatus, ModelId, ReasoningProfileId } from "../types";

interface ConfigurationScreenProps {
  desktopRuntime: boolean;
  environment: EnvironmentStatus;
  cursorApiKeyInput: string;
  workspaceRootName: string;
  workspaceRootPath: string;
  settingsPath: string;
  hasSavedSettings: boolean;
  isProjectLoading: boolean;
  isSaving: boolean;
  statusMessage: string;
  errorMessage: string;
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  prdPrompt: string;
  specPrompt: string;
  executionAgentDescription: string;
  prdPath: string;
  specPath: string;
  supportingDocumentsValue: string;
  onPickFolder: () => void;
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
  environment,
  cursorApiKeyInput,
  workspaceRootName,
  workspaceRootPath,
  settingsPath,
  hasSavedSettings,
  isProjectLoading,
  isSaving,
  statusMessage,
  errorMessage,
  selectedModel,
  selectedReasoning,
  prdPrompt,
  specPrompt,
  executionAgentDescription,
  prdPath,
  specPath,
  supportingDocumentsValue,
  onPickFolder,
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
  const canContinue = desktopRuntime && workspaceRootPath.length > 0 && !isSaving;
  const folderActionLabel = isProjectLoading
    ? "Opening..."
    : hasSavedSettings
      ? "Open New Folder"
      : "Select Folder";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-5 pb-5 pt-5">
      <div className="grid gap-4">
        <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.6rem]`}>
          <Card.Content className="grid gap-4 px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
                  Project Setup
                </p>
                <h1 className="m-0 text-[1.8rem] font-semibold text-[var(--text-main)]">
                  Configure SpecForge Before Review Starts
                </h1>
                <p className="mt-3 text-sm leading-7 text-[var(--text-subtle)]">
                  Choose the project folder, save the Cursor key, set the default agent descriptions
                  and model behavior, and point SpecForge at the PRD/spec files you want this
                  workspace to use.
                </p>
              </div>

              <Button className={SECONDARY_BUTTON_CLASS} onPress={onRefresh}>
                <Refresh className="size-5" />
                Refresh
              </Button>
            </div>

            {statusMessage ? (
              <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">{statusMessage}</p>
            ) : null}
            {errorMessage ? (
              <p className="m-0 text-sm leading-6 text-[var(--danger)]">{errorMessage}</p>
            ) : null}
          </Card.Content>
        </Card>

        <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.5rem]`}>
          <Card.Content className="grid gap-4 px-5 py-5">
            <StepHeading
              number="1"
              title="Open The Project Folder"
              description="This becomes the active workspace and the place where `.specforge/settings.json` is created."
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button className={PRIMARY_BUTTON_CLASS} onPress={onPickFolder}>
                <Folder className="size-5" />
                {folderActionLabel}
              </Button>
            </div>

            <div className={`${SETTINGS_SURFACE_CLASS} grid gap-2 px-4 py-4 font-[var(--font-mono)] text-sm text-[var(--text-main)]`}>
              <div>Workspace: {workspaceRootName || "No folder selected yet"}</div>
              <div>Path: {workspaceRootPath || "Pick a folder to begin"}</div>
              <div>Settings file: {settingsPath || ".specforge/settings.json"}</div>
            </div>
          </Card.Content>
        </Card>

        <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.5rem]`}>
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

        <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.5rem]`}>
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

const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

const INPUT_CLASS =
  "w-full rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[15px] text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]";
