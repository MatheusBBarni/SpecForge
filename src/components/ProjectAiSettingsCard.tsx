import {
  Card,
  TextArea
} from "@heroui/react";
import { Brain, Spark } from "iconoir-react";
import { memo } from "react";

import { getModelOptions, getReasoningOptions } from "../lib/agentConfig";
import type { ModelId, ReasoningProfileId } from "../types";
import {
  FIELD_LABEL_CLASS,
  ScopedPathReference,
  SETTINGS_PANEL_CLASS,
  SETTINGS_SURFACE_CLASS,
  SettingsSectionHeader,
  SettingsSelectField,
  TEXTAREA_CLASS
} from "./SettingsPrimitives";

interface ProjectAiSettingsCardProps {
  configPath: string;
  workspaceRootName: string;
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
  const modelOptions = getModelOptions();
  const reasoningOptions = getReasoningOptions(selectedModel);

  return (
    <Card className={`${SETTINGS_PANEL_CLASS} rounded-[1.5rem]`}>
      <Card.Content className="grid gap-5 px-5 py-5">
        <SettingsSectionHeader icon={<Brain className="size-5" />} title="AI Defaults" />
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
          <label className="grid gap-2">
            <span className={FIELD_LABEL_CLASS}>PRD agent description</span>
            <TextArea
              className={TEXTAREA_CLASS}
              onChange={(event) => onPrdPromptChange(event.target.value)}
              value={prdPrompt}
            />
            <ScopedPathReference
              path={configPath}
              prefix={<span>Saved in</span>}
              workspaceRootName={workspaceRootName}
            />
          </label>

          <label className="grid gap-2">
            <span className={FIELD_LABEL_CLASS}>Spec agent description</span>
            <TextArea
              className={TEXTAREA_CLASS}
              onChange={(event) => onSpecPromptChange(event.target.value)}
              value={specPrompt}
            />
            <ScopedPathReference
              path={configPath}
              prefix={<span>Saved in</span>}
              workspaceRootName={workspaceRootName}
            />
          </label>

          <label className="grid gap-2">
            <span className={FIELD_LABEL_CLASS}>Execution agent description</span>
            <TextArea
              className={TEXTAREA_CLASS}
              onChange={(event) => onExecutionAgentDescriptionChange(event.target.value)}
              value={executionAgentDescription}
            />
            <ScopedPathReference
              path={configPath}
              prefix={<span>Saved in</span>}
              workspaceRootName={workspaceRootName}
            />
          </label>
        </div>

        <div className={`${SETTINGS_SURFACE_CLASS} px-4 py-4`}>
          <div className="flex items-start gap-3">
            <Spark className="mt-1 size-4 shrink-0 text-[var(--accent-2)]" />
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
