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
    <div className="inline-flex flex-wrap items-center rounded-full border border-[var(--border-soft)] bg-white/4 p-1">
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
        className="rounded-full bg-white/7 px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:-translate-y-0.5 hover:bg-white/10"
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
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-[linear-gradient(135deg,rgba(189,147,249,0.34),rgba(139,233,253,0.24))] text-[var(--text-main)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_10px_24px_-18px_rgba(139,233,253,0.45)]"
          : "text-[var(--text-muted)] hover:-translate-y-0.5"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
