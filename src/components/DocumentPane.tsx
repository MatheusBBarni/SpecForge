import { memo, type ChangeEvent, type ReactNode } from "react";

import { MarkdownDocument } from "./MarkdownDocument";
import type { PaneMode } from "../types";

interface DocumentPaneProps {
  content: string;
  mode: PaneMode;
  className?: string;
  children?: ReactNode;
  onChange: (value: string) => void;
  onSelect?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

export const DocumentPane = memo(function DocumentPane({
  content,
  mode,
  className,
  children,
  onChange,
  onSelect
}: DocumentPaneProps) {
  return (
    <article
      className={`flex min-h-0 flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 ${
        className ?? ""
      }`}
    >
      {children}

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
