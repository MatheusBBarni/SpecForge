import {
  Card,
  Label,
  ListBox,
  Select
} from "@heroui/react";
import {
  Activity,
  Spark
} from "iconoir-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Key,
  type ReactNode
} from "react";

import {
  getModelOptions,
  getModelProvider,
  getProviderLabel,
  getReasoningOptions,
  type SelectOption
} from "../lib/agentConfig";
import type {
  AutonomyMode,
  CliHealth,
  ModelId,
  ModelProvider,
  ReasoningProfileId
} from "../types";

interface McpListItem {
  name: string;
  detail: string;
  status?: CliHealth | string;
}

interface ControlColumnProps {
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  configuredModelProviders: ModelProvider[];
  autonomyMode: AutonomyMode;
  mcpItems?: McpListItem[];
  onModelChange: (model: ModelId) => void;
  onReasoningChange: (reasoning: ReasoningProfileId) => void;
  onModeChange: (mode: AutonomyMode) => void;
}

export const ControlColumn = memo(function ControlColumn({
  selectedModel,
  selectedReasoning,
  configuredModelProviders,
  autonomyMode,
  mcpItems = [],
  onModelChange,
  onReasoningChange,
  onModeChange
}: ControlColumnProps) {
  const reasoningOptions = getReasoningOptions(selectedModel);

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 pr-4 shadow-[var(--shadow)] backdrop-blur-[30px]">
      <header className="shrink-0 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[1.05rem] font-semibold text-[var(--text-main)]">
            SpecForge Review
          </h1>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-2 text-sm text-[var(--text-subtle)]">
          <Spark />
          MVP
        </div>
      </header>

      <div className="flex shrink-0 flex-col gap-4">
        <ControlSection
          icon={<Activity />}
          title="Agent Configuration"
        >
          <div className="flex flex-col gap-4">
            <ModelSelectField
              configuredProviders={configuredModelProviders}
              label="Agent model"
              onSelectionChange={onModelChange}
              selectedKey={selectedModel}
            />
            <ControlSelectField
              label="Reasoning"
              onSelectionChange={onReasoningChange}
              options={reasoningOptions}
              selectedKey={selectedReasoning}
            />
            <ControlSelectField
              label="Approval mode"
              onSelectionChange={onModeChange}
              options={MODE_OPTIONS}
              selectedKey={autonomyMode}
            />
          </div>
        </ControlSection>

        <ControlSection
          icon={<Spark />}
          title="MCP List"
        >
          {mcpItems.length > 0 ? (
            <div className="flex flex-col gap-3">
              {mcpItems.map((item) => (
                <Card className={SURFACE_CARD_CLASS} key={`${item.name}-${item.detail}`}>
                  <Card.Content className="flex items-start justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <h3 className="m-0 truncate text-[15px] font-semibold text-[var(--text-main)]">
                        {item.name}
                      </h3>
                      <p className="m-0 mt-1 text-sm leading-6 text-[var(--text-subtle)]">
                        {item.detail}
                      </p>
                    </div>
                    {item.status ? (
                      <span className={getMcpBadgeClassName(item.status)}>
                        {formatMcpStatus(item.status)}
                      </span>
                    ) : null}
                  </Card.Content>
                </Card>
              ))}
            </div>
          ) : (
            <Card className={SURFACE_CARD_CLASS}>
              <Card.Content className="px-5 py-5">
                <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
                  No MCP servers are configured yet.
                </p>
              </Card.Content>
            </Card>
          )}
        </ControlSection>
      </div>
    </section>
  );
});

interface ModelSelectFieldProps {
  label: string;
  selectedKey: ModelId;
  configuredProviders: ModelProvider[];
  onSelectionChange: (value: ModelId) => void;
}

function ModelSelectField({
  label,
  selectedKey,
  configuredProviders,
  onSelectionChange
}: ModelSelectFieldProps) {
  const hasProviderTabs = configuredProviders.length > 1;
  const singleConfiguredProvider = configuredProviders.length === 1 ? configuredProviders[0] : null;
  const [activeProviderTab, setActiveProviderTab] = useState<ModelProvider>(() => {
    return singleConfiguredProvider ?? getModelProvider(selectedKey);
  });

  useEffect(() => {
    if (singleConfiguredProvider) {
      setActiveProviderTab(singleConfiguredProvider);
      return;
    }

    setActiveProviderTab((currentValue) => {
      if (hasProviderTabs && configuredProviders.includes(currentValue)) {
        return currentValue;
      }

      return getModelProvider(selectedKey);
    });
  }, [configuredProviders, hasProviderTabs, selectedKey, singleConfiguredProvider]);

  const visibleOptions = useMemo(() => {
    if (singleConfiguredProvider) {
      return getModelOptions(singleConfiguredProvider);
    }

    if (hasProviderTabs) {
      return getModelOptions(activeProviderTab);
    }

    return getModelOptions();
  }, [activeProviderTab, hasProviderTabs, singleConfiguredProvider]);

  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (key !== null) {
        onSelectionChange(String(key) as ModelId);
      }
    },
    [onSelectionChange]
  );

  return (
    <Select
      className="flex w-full min-w-0 flex-col gap-2"
      onSelectionChange={handleSelectionChange}
      selectedKey={selectedKey}
    >
      <Label className={FIELD_LABEL_CLASS}>{label}</Label>
      <Select.Trigger className={SELECT_TRIGGER_CLASS}>
        <Select.Value className="min-w-0 flex-1 truncate text-left text-[15px] text-[var(--text-main)]" />
        <Select.Indicator className="size-4 shrink-0 text-[var(--text-subtle)]" />
      </Select.Trigger>
      <Select.Popover className="min-w-56 rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)] backdrop-blur-xl">
        {hasProviderTabs ? (
          <div className="flex gap-2 px-1 pt-1 pb-3">
            {configuredProviders.map((provider) => (
              <button
                className={
                  provider === activeProviderTab ? MODEL_PROVIDER_TAB_ACTIVE_CLASS : MODEL_PROVIDER_TAB_CLASS
                }
                key={provider}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setActiveProviderTab(provider);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                type="button"
              >
                {getProviderLabel(provider)}
              </button>
            ))}
          </div>
        ) : null}
        <ListBox className="outline-none">
          {visibleOptions.map((option) => (
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

interface ControlSectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

function ControlSection({ icon, title, children }: ControlSectionProps) {
  return (
    <Card className="shrink-0 border border-[var(--border-soft)] bg-[var(--bg-surface)]/75 shadow-none backdrop-blur-sm">
      <Card.Header className="flex flex-col gap-3 px-5 pt-5 pb-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-[var(--accent-2)]">{icon}</span>
          <h2 className="m-0 truncate text-lg font-semibold text-[var(--text-main)]">
            {title}
          </h2>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4 px-[5px] py-5">
        {children}
      </Card.Content>
    </Card>
  );
}

interface ControlSelectFieldProps<Value extends string> {
  label: string;
  selectedKey: Value;
  options: Array<SelectOption<Value>>;
  onSelectionChange: (value: Value) => void;
}

function ControlSelectField<Value extends string>({
  label,
  selectedKey,
  options,
  onSelectionChange
}: ControlSelectFieldProps<Value>) {
  const handleSelectionChange = useCallback(
    (key: Key | null) => {
      if (key !== null) {
        onSelectionChange(String(key) as Value);
      }
    },
    [onSelectionChange]
  );

  return (
    <Select
      className="flex w-full min-w-0 flex-col gap-2"
      onSelectionChange={handleSelectionChange}
      selectedKey={selectedKey}
    >
      <Label className={FIELD_LABEL_CLASS}>{label}</Label>
      <Select.Trigger className={SELECT_TRIGGER_CLASS}>
        <Select.Value className="min-w-0 flex-1 truncate text-left text-[15px] text-[var(--text-main)]" />
        <Select.Indicator className="size-4 shrink-0 text-[var(--text-subtle)]" />
      </Select.Trigger>
      <Select.Popover className="min-w-56 rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)] backdrop-blur-xl">
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

const MODE_OPTIONS: Array<{ value: AutonomyMode; label: string }> = [
  { value: "stepped", label: "Stepped Approval" },
  { value: "milestone", label: "Milestone Approval" },
  { value: "god_mode", label: "God Mode" }
];

const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

const SELECT_TRIGGER_CLASS =
  "flex min-h-[3.5rem] w-full items-center gap-3 rounded-[1.1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[var(--text-main)] shadow-none transition hover:bg-black/25";

const LISTBOX_ITEM_CLASS =
  "rounded-xl px-3 py-2.5 text-[15px] text-[var(--text-main)] outline-none transition hover:bg-white/6 data-[focused=true]:bg-white/6 data-[selected=true]:bg-white/10";

const MODEL_PROVIDER_TAB_CLASS =
  "rounded-full border border-[var(--border-soft)] bg-white/4 px-3 py-1.5 text-sm font-medium text-[var(--text-subtle)] transition hover:bg-white/8";

const MODEL_PROVIDER_TAB_ACTIVE_CLASS =
  "rounded-full border border-[var(--accent)]/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-[var(--text-main)] transition";

const SURFACE_CARD_CLASS =
  "border border-dashed border-[var(--border-soft)] bg-[var(--bg-surface)]/80 shadow-none";

function formatMcpStatus(status: string) {
  switch (status) {
    case "found":
      return "Ready";
    case "unauthorized":
      return "Check";
    default:
      return status;
  }
}

function getMcpBadgeClassName(status: string) {
  switch (status) {
    case "found":
      return "shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-emerald-100";
    case "unauthorized":
      return "shrink-0 rounded-full border border-amber-300/30 bg-amber-300/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-amber-100";
    default:
      return "shrink-0 rounded-full border border-[var(--border-soft)] bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-subtle)]";
  }
}

export default ControlColumn;
