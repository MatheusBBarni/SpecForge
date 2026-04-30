import { Label, ListBox, Select } from "@heroui/react";
import {
  type ChangeEvent,
  type ComponentProps,
  type Key,
  memo,
  type RefObject,
  useCallback
} from "react";
import { useShallow } from "zustand/react/shallow";

import { ControlColumn } from "../components/ControlColumn";
import { FloatingSearch } from "../components/FloatingSearch";
import { InspectorColumn } from "../components/InspectorColumn";
import { MainWorkspace } from "../components/MainWorkspace";
import { ModelReasoningDropdown } from "../components/ModelReasoningDropdown";
import { StatusPill } from "../components/StatusPill";
import { getModelOptions, getReasoningOptions } from "../lib/agentConfig";
import { useAgentStore } from "../store/useAgentStore";
import { useProjectStore } from "../store/useProjectStore";
import { useWorkspaceUiStore } from "../store/useWorkspaceUiStore";
import type { AutonomyMode } from "../types";

export interface PrdScreenProps {
  onOpenChat: () => void;
  onRefresh: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  controlColumnProps: ComponentProps<typeof ControlColumn>;
  mainWorkspaceProps: ComponentProps<typeof MainWorkspace>;
  inspectorColumnProps: ComponentProps<typeof InspectorColumn>;
}

export const PrdScreen = memo(function PrdScreen({
  onOpenChat,
  onRefresh,
  searchInputRef,
  controlColumnProps,
  mainWorkspaceProps,
  inspectorColumnProps,
}: PrdScreenProps) {
  const { commandSearch, isSearchOpen, setCommandSearch } = useWorkspaceUiStore(
    useShallow((state) => ({
      commandSearch: state.commandSearch,
      isSearchOpen: state.isSearchOpen,
      setCommandSearch: state.setCommandSearch,
    })),
  );
  const handleCommandSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setCommandSearch(event.target.value);
    },
    [setCommandSearch],
  );

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {isSearchOpen ? (
        <FloatingSearch
          inputRef={searchInputRef}
          onChange={handleCommandSearchChange}
          value={commandSearch}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ReviewTopBar
          controlColumnProps={controlColumnProps}
          onOpenChat={onOpenChat}
          onRefresh={onRefresh}
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
  controlColumnProps,
  onOpenChat,
  onRefresh,
}: {
  controlColumnProps: ComponentProps<typeof ControlColumn>;
  onOpenChat: () => void;
  onRefresh: () => void;
}) {
  const agentStatus = useAgentStore((state) => state.status);
  const {
    autonomyMode,
    cursorModels,
    selectedModel,
    selectedReasoning,
    workspaceRootName,
  } = useReviewTopBarState();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-strong)] bg-[var(--bg-panel)] px-4">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 truncate font-[var(--font-mono)] text-sm text-[var(--text-main)]">
          {workspaceRootName}
        </h1>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <StatusPill status={agentStatus} />
        <ModelReasoningDropdown
          cursorModels={cursorModels}
          modelOptions={getModelOptions(
            controlColumnProps.configuredModelProviders.length === 1
              ? controlColumnProps.configuredModelProviders[0]
              : undefined,
            cursorModels,
          )}
          onChange={({ selectedModel: nextModel, selectedReasoning: nextReasoning }) => {
            if (nextModel !== selectedModel) {
              controlColumnProps.onModelChange(nextModel);
            }

            if (nextReasoning !== selectedReasoning) {
              controlColumnProps.onReasoningChange(nextReasoning);
            }
          }}
          reasoningOptions={getReasoningOptions(selectedModel, cursorModels)}
          selectedModel={selectedModel}
          selectedReasoning={selectedReasoning}
        />
        <TopBarSelect
          label="Mode"
          onChange={controlColumnProps.onModeChange}
          options={MODE_OPTIONS}
          value={autonomyMode}
        />
        <button
          className={TOPBAR_ACTION_CLASS}
          onClick={onRefresh}
          type="button"
        >
          Refresh
        </button>
        <button
          className={TOPBAR_ACTION_CLASS}
          onClick={onOpenChat}
          type="button"
        >
          Chat
        </button>
      </div>
    </header>
  );
}

function useReviewTopBarState() {
  const projectState = useProjectStore(
    useShallow((state) => ({
      autonomyMode: state.autonomyMode,
      selectedModel: state.selectedModel,
      selectedReasoning: state.selectedReasoning,
    })),
  );
  const workspaceState = useWorkspaceUiStore(
    useShallow((state) => ({
      cursorModels: state.cursorModels,
      workspaceRootName: state.projectRootName,
    })),
  );

  return {
    ...projectState,
    ...workspaceState,
  };
}

function TopBarSelect<Value extends string>({
  label,
  options,
  value,
  onChange,
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
    [onChange],
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
  { value: "god_mode", label: "God Mode" },
];

const TOPBAR_ACTION_CLASS =
  "rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--bg-nav-active)]";
