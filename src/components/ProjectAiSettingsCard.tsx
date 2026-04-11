import { Brain, Spark } from "iconoir-react";
import { memo } from "react";

import { getModelOptions, getReasoningOptions } from "../lib/agentConfig";
import type { ModelId, ReasoningProfileId } from "../types";

interface ProjectAiSettingsCardProps {
  configPath: string;
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  prdPrompt: string;
  specPrompt: string;
  onModelChange: (model: ModelId) => void;
  onReasoningChange: (reasoning: ReasoningProfileId) => void;
  onPrdPromptChange: (value: string) => void;
  onSpecPromptChange: (value: string) => void;
}

export const ProjectAiSettingsCard = memo(function ProjectAiSettingsCard({
  configPath,
  selectedModel,
  selectedReasoning,
  prdPrompt,
  specPrompt,
  onModelChange,
  onReasoningChange,
  onPrdPromptChange,
  onSpecPromptChange
}: ProjectAiSettingsCardProps) {
  const modelOptions = getModelOptions();
  const reasoningOptions = getReasoningOptions(selectedModel);

  return (
    <article className={PANEL_CLASS}>
      <div className="flex items-center gap-3 text-[var(--text-main)]">
        <Brain className="size-5 text-[var(--accent-2)]" />
        <span className="text-sm font-semibold uppercase tracking-[0.08em]">
          AI Defaults
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className={FIELD_LABEL_CLASS}>Default model</span>
          <select
            className={INPUT_CLASS}
            onChange={(event) => onModelChange(event.target.value as ModelId)}
            value={selectedModel}
          >
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className={FIELD_LABEL_CLASS}>Reasoning profile</span>
          <select
            className={INPUT_CLASS}
            onChange={(event) => onReasoningChange(event.target.value as ReasoningProfileId)}
            value={selectedReasoning}
          >
            {reasoningOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-2">
          <span className={FIELD_LABEL_CLASS}>Default PRD prompt</span>
          <textarea
            className={TEXTAREA_CLASS}
            onChange={(event) => onPrdPromptChange(event.target.value)}
            value={prdPrompt}
          />
          <p className={HELPER_CLASS}>
            Saved in <code>{configPath || ".specforge/settings.json"}</code>.
          </p>
        </label>

        <label className="grid gap-2">
          <span className={FIELD_LABEL_CLASS}>Default spec prompt</span>
          <textarea
            className={TEXTAREA_CLASS}
            onChange={(event) => onSpecPromptChange(event.target.value)}
            value={specPrompt}
          />
          <p className={HELPER_CLASS}>
            Saved in <code>{configPath || ".specforge/settings.json"}</code>.
          </p>
        </label>
      </div>

      <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4">
        <div className="flex items-start gap-3">
          <Spark className="mt-1 size-4 shrink-0 text-[var(--accent-2)]" />
          <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
            The empty-state prompt fields append the user note after these saved defaults before
            the selected CLI is invoked.
          </p>
        </div>
      </div>
    </article>
  );
});

const PANEL_CLASS =
  "grid gap-4 rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)] backdrop-blur-[30px]";

const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

const INPUT_CLASS =
  "w-full rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[15px] text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]";

const TEXTAREA_CLASS =
  "min-h-[12rem] w-full resize-y rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-4 font-[var(--font-mono)] text-[15px] leading-6 text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]";

const HELPER_CLASS =
  "m-0 text-sm leading-6 text-[var(--text-subtle)]";
