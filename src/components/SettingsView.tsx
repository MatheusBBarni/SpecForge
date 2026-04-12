import {
  Button,
  Card,
  Input
} from "@heroui/react";
import {
  Database,
  SunLight,
  Terminal
} from "iconoir-react";
import { memo } from "react";

import { CliHealthCard } from "./CliHealthCard";
import { ProjectAiSettingsCard } from "./ProjectAiSettingsCard";
import { ProjectDocumentsCard } from "./ProjectDocumentsCard";
import {
  FIELD_LABEL_CLASS,
  INPUT_CLASS,
  ScopedPathReference,
  SETTINGS_PANEL_CLASS,
  SETTINGS_SURFACE_CLASS,
  SettingsSectionHeader
} from "./SettingsPrimitives";
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
      <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.5rem]`}>
        <Card.Content className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
          <div className="max-w-3xl">
            <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
              Settings
            </p>
            <h2 className="m-0 text-[1.4rem] font-semibold text-[var(--text-main)]">
              Machine and Project Preferences
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-subtle)]">
              CLI overrides and theme stay local to this machine. Prompt templates, AI defaults,
              and document paths are saved inside the selected project.
            </p>
            <ScopedPathReference path={configPath} workspaceRootName={workspaceRootName} />
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
        </Card.Content>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className={`${SETTINGS_PANEL_CLASS} h-full rounded-[1.5rem]`}>
          <Card.Content className="grid h-full content-start gap-5 px-5 py-5">
            <SettingsSectionHeader icon={<Terminal className="size-5" />} title="Claude CLI" />
            <CliHealthCard entry={environment.claude} />
            <label className="grid gap-2">
              <span className={FIELD_LABEL_CLASS}>Binary path override</span>
              <Input
                className={INPUT_CLASS}
                id="settings-claude-path"
                onChange={(event) => onClaudePathChange(event.target.value)}
                placeholder="Optional manual path"
                value={claudePath}
              />
            </label>
          </Card.Content>
        </Card>

        <Card className={`${SETTINGS_PANEL_CLASS} h-full rounded-[1.5rem]`}>
          <Card.Content className="grid h-full content-start gap-5 px-5 py-5">
            <SettingsSectionHeader icon={<Terminal className="size-5" />} title="Codex CLI" />
            <CliHealthCard entry={environment.codex} />
            <label className="grid gap-2">
              <span className={FIELD_LABEL_CLASS}>Binary path override</span>
              <Input
                className={INPUT_CLASS}
                id="settings-codex-path"
                onChange={(event) => onCodexPathChange(event.target.value)}
                placeholder="Optional manual path"
                value={codexPath}
              />
            </label>
          </Card.Content>
        </Card>

        <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.5rem] xl:col-span-2`}>
          <Card.Content className="grid gap-4 px-5 py-5">
            <SettingsSectionHeader icon={<SunLight className="size-5" />} title="Theme" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                { id: "dracula", label: "Dracula", meta: "Primary dark IDE theme" },
                { id: "light", label: "Light", meta: "High-contrast daylight palette" },
                { id: "system", label: "System", meta: "Follow the OS appearance" }
              ].map((entry) => (
                <Button
                  className={theme === entry.id ? ACTIVE_OPTION_CARD_CLASS : OPTION_CARD_CLASS}
                  key={entry.id}
                  onPress={() => onThemeChange(entry.id as ThemeMode)}
                >
                  <span className="text-left">{entry.label}</span>
                  <small className="text-left">{entry.meta}</small>
                </Button>
              ))}
            </div>
          </Card.Content>
        </Card>

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
            workspaceRootName={workspaceRootName}
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

        <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.5rem] xl:col-span-2`}>
          <Card.Content className="grid gap-4 px-5 py-5">
            <SettingsSectionHeader
              icon={<Database className="size-5" />}
              title="Workspace Notes"
            />
            <div className={`${SETTINGS_SURFACE_CLASS} grid gap-2 px-4 py-4 font-[var(--font-mono)] text-sm text-[var(--text-main)]`}>
              <div>Project-specific AI settings live inside the selected workspace.</div>
              <div>Manual PRD/spec edits still remain in-memory until a generate action writes a file.</div>
              <div>CLI overrides and theme remain machine-local and do not touch `.specforge/settings.json`.</div>
            </div>

            {annotations.length > 0 ? (
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
            ) : null}
          </Card.Content>
        </Card>
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

const OPTION_CARD_CLASS =
  "flex h-full w-full flex-col items-start justify-start gap-1 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4 text-left text-[var(--text-main)] transition hover:-translate-y-0.5 hover:border-[rgba(189,147,249,0.34)]";

const ACTIVE_OPTION_CARD_CLASS =
  "flex h-full w-full flex-col items-start justify-start gap-1 rounded-[1rem] border border-[rgba(189,147,249,0.42)] bg-[linear-gradient(135deg,rgba(189,147,249,0.18),rgba(139,233,253,0.08)),var(--bg-surface)] px-4 py-4 text-left text-[var(--text-main)] transition";

export default SettingsView;
