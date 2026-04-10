import { Spark } from "iconoir-react";
import { memo } from "react";

interface SpecEmptyStateProps {
  title: string;
  prompt: string;
  error: string;
  helperText: string;
  isGenerating: boolean;
  canGenerate: boolean;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
}

export const SpecEmptyState = memo(function SpecEmptyState({
  title,
  prompt,
  error,
  helperText,
  isGenerating,
  canGenerate,
  onPromptChange,
  onGenerate
}: SpecEmptyStateProps) {
  return (
    <article className="flex min-h-0 flex-col gap-3 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
      <div className="min-w-0">
        <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
          Technical Spec
        </p>
        <h2 className="m-0 truncate text-lg font-semibold text-[var(--text-main)]">{title}</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-start gap-4 overflow-auto rounded-[1rem] border border-dashed border-[var(--border-soft)] bg-black/10 p-5">
        <div className="flex items-start gap-2.5">
          <span className="mt-1 shrink-0 text-[var(--accent-2)]">
            <Spark />
          </span>
          <div className="grid gap-1.5">
            <h3 className="m-0 text-lg font-semibold text-[var(--text-main)]">
              No spec file detected
            </h3>
            <p className="m-0 max-w-[34rem] text-sm leading-6 text-[var(--text-subtle)]">
              Use the current PRD plus a short brief to draft a fresh technical specification for
              this workspace.
            </p>
          </div>
        </div>

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
      </div>
    </article>
  );
});

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-4 py-3 font-semibold text-[#15131c] transition hover:-translate-y-0.5 hover:opacity-95";
