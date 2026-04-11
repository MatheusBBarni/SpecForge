import { Folder, Refresh, Terminal } from "iconoir-react";

import { CliHealthCard } from "../components/CliHealthCard";
import { ProjectAiSettingsCard } from "../components/ProjectAiSettingsCard";
import { ProjectDocumentsCard } from "../components/ProjectDocumentsCard";
import type { EnvironmentStatus, ModelId, ReasoningProfileId } from "../types";

interface ConfigurationScreenProps {
  desktopRuntime: boolean;
  environment: EnvironmentStatus;
  claudePath: string;
  codexPath: string;
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
  prdPath: string;
  specPath: string;
  supportingDocumentsValue: string;
  onPickFolder: () => void;
  onRefresh: () => void;
  onContinue: () => void;
  onClaudePathChange: (value: string) => void;
  onCodexPathChange: (value: string) => void;
  onModelChange: (model: ModelId) => void;
  onReasoningChange: (reasoning: ReasoningProfileId) => void;
  onPrdPromptChange: (value: string) => void;
  onSpecPromptChange: (value: string) => void;
  onPrdPathChange: (value: string) => void;
  onSpecPathChange: (value: string) => void;
  onSupportingDocumentsChange: (value: string) => void;
}

export function ConfigurationScreen({
  desktopRuntime,
  environment,
  claudePath,
  codexPath,
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
  prdPath,
  specPath,
  supportingDocumentsValue,
  onPickFolder,
  onRefresh,
  onContinue,
  onClaudePathChange,
  onCodexPathChange,
  onModelChange,
  onReasoningChange,
  onPrdPromptChange,
  onSpecPromptChange,
  onPrdPathChange,
  onSpecPathChange,
  onSupportingDocumentsChange
}: ConfigurationScreenProps) {
  const canContinue = desktopRuntime && workspaceRootPath.length > 0 && !isSaving;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-5 pb-5 pt-5">
      <div className="grid gap-4">
        <article className="grid gap-4 rounded-[1.6rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-6 shadow-[var(--shadow)] backdrop-blur-[30px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
                Project Setup
              </p>
              <h1 className="m-0 text-[1.8rem] font-semibold text-[var(--text-main)]">
                Configure SpecForge Before Review Starts
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--text-subtle)]">
                Choose the project folder, verify the available CLIs, set the default AI prompts
                and model behavior, and point SpecForge at the PRD/spec files you want this
                workspace to use.
              </p>
            </div>

            <button className={SECONDARY_BUTTON_CLASS} onClick={onRefresh} type="button">
              <Refresh className="size-5" />
              Refresh
            </button>
          </div>

          {statusMessage ? (
            <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">{statusMessage}</p>
          ) : null}
          {errorMessage ? (
            <p className="m-0 text-sm leading-6 text-[var(--danger)]">{errorMessage}</p>
          ) : null}
        </article>

        <article className={PANEL_CLASS}>
          <StepHeading
            number="1"
            title="Open The Project Folder"
            description="This becomes the active workspace and the place where `.specforge/settings.json` is created."
          />

          <div className="flex flex-wrap items-center gap-3">
            <button className={PRIMARY_BUTTON_CLASS} onClick={onPickFolder} type="button">
              <Folder className="size-5" />
              {isProjectLoading ? "Opening..." : "Select Folder"}
            </button>
          </div>

          <div className="grid gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4 font-[var(--font-mono)] text-sm text-[var(--text-main)]">
            <div>Workspace: {workspaceRootName || "No folder selected yet"}</div>
            <div>Path: {workspaceRootPath || "Pick a folder to begin"}</div>
            <div>Settings file: {settingsPath || ".specforge/settings.json"}</div>
          </div>
        </article>

        <article className={PANEL_CLASS}>
          <StepHeading
            number="2"
            title="Review CLI Availability"
            description="SpecForge keeps CLI discovery machine-local. Manual path overrides remain local preferences."
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <CliHealthCard entry={environment.claude} />
            <CliHealthCard entry={environment.codex} />
            <CliHealthCard entry={environment.git} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className={FIELD_LABEL_CLASS}>Claude CLI override</span>
              <input
                className={INPUT_CLASS}
                onChange={(event) => onClaudePathChange(event.target.value)}
                placeholder="Optional manual path"
                value={claudePath}
              />
            </label>

            <label className="grid gap-2">
              <span className={FIELD_LABEL_CLASS}>Codex CLI override</span>
              <input
                className={INPUT_CLASS}
                onChange={(event) => onCodexPathChange(event.target.value)}
                placeholder="Optional manual path"
                value={codexPath}
              />
            </label>
          </div>
        </article>

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
              onPrdPromptChange={onPrdPromptChange}
              onReasoningChange={onReasoningChange}
              onSpecPromptChange={onSpecPromptChange}
              prdPrompt={prdPrompt}
              selectedModel={selectedModel}
              selectedReasoning={selectedReasoning}
              specPrompt={specPrompt}
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

        <article className={PANEL_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-4">
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

            <button
              className={`${PRIMARY_BUTTON_CLASS} ${!canContinue ? "cursor-not-allowed opacity-50 hover:translate-y-0" : ""}`}
              disabled={!canContinue}
              onClick={onContinue}
              type="button"
            >
              {isSaving
                ? "Saving..."
                : hasSavedSettings
                  ? "Save Changes and Continue"
                  : "Create .specforge and Continue"}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
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

const PANEL_CLASS =
  "grid gap-4 rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)] backdrop-blur-[30px]";

const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

const INPUT_CLASS =
  "w-full rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[15px] text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]";

const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white/5 px-4 py-3 font-medium text-[var(--text-main)] transition hover:-translate-y-0.5 hover:bg-white/8";

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-4 py-3 font-semibold text-[#15131c] transition hover:-translate-y-0.5 hover:opacity-95";
