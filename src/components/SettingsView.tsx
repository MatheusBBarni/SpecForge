import {
  Button,
  Card,
  Input
} from "@heroui/react";
import {
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
    <section className="grid gap-4 pt-4">
      {projectErrorMessage ? (
        <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.5rem]`}>
          <Card.Content className="px-5 py-4">
            <p className="m-0 text-sm leading-6 text-[var(--danger)]">{projectErrorMessage}</p>
          </Card.Content>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className={`${SETTINGS_PANEL_CLASS} h-full rounded-[1.5rem]`}>
          <Card.Content className="grid h-full content-start gap-5 px-5 py-5">
            <SettingsSectionHeader icon={<Terminal className="size-5" />} title="Cursor SDK" />
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
          </Card.Content>
        </Card>

        <Card className={`${SETTINGS_PANEL_CLASS} h-full rounded-[1.5rem]`}>
          <Card.Content className="grid h-full content-start gap-5 px-5 py-5">
            <SettingsSectionHeader icon={<Terminal className="size-5" />} title="Git" />
            <CliHealthCard entry={environment.git} />
          </Card.Content>
        </Card>

        <div className="grid gap-4 xl:col-span-2 xl:grid-cols-2">
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
        </div>

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
      </div>
    </section>
  );
});

const OPTION_CARD_CLASS =
  "flex h-full w-full flex-col items-start justify-start gap-1 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4 text-left text-[var(--text-main)] transition hover:-translate-y-0.5 hover:border-[rgba(189,147,249,0.34)]";

const ACTIVE_OPTION_CARD_CLASS =
  "flex h-full w-full flex-col items-start justify-start gap-1 rounded-[1rem] border border-[rgba(189,147,249,0.42)] bg-[linear-gradient(135deg,rgba(189,147,249,0.18),rgba(139,233,253,0.08)),var(--bg-surface)] px-4 py-4 text-left text-[var(--text-main)] transition";

export default SettingsView;
