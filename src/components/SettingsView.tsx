import {
  CheckCircle,
  Database,
  SunLight,
  Terminal
} from "iconoir-react";
import { memo } from "react";

import { CliHealthCard } from "./CliHealthCard";
import { ProjectAiSettingsCard } from "./ProjectAiSettingsCard";
import { ProjectDocumentsCard } from "./ProjectDocumentsCard";
import type {
  EnvironmentStatus,
  ModelId,
  ReasoningProfileId,
  SpecAnnotation,
  ThemeMode
} from "../types";

interface SettingsViewProps {
  annotations: SpecAnnotation[];
  environment: EnvironmentStatus;
  theme: ThemeMode;
  claudePath: string;
  codexPath: string;
  configPath: string;
  workspaceRootName: string;
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  prdPrompt: string;
  specPrompt: string;
  prdPath: string;
  specPath: string;
  supportingDocumentsValue: string;
  projectStatusMessage: string;
  projectErrorMessage: string;
  onThemeChange: (theme: ThemeMode) => void;
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

export const SettingsView = memo(function SettingsView({
  annotations,
  environment,
  theme,
  claudePath,
  codexPath,
  configPath,
  workspaceRootName,
  selectedModel,
  selectedReasoning,
  prdPrompt,
  specPrompt,
  prdPath,
  specPath,
  supportingDocumentsValue,
  projectStatusMessage,
  projectErrorMessage,
  onThemeChange,
  onClaudePathChange,
  onCodexPathChange,
  onModelChange,
  onReasoningChange,
  onPrdPromptChange,
  onSpecPromptChange,
  onPrdPathChange,
  onSpecPathChange,
  onSupportingDocumentsChange
}: SettingsViewProps) {
  return (
    <section className="grid gap-4 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)] backdrop-blur-[30px]">
        <div className="max-w-3xl">
          <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
            Settings
          </p>
          <h2 className="m-0 text-[1.4rem] font-semibold text-[var(--text-main)]">
            Machine and Project Preferences
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-subtle)]">
            CLI overrides and theme stay local to this machine. Prompt templates, AI defaults, and
            document paths are saved inside the selected project at{" "}
            <code>{configPath || ".specforge/settings.json"}</code>.
          </p>
          {projectStatusMessage ? (
            <p className="mb-0 mt-3 text-sm leading-6 text-[var(--text-subtle)]">
              {projectStatusMessage}
            </p>
          ) : null}
          {projectErrorMessage ? (
            <p className="mb-0 mt-3 text-sm leading-6 text-[var(--danger)]">
              {projectErrorMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className={PANEL_CLASS}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <Terminal className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">Claude CLI</span>
          </div>
          <CliHealthCard entry={environment.claude} />
          <div className="flex flex-col gap-2">
            <label className={FIELD_LABEL_CLASS} htmlFor="settings-claude-path">
              Binary path override
            </label>
            <input
              className={INPUT_CLASS}
              id="settings-claude-path"
              onChange={(event) => onClaudePathChange(event.target.value)}
              placeholder="Optional manual path"
              value={claudePath}
            />
          </div>
        </article>

        <article className={PANEL_CLASS}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <Terminal className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">Codex CLI</span>
          </div>
          <CliHealthCard entry={environment.codex} />
          <div className="flex flex-col gap-2">
            <label className={FIELD_LABEL_CLASS} htmlFor="settings-codex-path">
              Binary path override
            </label>
            <input
              className={INPUT_CLASS}
              id="settings-codex-path"
              onChange={(event) => onCodexPathChange(event.target.value)}
              placeholder="Optional manual path"
              value={codexPath}
            />
          </div>
        </article>

        <article className={`${PANEL_CLASS} xl:col-span-2`}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <SunLight className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">Theme</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { id: "dracula", label: "Dracula", meta: "Primary dark IDE theme" },
              { id: "light", label: "Light", meta: "High-contrast daylight palette" },
              { id: "system", label: "System", meta: "Follow the OS appearance" }
            ].map((entry) => (
              <button
                className={theme === entry.id ? ACTIVE_OPTION_CARD_CLASS : OPTION_CARD_CLASS}
                key={entry.id}
                onClick={() => onThemeChange(entry.id as ThemeMode)}
                type="button"
              >
                <span>{entry.label}</span>
                <small>{entry.meta}</small>
              </button>
            ))}
          </div>
        </article>

        <div className="grid gap-4 xl:col-span-2 xl:grid-cols-2">
          <ProjectAiSettingsCard
            configPath={configPath}
            onModelChange={onModelChange}
            onPrdPromptChange={onPrdPromptChange}
            onReasoningChange={onReasoningChange}
            onSpecPromptChange={onSpecPromptChange}
            prdPrompt={prdPrompt}
            selectedModel={selectedModel}
            selectedReasoning={selectedReasoning}
            specPrompt={specPrompt}
          />

          <ProjectDocumentsCard
            configPath={configPath}
            onPrdPathChange={onPrdPathChange}
            onSpecPathChange={onSpecPathChange}
            onSupportingDocumentsChange={onSupportingDocumentsChange}
            prdPath={prdPath}
            specPath={specPath}
            supportingDocumentsValue={supportingDocumentsValue}
            workspaceRootName={workspaceRootName}
          />
        </div>

        <article className={`${PANEL_CLASS} xl:col-span-2`}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <Database className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">
              Workspace Notes
            </span>
          </div>
          <div className={LIST_CLASS}>
            <div>Project-specific AI settings live inside the selected workspace.</div>
            <div>Manual PRD/spec edits still remain in-memory until a generate action writes a file.</div>
            <div>CLI overrides and theme remain machine-local and do not touch `.specforge/settings.json`.</div>
          </div>
        </article>

        {annotations.length > 0 ? (
          <article className={`${PANEL_CLASS} xl:col-span-2`}>
            <div className="flex items-center gap-3 text-[var(--text-main)]">
              <CheckCircle className="size-5 text-[var(--accent-2)]" />
              <span className="text-sm font-semibold uppercase tracking-[0.08em]">
                Workspace Notes
              </span>
            </div>
            <div className="grid gap-3">
              {annotations.map((annotation) => (
                <article className={getAnnotationClassName(annotation.tone)} key={annotation.id}>
                  <h3 className="m-0 text-base font-semibold text-[var(--text-main)]">
                    {annotation.title}
                  </h3>
                  <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
                    {annotation.body}
                  </p>
                </article>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
});

function getAnnotationClassName(tone: "info" | "warning" | "success") {
  const toneClass =
    tone === "info"
      ? "border-[rgba(139,233,253,0.24)]"
      : tone === "warning"
        ? "border-[rgba(255,184,108,0.3)]"
        : "border-[rgba(80,250,123,0.3)]";

  return `grid gap-2 rounded-[1rem] border ${toneClass} bg-[var(--bg-surface)] p-4`;
}

const PANEL_CLASS =
  "grid gap-4 rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)] backdrop-blur-[30px]";

const LIST_CLASS =
  "grid gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4 font-[var(--font-mono)] text-sm text-[var(--text-main)]";

const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

const INPUT_CLASS =
  "w-full rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[15px] text-[var(--text-main)] placeholder:text-[var(--text-muted)]";

const OPTION_CARD_CLASS =
  "grid gap-1 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4 text-left text-[var(--text-main)] transition hover:-translate-y-0.5 hover:border-[rgba(189,147,249,0.34)]";

const ACTIVE_OPTION_CARD_CLASS =
  "grid gap-1 rounded-[1rem] border border-[rgba(189,147,249,0.42)] bg-[linear-gradient(135deg,rgba(189,147,249,0.18),rgba(139,233,253,0.08)),var(--bg-surface)] px-4 py-4 text-left text-[var(--text-main)] transition";

export default SettingsView;
