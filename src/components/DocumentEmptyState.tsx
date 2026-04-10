import { memo, type ReactNode } from "react";

import { DocumentActionBar } from "./DocumentActionBar";
import type { PaneMode } from "../types";

interface DocumentEmptyStateProps {
  eyebrow: string;
  title: string;
  mode: PaneMode;
  loadLabel: string;
  heading: string;
  description: string;
  icon: ReactNode;
  children?: ReactNode;
  headerAction?: ReactNode;
  onLoad: () => void;
  onModeChange: (mode: PaneMode) => void;
}

export const DocumentEmptyState = memo(function DocumentEmptyState({
  eyebrow,
  title,
  mode,
  loadLabel,
  heading,
  description,
  icon,
  children,
  headerAction,
  onLoad,
  onModeChange
}: DocumentEmptyStateProps) {
  return (
    <article className="flex min-h-0 flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
            {eyebrow}
          </p>
          <h2 className="m-0 truncate text-lg font-semibold text-[var(--text-main)]">{title}</h2>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <DocumentActionBar
            loadLabel={loadLabel}
            mode={mode}
            onLoad={onLoad}
            onModeChange={onModeChange}
          />
          {headerAction}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-start gap-4 overflow-auto rounded-[1rem] border border-dashed border-[var(--border-soft)] bg-black/10 p-5">
        <div className="flex items-start gap-2.5">
          <span className="mt-1 shrink-0 text-[var(--accent-2)]">{icon}</span>
          <div className="grid gap-1.5">
            <h3 className="m-0 text-lg font-semibold text-[var(--text-main)]">{heading}</h3>
            <p className="m-0 max-w-[34rem] text-sm leading-6 text-[var(--text-subtle)]">
              {description}
            </p>
          </div>
        </div>

        {children}
      </div>
    </article>
  );
});
