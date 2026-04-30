import type { EditorTab, WorkspaceTab } from "../types";

interface WorkspaceTabBarProps {
  activeTab: WorkspaceTab;
  openEditorTabs: EditorTab[];
  onActiveTabChange: (tab: WorkspaceTab) => void;
  onEditorTabClose: (path: string) => void;
}

export function WorkspaceTabBar({
  activeTab,
  openEditorTabs,
  onActiveTabChange,
  onEditorTabClose
}: WorkspaceTabBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--border-strong)] px-3 py-3">
      <WorkspaceBaseTab
        activeTab={activeTab}
        label="Review"
        onClick={() => onActiveTabChange("review")}
        tabId="review"
      />
      <WorkspaceBaseTab
        activeTab={activeTab}
        label="Execute"
        onClick={() => onActiveTabChange("execute")}
        tabId="execute"
      />

      {openEditorTabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <div
            className={`inline-flex max-w-[18rem] flex-none items-center gap-1 rounded border px-1 py-1 ${
              isActive
                ? "border-[var(--border-soft)] bg-[var(--bg-panel-strong)]"
                : "border-transparent bg-[var(--bg-surface)]"
            }`}
            key={tab.id}
          >
            <button
              className={`max-w-[14rem] truncate rounded px-3 py-2 text-sm transition hover:bg-[var(--bg-nav-active)] ${
                isActive ? "text-[var(--text-main)]" : "text-[var(--text-subtle)]"
              }`}
              onClick={() => onActiveTabChange(tab.id)}
              type="button"
            >
              {tab.title}
            </button>
            <button
              aria-label={`Close ${tab.title}`}
              className={`grid size-8 place-items-center rounded border border-[var(--border-soft)] text-sm font-bold uppercase transition hover:bg-[var(--bg-nav-active)] ${
                isActive ? "text-[var(--text-main)]" : "text-[var(--text-subtle)]"
              }`}
              onClick={() => onEditorTabClose(tab.path)}
              type="button"
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface WorkspaceBaseTabProps {
  tabId: WorkspaceTab;
  label: string;
  activeTab: WorkspaceTab;
  onClick: () => void;
}

function WorkspaceBaseTab({ tabId, label, activeTab, onClick }: WorkspaceBaseTabProps) {
  const isActive = activeTab === tabId;

  return (
    <button
      className={`rounded px-4 py-2 text-sm font-medium transition ${
        isActive
          ? "bg-[var(--bg-panel-strong)] text-[var(--accent)]"
          : "text-[var(--text-subtle)] hover:bg-[var(--bg-nav-active)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
