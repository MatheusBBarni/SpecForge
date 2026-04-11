import { memo, type ReactNode } from "react";

interface DocumentEmptyStateProps {
  heading: string;
  description: string;
  icon: ReactNode;
  children?: ReactNode;
}

export const DocumentEmptyState = memo(function DocumentEmptyState({
  heading,
  description,
  icon,
  children
}: DocumentEmptyStateProps) {
  return (
    <article className="flex min-h-0 flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
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
