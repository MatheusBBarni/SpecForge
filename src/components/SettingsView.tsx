import {
  Button,
  Card,
  Input
} from "@heroui/react";
import {
  Brain,
  Database,
  SunLight,
  Terminal
} from "iconoir-react";
import { memo } from "react";
import type {
  CursorModel,
  EnvironmentStatus,
  ModelId,
  ReasoningProfileId,
  SpecAnnotation,
  ThemeMode
} from "../types";
import { CliHealthCard } from "./CliHealthCard";
import { ProjectAiSettingsCard } from "./ProjectAiSettingsCard";
import { ProjectDocumentsCard } from "./ProjectDocumentsCard";
import {
  FIELD_LABEL_CLASS,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SETTINGS_CARD_BODY_CLASS,
  SETTINGS_CARD_HEADER_CLASS,
  SETTINGS_PANEL_CLASS,
  SettingsSectionHeader
} from "./SettingsPrimitives";

interface SettingsViewProps {
  annotations: SpecAnnotation[];
  environment: EnvironmentStatus;
  theme: ThemeMode;
  cursorApiKeyInput: string;
  configPath: string;
  workspaceRootName: string;
  cursorModels: CursorModel[];
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  prdPrompt: string;
  specPrompt: string;
  executionAgentDescription: string;
  prdPath: string;
  specPath: string;
  supportingDocumentsValue: string;
  projectStatusMessage: string;
  projectErrorMessage: string;
  onThemeChange: (theme: ThemeMode) => void;
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

export const SettingsView = memo(function SettingsView({
  environment,
  theme,
  cursorApiKeyInput,
  configPath,
  workspaceRootName,
  cursorModels,
  selectedModel,
  selectedReasoning,
  prdPrompt,
  specPrompt,
  executionAgentDescription,
  prdPath,
  specPath,
  supportingDocumentsValue,
  projectErrorMessage,
  onThemeChange,
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
}: SettingsViewProps) {
  return (
    <section className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--border-strong)] pb-6">
        <div className="min-w-0">
          <h1 className="m-0 text-3xl font-semibold leading-tight text-[var(--text-main)]">
            Project Settings
          </h1>
          <p className="mb-0 mt-2 text-lg leading-7 text-[var(--text-subtle)]">
            Manage project configuration for{" "}
            <span className="font-semibold text-[var(--text-main)]">
              {workspaceRootName || "this workspace"}
            </span>
            .
          </p>
        </div>
      </div>

      {projectErrorMessage ? (
        <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
          <Card.Content className="px-5 py-4">
            <p className="m-0 text-sm leading-6 text-[var(--danger)]">{projectErrorMessage}</p>
          </Card.Content>
        </Card>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav className="grid gap-2">
          {[
            { icon: <Terminal className="size-4" />, label: "General" },
            { icon: <Brain className="size-4" />, label: "AI Engine" },
            { icon: <Database className="size-4" />, label: "Document Context" },
            { icon: <SunLight className="size-4" />, label: "Theme" }
          ].map((item, index) => (
            <div
              className={
                index === 0
                  ? "flex items-center gap-3 rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-4 py-3 font-semibold text-[var(--accent)]"
                  : "flex items-center gap-3 rounded border border-transparent px-4 py-3 text-[var(--text-subtle)]"
              }
              key={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="grid gap-8">
          <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
            <div className={SETTINGS_CARD_HEADER_CLASS}>
              <SettingsSectionHeader icon={<Terminal className="size-5" />} title="General" />
            </div>
            <Card.Content className={SETTINGS_CARD_BODY_CLASS}>
              <div className="grid gap-5 xl:grid-cols-2">
                <section className="grid content-start gap-4">
                  <h3 className="m-0 text-base font-semibold text-[var(--text-main)]">
                    Cursor SDK
                  </h3>
                  <CliHealthCard entry={environment.cursor} />
                  <label className="grid gap-2">
                    <span className={FIELD_LABEL_CLASS}>Cursor API key</span>
                    <Input
                      className={INPUT_CLASS}
                      id="settings-cursor-key"
                      onChange={(event) => onCursorApiKeyInputChange(event.target.value)}
                      placeholder="key_..."
                      type="password"
                      value={cursorApiKeyInput}
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <Button className={PRIMARY_BUTTON_CLASS} onPress={onSaveCursorApiKey}>
                      Save Key
                    </Button>
                    <Button className={SECONDARY_BUTTON_CLASS} onPress={onDeleteCursorApiKey}>
                      Clear Key
                    </Button>
                  </div>
                </section>

                <section className="grid content-start gap-4">
                  <h3 className="m-0 text-base font-semibold text-[var(--text-main)]">Git</h3>
                  <CliHealthCard entry={environment.git} />
                </section>
              </div>
            </Card.Content>
          </Card>

          <ProjectAiSettingsCard
            configPath={configPath}
            cursorModels={cursorModels}
            onModelChange={onModelChange}
            onPrdPromptChange={onPrdPromptChange}
            onReasoningChange={onReasoningChange}
            onExecutionAgentDescriptionChange={onExecutionAgentDescriptionChange}
            onSpecPromptChange={onSpecPromptChange}
            executionAgentDescription={executionAgentDescription}
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

          <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
            <div className={SETTINGS_CARD_HEADER_CLASS}>
              <SettingsSectionHeader icon={<SunLight className="size-5" />} title="Theme" />
            </div>
            <Card.Content className={SETTINGS_CARD_BODY_CLASS}>
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
        </div>
      </div>
    </section>
  );
});

const OPTION_CARD_CLASS =
  "flex h-full w-full flex-col items-start justify-start gap-1 rounded border border-[var(--border-soft)] bg-[#090b14] px-4 py-4 text-left text-[var(--text-main)] transition hover:border-[rgba(189,147,249,0.34)]";

const ACTIVE_OPTION_CARD_CLASS =
  "flex h-full w-full flex-col items-start justify-start gap-1 rounded border border-[rgba(189,147,249,0.42)] bg-[linear-gradient(135deg,rgba(189,147,249,0.18),rgba(80,250,123,0.08)),#090b14] px-4 py-4 text-left text-[var(--text-main)] transition";

export default SettingsView;
