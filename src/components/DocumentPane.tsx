import { memo, useEffect, useState, type ChangeEvent, type ReactNode } from "react";

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
  const [renderedPreviewContent, setRenderedPreviewContent] = useState(() =>
    mode === "preview" ? content : ""
  );
  const showPreviewPlaceholder = mode === "preview" && renderedPreviewContent !== content;

  useEffect(() => {
    if (mode !== "preview" || renderedPreviewContent === content) {
      return;
    }

    return schedulePreviewRender(() => {
      setRenderedPreviewContent(content);
    });
  }, [content, mode, renderedPreviewContent]);

  return (
    <article
      className={`flex min-h-0 flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 ${
        className ?? ""
      }`}
    >
      {children}

      {mode === "preview" ? (
        <div className="min-h-0 overflow-auto pr-1">
          {showPreviewPlaceholder ? (
            <PreviewPlaceholder />
          ) : (
            <MarkdownDocument content={renderedPreviewContent} />
          )}
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

function schedulePreviewRender(callback: () => void) {
  let timeoutId: number | null = null;
  const frameId = window.requestAnimationFrame(() => {
    timeoutId = window.setTimeout(callback, 0);
  });

  return () => {
    window.cancelAnimationFrame(frameId);

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  };
}

function PreviewPlaceholder() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center rounded-[1rem] border border-[var(--border-soft)] bg-black/10 px-4 py-6">
      <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">Preparing preview...</p>
    </div>
  );
}
