import {
  CodeBracketsSquare,
  Flask,
  Folder,
  Page,
  Settings
} from "iconoir-react";
import { NavLink } from "react-router-dom";

export function AppRail() {
  return (
    <aside className="sticky top-0 z-30 flex items-center justify-center gap-3 border-b border-[var(--border-strong)] bg-[var(--bg-panel-strong)]/95 px-4 py-4 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:w-[72px] lg:flex-col lg:justify-start lg:gap-3 lg:border-r lg:border-b-0 lg:px-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),#ff79c6)] text-sm font-extrabold tracking-[0.18em] text-[#11111b] shadow-[0_12px_26px_-18px_rgba(189,147,249,0.65)]">
        SF
      </div>

      <NavLink className={getRailLinkClassName} end to="/" title="Review workspace">
        <Page className="size-5" />
      </NavLink>

      <button className={RAIL_BUTTON_CLASS} title="Code surfaces" type="button">
        <CodeBracketsSquare className="size-5" />
      </button>

      <button className={RAIL_BUTTON_CLASS} title="Experiments" type="button">
        <Flask className="size-5" />
      </button>

      <button className={RAIL_BUTTON_CLASS} title="Workspace" type="button">
        <Folder className="size-5" />
      </button>

      <div className="hidden flex-1 lg:block" />

      <NavLink className={getRailLinkClassName} to="/settings" title="Settings">
        <Settings className="size-5" />
      </NavLink>
    </aside>
  );
}

const RAIL_BUTTON_CLASS =
  "grid size-10 place-items-center rounded-2xl border border-transparent bg-transparent text-[var(--text-subtle)] transition hover:-translate-y-0.5 hover:border-[var(--border-soft)] hover:bg-white/5 hover:text-[var(--text-main)]";

function getRailLinkClassName({ isActive }: { isActive: boolean }) {
  return `${RAIL_BUTTON_CLASS} ${isActive ? "border-[var(--border-soft)] bg-white/5 text-[var(--text-main)]" : ""}`;
}
