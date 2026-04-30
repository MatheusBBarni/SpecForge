import {
  Label,
  ListBox,
  Select
} from "@heroui/react";
import {
  type ChangeEvent,
  type ComponentProps,
  type Key,
  memo,
  type RefObject,
  useCallback
} from "react";

import { ControlColumn } from "../components/ControlColumn";
import { FloatingSearch } from "../components/FloatingSearch";
import { InspectorColumn } from "../components/InspectorColumn";
import { MainWorkspace } from "../components/MainWorkspace";
import { StatusPill } from "../components/StatusPill";
import { getModelOptions, getReasoningOptions } from "../lib/agentConfig";
import type { AgentStatus, AutonomyMode } from "../types";

interface PrdScreenProps {
  agentStatus: AgentStatus;
  commandSearch: string;
  isSearchOpen: boolean;
  isSpecApproved: boolean;
  workspaceRootName: string;
  onCommandSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenChat: () => void;
  onRefresh: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  controlColumnProps: ComponentProps<typeof ControlColumn>;
  mainWorkspaceProps: ComponentProps<typeof MainWorkspace>;
  inspectorColumnProps: ComponentProps<typeof InspectorColumn>;
}

export const PrdScreen = memo(function PrdScreen({
  agentStatus,
  commandSearch,
  isSearchOpen,
  isSpecApproved,
  workspaceRootName,
  onCommandSearchChange,
  onOpenChat,
  onRefresh,
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ReviewTopBar
          agentStatus={agentStatus}
          controlColumnProps={controlColumnProps}
          onOpenChat={onOpenChat}
          onRefresh={onRefresh}
          workspaceRootName={workspaceRootName}
        />

        <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
          <div className="flex min-h-0 min-w-0 w-full overflow-hidden border-r border-[var(--border-strong)]">
            <MainWorkspace {...mainWorkspaceProps} />
          </div>

          <div className="flex h-full min-h-0 min-w-0 w-full overflow-hidden">
            <InspectorColumn {...inspectorColumnProps} />
          </div>
        </div>
      </div>
    </section>
  );
});

function ReviewTopBar({
  agentStatus,
  controlColumnProps,
  onOpenChat,
  onRefresh,
  workspaceRootName
}: {
  agentStatus: AgentStatus;
  controlColumnProps: ComponentProps<typeof ControlColumn>;
  onOpenChat: () => void;
  onRefresh: () => void;
  workspaceRootName: string;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-strong)] bg-[var(--bg-panel)] px-4">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 truncate font-[var(--font-mono)] text-sm text-[var(--text-main)]">
          {workspaceRootName}
        </h1>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <StatusPill status={agentStatus} />
        <TopBarSelect
          label="Model"
          onChange={controlColumnProps.onModelChange}
          options={getModelOptions(
            controlColumnProps.configuredModelProviders.length === 1
              ? controlColumnProps.configuredModelProviders[0]
              : undefined,
            controlColumnProps.cursorModels
          )}
          value={controlColumnProps.selectedModel}
        />
        <TopBarSelect
          label="Reasoning"
          onChange={controlColumnProps.onReasoningChange}
          options={getReasoningOptions(controlColumnProps.selectedModel, controlColumnProps.cursorModels)}
          value={controlColumnProps.selectedReasoning}
        />
        <TopBarSelect
          label="Mode"
          onChange={controlColumnProps.onModeChange}
          options={MODE_OPTIONS}
          value={controlColumnProps.autonomyMode}
        />
        <button className={TOPBAR_ACTION_CLASS} onClick={onRefresh} type="button">
          Refresh
        </button>
        <button className={TOPBAR_ACTION_CLASS} onClick={onOpenChat} type="button">
          Chat
        </button>
      </div>
    </header>
  );
}

function TopBarSelect<Value extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<{ value: Value; label: string; hint?: string }>;
  value: Value;
  onChange: (value: Value) => void;
}) {
  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (key !== null) {
        onChange(String(key) as Value);
      }
    },
    [onChange]
  );

  return (
    <Select
      className="hidden min-w-44 flex-col gap-1 xl:flex"
      onSelectionChange={handleSelectionChange}
      selectedKey={value}
    >
      <Label className="sr-only">{label}</Label>
      <Select.Trigger className="h-8 min-h-8 rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-2 text-xs text-[var(--text-main)]">
        <Select.Value className="min-w-0 flex-1 text-left" />
        <Select.Indicator className="size-3 shrink-0 text-[var(--text-muted)]" />
      </Select.Trigger>
      <Select.Popover className="min-w-56 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)]">
        <ListBox className="outline-none">
          {options.map((option) => (
            <ListBox.Item
              className="cursor-pointer rounded px-3 py-2 text-sm text-[var(--text-main)] outline-none data-[focused=true]:bg-[var(--bg-nav-active)]"
              id={option.value}
              key={option.value}
              textValue={option.label}
            >
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

const MODE_OPTIONS: Array<{ value: AutonomyMode; label: string }> = [
  { value: "stepped", label: "Stepped Approval" },
  { value: "milestone", label: "Milestone Approval" },
  { value: "god_mode", label: "God Mode" }
];

const TOPBAR_ACTION_CLASS =
  "rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--bg-nav-active)]";
