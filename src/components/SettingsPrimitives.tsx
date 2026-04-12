import {
  Label,
  ListBox,
  Select
} from "@heroui/react";
import { useCallback, type ReactNode } from "react";

import type { SelectOption } from "../lib/agentConfig";

interface SettingsSelectFieldProps<Value extends string> {
  label: string;
  selectedKey: Value;
  options: Array<SelectOption<Value>>;
  onSelectionChange: (value: Value) => void;
}

interface ScopedPathReferenceProps {
  path: string;
  workspaceRootName?: string;
  prefix?: ReactNode;
  fallbackPath?: string;
}

interface SettingsSectionHeaderProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
}

export function SettingsSelectField<Value extends string>({
  label,
  selectedKey,
  options,
  onSelectionChange
}: SettingsSelectFieldProps<Value>) {
  const handleSelectionChange = useCallback(
    (value: string | number | null) => {
      if (value !== null) {
        onSelectionChange(String(value) as Value);
      }
    },
    [onSelectionChange]
  );

  return (
    <Select
      className="flex w-full min-w-0 flex-col gap-2"
      onChange={handleSelectionChange}
      value={selectedKey}
    >
      <Label className={FIELD_LABEL_CLASS}>{label}</Label>
      <Select.Trigger className={SELECT_TRIGGER_CLASS}>
        <Select.Value className="min-w-0 flex-1 truncate text-left text-[15px] text-[var(--text-main)]" />
        <Select.Indicator className="size-4 shrink-0 text-[var(--text-subtle)]" />
      </Select.Trigger>
      <Select.Popover className="min-w-64 rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)] backdrop-blur-xl">
        <ListBox className="outline-none">
          {options.map((option) => (
            <ListBox.Item
              className={LISTBOX_ITEM_CLASS}
              id={option.value}
              key={option.value}
              textValue={option.label}
            >
              <div className="flex flex-col gap-1">
                <span>{option.label}</span>
                {option.hint ? (
                  <small className="text-sm leading-5 text-[var(--text-subtle)]">
                    {option.hint}
                  </small>
                ) : null}
              </div>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function ScopedPathReference({
  path,
  workspaceRootName,
  prefix,
  fallbackPath = ".specforge/settings.json"
}: ScopedPathReferenceProps) {
  const displayPath = path.trim() || fallbackPath;

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--text-subtle)]">
      {prefix}
      {workspaceRootName ? (
        <span className="inline-flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2.5 py-1 font-medium text-[var(--text-main)]">
          {workspaceRootName}
        </span>
      ) : null}
      <code className="rounded-full border border-[var(--border-soft)] bg-black/15 px-2.5 py-1 text-xs text-[var(--text-subtle)]">
        {displayPath}
      </code>
    </span>
  );
}

export function SettingsSectionHeader({
  icon,
  title,
  description
}: SettingsSectionHeaderProps) {
  return (
    <div className="flex min-w-0 items-start gap-3 text-[var(--text-main)]">
      <span className="mt-0.5 shrink-0 text-[var(--accent-2)]">{icon}</span>
      <div className="min-w-0">
        <h2 className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-main)]">
          {title}
        </h2>
        {description ? (
          <p className="mb-0 mt-2 text-sm leading-6 text-[var(--text-subtle)]">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export const SETTINGS_PANEL_CLASS =
  "border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-[var(--shadow)] backdrop-blur-[30px]";

export const SETTINGS_SURFACE_CLASS =
  "rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)]/85";

export const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

export const INPUT_CLASS =
  "w-full rounded-[1rem] border border-[var(--border-soft)] bg-black/15 px-4 py-3 text-[15px] text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]";

export const TEXTAREA_CLASS =
  "min-h-[10rem] w-full resize-y rounded-[1rem] border border-[var(--border-soft)] bg-black/15 px-4 py-4 font-[var(--font-mono)] text-[15px] leading-6 text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]";

export const SELECT_TRIGGER_CLASS =
  "min-h-[3rem] rounded-[1rem] border border-[var(--border-soft)] bg-black/15 px-4 text-[var(--text-main)] transition focus:border-[var(--accent)]";

export const LISTBOX_ITEM_CLASS =
  "cursor-pointer rounded-[0.95rem] px-3 py-3 text-[var(--text-main)] outline-none transition data-[focused=true]:bg-white/8";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white/5 px-4 py-3 font-medium text-[var(--text-main)] transition hover:-translate-y-0.5 hover:bg-white/8";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-4 py-3 font-semibold text-[#15131c] transition hover:-translate-y-0.5 hover:opacity-95";
