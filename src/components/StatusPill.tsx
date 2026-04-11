import { CheckCircle, WarningTriangle } from "iconoir-react";

import { formatAgentStatus } from "../lib/appShell";
import type { AgentStatus } from "../types";

interface StatusPillProps {
  status: AgentStatus;
}

const STATUS_CLASS_MAP: Record<AgentStatus, string> = {
  idle: "text-[var(--text-subtle)]",
  generating_prd: "text-[var(--accent-2)]",
  generating_spec: "text-[var(--accent-2)]",
  executing: "text-[var(--accent-2)]",
  awaiting_approval: "text-[var(--warning)]",
  halted: "text-[var(--danger)]",
  error: "text-[var(--danger)]",
  completed: "text-[var(--success)]"
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-2 text-sm font-medium ${STATUS_CLASS_MAP[status]}`}
    >
      <StatusIcon status={status} />
      {formatAgentStatus(status)}
    </span>
  );
}

function StatusIcon({ status }: StatusPillProps) {
  if (status === "completed") {
    return <CheckCircle className="size-4" />;
  }

  if (status === "awaiting_approval") {
    return <span className="size-2 rounded-full bg-current" />;
  }

  if (status === "error" || status === "halted") {
    return <WarningTriangle className="size-4" />;
  }

  return <span className="size-2 rounded-full bg-current" />;
}
