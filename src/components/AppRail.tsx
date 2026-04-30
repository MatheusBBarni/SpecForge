import {
  ChatBubble,
  Folder,
  Page,
  Settings
} from "iconoir-react";
import { NavLink } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";

import appIconUrl from "../../src-tauri/icons/icon.png";
import { useWorkspaceUiStore } from "../store/useWorkspaceUiStore";

interface AppRailProps {
  hasProjectConfigured: boolean;
}

export function AppRail({ hasProjectConfigured }: AppRailProps) {
  const { workspaceRootName, workspaceRootPath } = useWorkspaceUiStore(
    useShallow((state) => ({
      workspaceRootName: state.projectRootName,
      workspaceRootPath: state.projectRootPath
    }))
  );
  const projectLabel = workspaceRootName || "No project selected";

  return (
    <aside className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border-strong)] bg-[var(--bg-nav)] px-4 py-3 lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col lg:items-stretch lg:border-r lg:border-b-0 lg:px-3 lg:py-6">
      <div className="flex min-w-0 items-center gap-3 lg:mb-5 lg:px-3">
        <img alt="" className="size-8 shrink-0 rounded-md object-contain" src={appIconUrl} />
        <div className="hidden min-w-0 lg:block">
          <div className="truncate text-lg font-bold text-[var(--accent)]">
            SpecForge
          </div>
          <div className="truncate text-xs text-[var(--text-muted)]" title={workspaceRootPath || projectLabel}>
            {projectLabel}
          </div>
        </div>
      </div>

      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex-col lg:items-stretch lg:overflow-visible">
        <NavLink className={getRailLinkClassName} end to="/" title="Projects">
          <Folder className="size-5 shrink-0" />
          <span className="hidden truncate lg:inline">Projects</span>
        </NavLink>

        {hasProjectConfigured ? (
          <NavLink className={getRailLinkClassName} to="/review" title="Review workspace">
            <Page className="size-5 shrink-0" />
            <span className="hidden truncate lg:inline">Review</span>
          </NavLink>
        ) : (
          <span
            aria-hidden="true"
            className={`${RAIL_LINK_CLASS} cursor-not-allowed opacity-40`}
            title="Finish project setup first"
          >
            <Page className="size-5 shrink-0" />
            <span className="hidden truncate lg:inline">Review</span>
          </span>
        )}

        {hasProjectConfigured ? (
          <NavLink className={getRailLinkClassName} to="/chat" title="Chat workspace">
            <ChatBubble className="size-5 shrink-0" />
            <span className="hidden truncate lg:inline">Chat</span>
          </NavLink>
        ) : (
          <span
            aria-hidden="true"
            className={`${RAIL_LINK_CLASS} cursor-not-allowed opacity-40`}
            title="Finish project setup first"
          >
            <ChatBubble className="size-5 shrink-0" />
            <span className="hidden truncate lg:inline">Chat</span>
          </span>
        )}

        <NavLink className={getRailLinkClassName} to="/settings" title="Settings">
          <Settings className="size-5 shrink-0" />
          <span className="hidden truncate lg:inline">Settings</span>
        </NavLink>
      </nav>
    </aside>
  );
}

const RAIL_LINK_CLASS =
  "flex min-h-10 items-center justify-center gap-3 rounded-lg border-r-2 border-transparent px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-nav-hover)] hover:text-[var(--text-main)] lg:justify-start";

function getRailLinkClassName({ isActive }: { isActive: boolean }) {
  return `${RAIL_LINK_CLASS} ${
    isActive
      ? "border-[var(--accent)] bg-[var(--bg-nav-active)] font-semibold text-[var(--accent)]"
      : ""
  }`;
}
