import { CheckCircle, WarningTriangle } from "iconoir-react";
import { memo } from "react";

import type { CliStatus } from "../types";

interface CliHealthCardProps {
  entry: CliStatus;
}

export const CliHealthCard = memo(function CliHealthCard({ entry }: CliHealthCardProps) {
  return (
    <article className="grid gap-3 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-3">
        {entry.status === "found" ? (
          <CheckCircle className="size-5 text-[var(--success)]" />
        ) : (
          <WarningTriangle className="size-5 text-[var(--warning)]" />
        )}
        <div>
          <h3 className="m-0 text-base font-semibold text-[var(--text-main)]">{entry.name}</h3>
          <p className="m-0 text-sm text-[var(--text-subtle)]">{formatCliHealth(entry.status)}</p>
        </div>
      </div>
      <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">{entry.detail}</p>
      {entry.path ? (
        <code className="rounded-[0.5rem] bg-white/5 px-2 py-1 font-[var(--font-mono)] text-[0.85rem] text-[var(--text-main)]">
          {entry.path}
        </code>
      ) : null}
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
