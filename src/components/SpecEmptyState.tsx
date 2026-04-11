import { Spark } from "iconoir-react";
import { memo } from "react";

import { DocumentEmptyState } from "./DocumentEmptyState";

interface SpecEmptyStateProps {
  prompt: string;
  error: string;
  helperText: string;
  isGenerating: boolean;
  canGenerate: boolean;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
}

export const SpecEmptyState = memo(function SpecEmptyState({
  prompt,
  error,
  helperText,
  isGenerating,
  canGenerate,
  onPromptChange,
  onGenerate
}: SpecEmptyStateProps) {
  return (
    <DocumentEmptyState
      description="Load an existing spec or use the current PRD plus a short brief to draft a fresh technical specification for this workspace."
      heading="No spec file detected"
      icon={<Spark className="size-6" />}
    >
        <textarea
          className="min-h-[10rem] w-full flex-none resize-none rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-4 font-[var(--font-mono)] text-[15px] leading-6 text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Tell the AI about architecture, integrations, constraints, edge cases, or anything the PRD does not spell out."
          value={prompt}
        />

        <div className="flex flex-col items-start gap-3">
          <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">{helperText}</p>
          <button
            className={`${PRIMARY_BUTTON_CLASS} ${!canGenerate ? "cursor-not-allowed opacity-50 hover:translate-y-0" : ""}`}
            disabled={!canGenerate}
            onClick={onGenerate}
            type="button"
          >
            <Spark className="size-5" />
            {isGenerating ? "Generating..." : "Generate Spec"}
          </button>
        </div>

        {error ? <p className="m-0 text-sm leading-6 text-[var(--danger)]">{error}</p> : null}
    </DocumentEmptyState>
  );
});

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-4 py-3 font-semibold text-[#15131c] transition hover:-translate-y-0.5 hover:opacity-95";
