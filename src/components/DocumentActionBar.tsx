import { memo } from "react";

import type { PaneMode } from "../types";

interface DocumentActionBarProps {
  mode: PaneMode;
  loadLabel: string;
  showModeButtons?: boolean;
  onLoad: () => void;
  onModeChange: (mode: PaneMode) => void;
}

export const DocumentActionBar = memo(function DocumentActionBar({
  mode,
  loadLabel,
  showModeButtons = true,
  onLoad,
  onModeChange
}: DocumentActionBarProps) {
  return (
    <div className="inline-flex flex-wrap items-center rounded-lg border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1">
      {showModeButtons ? (
        <ModeButton
          active={mode === "preview"}
          label="Preview"
          onClick={() => onModeChange("preview")}
        />
      ) : null}
      {showModeButtons ? (
        <ModeButton
          active={mode === "edit"}
          label="Edit"
          onClick={() => onModeChange("edit")}
        />
      ) : null}
      <button
        className="rounded px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-nav-active)] hover:text-[var(--accent)]"
        onClick={onLoad}
        type="button"
      >
        {loadLabel}
      </button>
    </div>
  );
});

interface ModeButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function ModeButton({ active, label, onClick }: ModeButtonProps) {
  return (
    <button
      aria-pressed={active}
      className={`rounded px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-[var(--border-soft)] text-[var(--text-main)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
