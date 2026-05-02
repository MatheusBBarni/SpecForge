import { CheckCircle, WarningTriangle } from "iconoir-react";
import { memo } from "react";

import type { CliStatus } from "../types";

interface CliHealthCardProps {
  entry: CliStatus;
}

export const CliHealthCard = memo(function CliHealthCard({ entry }: CliHealthCardProps) {
  return (
    <article className="grid min-h-[6.5rem] content-start gap-2 rounded border border-[var(--border-soft)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-center gap-3">
        {entry.status === "found" ? (
          <CheckCircle className="size-4 shrink-0 text-[var(--success)]" />
        ) : (
          <WarningTriangle className="size-4 shrink-0 text-[var(--warning)]" />
        )}
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-semibold text-[var(--text-main)]">
            {entry.name}
          </h3>
          <p className="m-0 text-xs text-[var(--text-subtle)]">{formatCliHealth(entry.status)}</p>
        </div>
      </div>
      <p className="m-0 line-clamp-2 text-xs leading-5 text-[var(--text-subtle)]">{entry.detail}</p>
    </article>
  );
});

function formatCliHealth(status: CliStatus["status"]) {
  if (status === "found") {
    return "Ready";
  }

  if (status === "unauthorized") {
    return "Needs authentication";
  }

  if (status === "unavailable") {
    return "Unavailable";
  }

  return "Missing";
}
