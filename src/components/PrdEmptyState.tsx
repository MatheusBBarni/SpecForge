import { Page } from "iconoir-react";
import { memo } from "react";

import { DocumentEmptyState } from "./DocumentEmptyState";

interface PrdEmptyStateProps {
  prompt: string;
  error: string;
  helperText: string;
  isGenerating: boolean;
  canGenerate: boolean;
  templatePrompt: string;
  configPath: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
}

export const PrdEmptyState = memo(function PrdEmptyState({
  prompt,
  error,
  helperText,
  isGenerating,
  canGenerate,
  templatePrompt,
  configPath,
  onPromptChange,
  onGenerate
}: PrdEmptyStateProps) {
  return (
    <DocumentEmptyState
      description="Load an existing PRD or generate a first-pass PRD from the saved project prompt plus your note."
      heading="No PRD file detected"
      icon={<Page className="size-6" />}
    >
      <textarea
        className="min-h-24 w-full flex-none resize-none rounded-lg border border-[var(--border-soft)] bg-black/20 px-4 py-3 font-[var(--font-mono)] text-sm leading-6 text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="Describe the product, the user problem, goals, constraints, timeline, or anything else the base PRD prompt should know."
        value={prompt}
      />

      <div className="grid gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-3">
        <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">
          Appended after the saved default PRD prompt from{" "}
          <code>{configPath || ".specforge/settings.json"}</code>.
        </p>
        <pre className="m-0 max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--border-soft)] bg-black/20 px-4 py-3 font-[var(--font-mono)] text-xs leading-5 text-[var(--text-main)]">
          {templatePrompt}
        </pre>
      </div>

      <div className="flex flex-col items-start gap-2">
        <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">{helperText}</p>
        <button
          className={`${PRIMARY_BUTTON_CLASS} ${!canGenerate ? "cursor-not-allowed opacity-50 hover:translate-y-0" : ""}`}
          disabled={!canGenerate}
          onClick={onGenerate}
          type="button"
        >
          <Page className="size-5" />
          {isGenerating ? "Generating..." : "Generate PRD"}
        </button>
      </div>

      {error ? <p className="m-0 text-sm leading-6 text-[var(--danger)]">{error}</p> : null}
    </DocumentEmptyState>
  );
});

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-4 py-3 font-semibold text-[#15131c] transition hover:-translate-y-0.5 hover:opacity-95";
