import {
  Card,
  TextArea
} from "@heroui/react";
import { Brain, Spark } from "iconoir-react";
import { memo } from "react";

import { getModelOptions, getReasoningOptions } from "../lib/agentConfig";
import type { CursorModel, ModelId, ReasoningProfileId } from "../types";
import {
  FIELD_LABEL_CLASS,
  ScopedPathReference,
  SETTINGS_CARD_BODY_CLASS,
  SETTINGS_CARD_HEADER_CLASS,
  SETTINGS_PANEL_CLASS,
  SETTINGS_SURFACE_CLASS,
  SettingsSectionHeader,
  SettingsSelectField,
  TEXTAREA_CLASS
} from "./SettingsPrimitives";

interface ProjectAiSettingsCardProps {
  configPath: string;
  workspaceRootName: string;
  cursorModels?: CursorModel[];
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  prdPrompt: string;
  specPrompt: string;
  executionAgentDescription: string;
  onModelChange: (model: ModelId) => void;
  onReasoningChange: (reasoning: ReasoningProfileId) => void;
  onPrdPromptChange: (value: string) => void;
  onSpecPromptChange: (value: string) => void;
  onExecutionAgentDescriptionChange: (value: string) => void;
}

export const ProjectAiSettingsCard = memo(function ProjectAiSettingsCard({
  configPath,
  workspaceRootName,
  cursorModels = [],
  selectedModel,
  selectedReasoning,
  prdPrompt,
  specPrompt,
  executionAgentDescription,
  onModelChange,
  onReasoningChange,
  onPrdPromptChange,
  onSpecPromptChange,
  onExecutionAgentDescriptionChange
}: ProjectAiSettingsCardProps) {
  const modelOptions = getModelOptions(undefined, cursorModels);
  const reasoningOptions = getReasoningOptions(selectedModel, cursorModels);

  return (
    <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
      <div className={SETTINGS_CARD_HEADER_CLASS}>
        <SettingsSectionHeader icon={<Brain className="size-5" />} title="AI Engine" />
      </div>
      <Card.Content className={SETTINGS_CARD_BODY_CLASS}>
        <ScopedPathReference
          path={configPath}
          prefix={<span>Saved in</span>}
          workspaceRootName={workspaceRootName}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <SettingsSelectField
            label="Default model"
            onSelectionChange={onModelChange}
            options={modelOptions}
            selectedKey={selectedModel}
          />

          <SettingsSelectField
            label="Reasoning profile"
            onSelectionChange={onReasoningChange}
            options={reasoningOptions}
            selectedKey={selectedReasoning}
          />
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2" htmlFor="settings-prd-agent-description">
            <span className={FIELD_LABEL_CLASS}>PRD agent description</span>
            <TextArea
              className={TEXTAREA_CLASS}
              id="settings-prd-agent-description"
              onChange={(event) => onPrdPromptChange(event.target.value)}
              value={prdPrompt}
            />
          </label>

          <label className="grid gap-2" htmlFor="settings-spec-agent-description">
            <span className={FIELD_LABEL_CLASS}>Spec agent description</span>
            <TextArea
              className={TEXTAREA_CLASS}
              id="settings-spec-agent-description"
              onChange={(event) => onSpecPromptChange(event.target.value)}
              value={specPrompt}
            />
          </label>

          <label className="grid gap-2" htmlFor="settings-execution-agent-description">
            <span className={FIELD_LABEL_CLASS}>Execution agent description</span>
            <TextArea
              className={TEXTAREA_CLASS}
              id="settings-execution-agent-description"
              onChange={(event) => onExecutionAgentDescriptionChange(event.target.value)}
              value={executionAgentDescription}
            />
          </label>
        </div>

        <div className={`${SETTINGS_SURFACE_CLASS} px-4 py-4`}>
          <div className="flex items-start gap-3">
            <Spark className="mt-1 size-4 shrink-0 text-[var(--success)]" />
            <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
              The empty-state prompt fields append the user note after these saved Cursor agent
              descriptions before the SDK run starts.
            </p>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
});
