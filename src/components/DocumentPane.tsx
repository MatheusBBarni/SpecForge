import { memo, type ChangeEvent } from "react";

import { MarkdownDocument } from "./MarkdownDocument";
import type { PaneMode } from "../types";

interface DocumentPaneProps {
  eyebrow: string;
  title: string;
  content: string;
  mode: PaneMode;
  onModeChange: (mode: PaneMode) => void;
  onChange: (value: string) => void;
  onSelect?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

export const DocumentPane = memo(function DocumentPane({
  eyebrow,
  title,
  content,
  mode,
  onModeChange,
  onChange,
  onSelect
}: DocumentPaneProps) {
  return (
    <article className="flex min-h-0 flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
            {eyebrow}
          </p>
          <h2 className="m-0 truncate text-lg font-semibold text-[var(--text-main)]">{title}</h2>
        </div>

        <div className="inline-flex rounded-full border border-[var(--border-soft)] bg-white/4 p-1">
          <ModeButton
            active={mode === "preview"}
            label="Preview"
            onClick={() => onModeChange("preview")}
          />
          <ModeButton
            active={mode === "edit"}
            label="Edit"
            onClick={() => onModeChange("edit")}
          />
        </div>
      </div>

      {mode === "preview" ? (
        <div className="min-h-0 overflow-auto pr-1">
          <MarkdownDocument content={content} />
        </div>
      ) : (
        <textarea
          className="min-h-0 flex-1 resize-none rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-4 font-[var(--font-mono)] text-[15px] leading-7 text-[var(--text-main)]"
          onChange={(event) => onChange(event.target.value)}
          onSelect={onSelect}
          value={content}
        />
      )}
    </article>
  );
});

interface ModeButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function ModeButton({ active, label, onClick }: ModeButtonProps) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-[linear-gradient(135deg,rgba(189,147,249,0.34),rgba(139,233,253,0.24))] text-[var(--text-main)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_10px_24px_-18px_rgba(139,233,253,0.45)]"
          : "text-[var(--text-muted)] hover:-translate-y-0.5"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
