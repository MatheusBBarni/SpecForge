import {
  CheckCircle,
  CodeBracketsSquare,
  Terminal,
  XmarkCircle
} from "iconoir-react";
import { memo } from "react";

import { DiffPreview } from "./DiffPreview";
import type { AgentStatus } from "../types";

interface ExecutionPanelProps {
  agentStatus: AgentStatus;
  terminalOutput: string[];
  executionSummary: string | null;
  visibleDiff: string;
  onApproveExecutionGate: () => void;
  onEmergencyStop: () => void;
}

export const ExecutionPanel = memo(function ExecutionPanel({
  agentStatus,
  terminalOutput,
  executionSummary,
  visibleDiff,
  onApproveExecutionGate,
  onEmergencyStop
}: ExecutionPanelProps) {
  return (
    <div className="grid h-full min-h-0 gap-4 grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.9fr)] xl:grid-rows-1">
      <section className="flex min-h-0 flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-3 text-[var(--text-main)]">
          <Terminal className="size-5 text-[var(--accent-2)]" />
          <span className="text-sm font-semibold uppercase tracking-[0.08em]">
            Execution Stream
          </span>
        </div>

        <div className="grid min-h-0 flex-1 gap-1 overflow-auto rounded-[1rem] border border-white/6 bg-black/25 p-4 font-[var(--font-mono)] text-sm leading-7 text-[var(--text-main)]">
          {terminalOutput.length === 0 ? (
            <p className="m-0 whitespace-pre-wrap text-[var(--text-subtle)]">
              Approve the spec, then start a build to stream the agent loop here.
            </p>
          ) : (
            terminalOutput.map((line, index) => (
              <div className="whitespace-pre-wrap" key={`${line}-${index}`}>
                {line}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {agentStatus === "awaiting_approval" ? (
            <button
              className={PRIMARY_BUTTON_CLASS}
              onClick={onApproveExecutionGate}
              type="button"
            >
              <CheckCircle className="size-5" />
              Approve Gate
            </button>
          ) : null}

          <button className={DANGER_BUTTON_CLASS} onClick={onEmergencyStop} type="button">
            <XmarkCircle className="size-5" />
            Emergency Stop
          </button>
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-3 text-[var(--text-main)]">
          <CodeBracketsSquare className="size-5 text-[var(--accent-2)]" />
          <span className="text-sm font-semibold uppercase tracking-[0.08em]">
            Approval Diff
          </span>
        </div>

        <DiffPreview diff={visibleDiff} />

        <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
          {executionSummary ||
            "Diff output stays visible across approval gates so the next mutation can be reviewed in context."}
        </p>
      </section>
    </div>
  );
});

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-4 py-3 font-semibold text-[#15131c] transition hover:opacity-95";

const DANGER_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[rgba(255,85,85,0.32)] bg-[rgba(255,85,85,0.16)] px-4 py-3 font-medium text-[var(--danger)] transition hover:-translate-y-0.5";
