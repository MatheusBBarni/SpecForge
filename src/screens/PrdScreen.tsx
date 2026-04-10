import { PlaySolid } from "iconoir-react";
import type { ChangeEvent, ComponentProps, RefObject } from "react";

import { ControlColumn } from "../components/ControlColumn";
import { FloatingSearch } from "../components/FloatingSearch";
import { InspectorColumn } from "../components/InspectorColumn";
import { MainWorkspace } from "../components/MainWorkspace";
import { StatusPill } from "../components/StatusPill";
import type { AgentStatus } from "../types";

interface PrdScreenProps {
  agentStatus: AgentStatus;
  commandSearch: string;
  isSearchOpen: boolean;
  isSpecApproved: boolean;
  workspaceRootName: string;
  onCommandSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRefresh: () => void;
  onStartBuild: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  controlColumnProps: ComponentProps<typeof ControlColumn>;
  mainWorkspaceProps: ComponentProps<typeof MainWorkspace>;
  inspectorColumnProps: ComponentProps<typeof InspectorColumn>;
}

export function PrdScreen({
  agentStatus,
  commandSearch,
  isSearchOpen,
  isSpecApproved,
  workspaceRootName,
  onCommandSearchChange,
  onRefresh,
  onStartBuild,
  searchInputRef,
  controlColumnProps,
  mainWorkspaceProps,
  inspectorColumnProps
}: PrdScreenProps) {
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {isSearchOpen ? (
        <FloatingSearch
          inputRef={searchInputRef}
          onChange={onCommandSearchChange}
          value={commandSearch}
        />
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-4 pt-4 grid-rows-[auto_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] lg:px-5 lg:pb-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)_minmax(260px,320px)] xl:grid-rows-[auto_minmax(0,1fr)]">
        <div className="order-1 flex items-center justify-between gap-4 rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] px-4 py-4 shadow-[var(--shadow)] backdrop-blur-xl xl:col-[2/4] xl:row-[1] xl:justify-end">
          <div className="min-w-0 xl:mr-auto">
            <h1 className="m-0 text-lg font-semibold text-[var(--text-main)]">
              {workspaceRootName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <StatusPill status={agentStatus} />
            <button className={SECONDARY_BUTTON_CLASS} onClick={onRefresh} type="button">
              Refresh
            </button>
            <button
              className={`${PRIMARY_BUTTON_CLASS} ${!isSpecApproved ? "cursor-not-allowed opacity-50 hover:translate-y-0" : ""}`}
              disabled={!isSpecApproved}
              onClick={onStartBuild}
              type="button"
            >
              <PlaySolid className="size-5" />
              Start Build
            </button>
          </div>
        </div>

        <div className="order-2 flex min-h-0 overflow-hidden xl:col-[1] xl:row-[1/3]">
          <ControlColumn {...controlColumnProps} />
        </div>

        <div className="order-3 flex min-h-0 overflow-hidden xl:col-[2] xl:row-[2]">
          <MainWorkspace {...mainWorkspaceProps} />
        </div>

        <div className="order-4 flex min-h-0 overflow-hidden xl:col-[3] xl:row-[2]">
          <InspectorColumn {...inspectorColumnProps} />
        </div>
      </div>
    </section>
  );
}

const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white/5 px-4 py-3 font-medium text-[var(--text-main)] transition hover:-translate-y-0.5 hover:bg-white/8";

const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-4 py-3 font-semibold text-[#15131c] transition hover:-translate-y-0.5 hover:opacity-95";
