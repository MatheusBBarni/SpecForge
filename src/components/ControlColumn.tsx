import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  TextArea
} from "@heroui/react";
import {
  Activity,
  ChatBubble,
  CheckCircle,
  Spark,
  Upload
} from "iconoir-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type Key,
  type ReactNode,
  type RefObject
} from "react";

import {
  getModelOption,
  getModelOptions,
  getModelProvider,
  getProviderLabel,
  getReasoningOptions,
  type SelectOption
} from "../lib/agentConfig";
import type { AutonomyMode, ModelId, ModelProvider, ReasoningProfileId } from "../types";

type DocumentTarget = "prd" | "spec";

interface ControlColumnProps {
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  configuredModelProviders: ModelProvider[];
  autonomyMode: AutonomyMode;
  selectedSpecText: string;
  reviewPrompt: string;
  isSpecApproved: boolean;
  importPath: string;
  importTarget: DocumentTarget;
  importError: string;
  isImporting: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportPathChange: (value: string) => void;
  onImportTargetChange: (target: DocumentTarget) => void;
  onPathImport: () => void;
  onFilePick: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onModelChange: (model: ModelId) => void;
  onReasoningChange: (reasoning: ReasoningProfileId) => void;
  onModeChange: (mode: AutonomyMode) => void;
  onReviewPromptChange: (value: string) => void;
  onApplyRefinement: () => void;
  onApproveSpec: () => void;
}

export const ControlColumn = memo(function ControlColumn({
  selectedModel,
  selectedReasoning,
  configuredModelProviders,
  autonomyMode,
  selectedSpecText,
  reviewPrompt,
  isSpecApproved,
  importPath,
  importTarget,
  importError,
  isImporting,
  fileInputRef,
  onImportPathChange,
  onImportTargetChange,
  onPathImport,
  onFilePick,
  onFileChange,
  onModelChange,
  onReasoningChange,
  onModeChange,
  onReviewPromptChange,
  onApplyRefinement,
  onApproveSpec
}: ControlColumnProps) {
  const reasoningOptions = getReasoningOptions(selectedModel);

  const handlePrdPick = useCallback(() => {
    onImportTargetChange("prd");
    onFilePick();
  }, [onFilePick, onImportTargetChange]);

  const handleSpecPick = useCallback(() => {
    onImportTargetChange("spec");
    onFilePick();
  }, [onFilePick, onImportTargetChange]);

  return (
    <section className="control-column panel gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Control Deck</p>
          <h1 className="m-0 text-[1.05rem] font-semibold text-[var(--text-main)]">
            SpecForge Review
          </h1>
        </div>
        <div className="panel-badge shrink-0">
          <Spark />
          MVP
        </div>
      </header>

      <ControlSection
        icon={<Upload />}
        title="Ingestion"
      >
        <Card className={SURFACE_CARD_CLASS}>
          <Card.Content className="flex flex-col items-center gap-5 px-4 py-6 text-center">
            <p className="max-w-[24rem] text-balance text-lg font-medium leading-8 text-[var(--text-main)]">
              Load Markdown or PDF directly into PRD or spec.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                className={SECONDARY_BUTTON_CLASS}
                onPress={handlePrdPick}
                type="button"
              >
                Load PRD
              </Button>
              <Button
                className={SECONDARY_BUTTON_CLASS}
                onPress={handleSpecPick}
                type="button"
              >
                Load Spec
              </Button>
            </div>
            <input
              accept=".md,.pdf"
              className="hidden-file-input"
              onChange={onFileChange}
              ref={fileInputRef}
              type="file"
            />
          </Card.Content>
        </Card>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className={FIELD_LABEL_CLASS} htmlFor="path-import">
              Open from path
            </Label>
            <Input
              className={FIELD_INPUT_CLASS}
              id="path-import"
              onChange={(event) => onImportPathChange(event.target.value)}
              placeholder="docs/PRD.md"
              value={importPath}
            />
          </div>

          <ControlSelectField
            label="Load target"
            onSelectionChange={onImportTargetChange}
            options={DOCUMENT_TARGET_OPTIONS}
            selectedKey={importTarget}
          />
        </div>

        <Button
          className={PRIMARY_BUTTON_CLASS}
          fullWidth
          isDisabled={isImporting}
          onPress={onPathImport}
          type="button"
        >
          {isImporting ? "Parsing..." : "Parse Document"}
        </Button>

        {importError ? (
          <p className="m-0 text-sm leading-6 text-[var(--danger)]">{importError}</p>
        ) : null}
      </ControlSection>

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
        icon={<ChatBubble />}
        title="Inline Refinement"
      >
        <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
          Highlight text in the spec editor to scope the next revision.
        </p>

        <Card className={SURFACE_CARD_CLASS}>
          <Card.Content className="flex flex-col gap-3 px-5 py-5">
            <span className="text-sm text-[var(--text-subtle)]">Selected scope</span>
            <p className="m-0 text-lg leading-8 text-[var(--text-main)]">
              {selectedSpecText || "No spec text selected yet."}
            </p>
          </Card.Content>
        </Card>

        <TextArea
          className={TEXTAREA_CLASS}
          onChange={(event) => onReviewPromptChange(event.target.value)}
          placeholder="Ask the agent to tighten requirements, add endpoints, or expand acceptance criteria."
          rows={4}
          value={reviewPrompt}
        />

        <div className="flex flex-wrap gap-3">
          <Button
            className={SECONDARY_BUTTON_CLASS}
            isDisabled={!reviewPrompt.trim()}
            onPress={onApplyRefinement}
            type="button"
          >
            <Spark />
            Apply Refinement
          </Button>
          <Button
            className={PRIMARY_BUTTON_CLASS}
            onPress={onApproveSpec}
            type="button"
          >
            <CheckCircle />
            {isSpecApproved ? "Approved" : "Approve Spec"}
          </Button>
        </div>
      </ControlSection>
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
  const selectedOption = getModelOption(selectedKey);
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
                onClick={() => setActiveProviderTab(provider)}
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
      <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">
        {`${getProviderLabel(selectedOption.provider)} | ${selectedOption.description}`}
      </p>
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
    <Card className="border border-[var(--border-soft)] bg-[var(--bg-surface)]/75 shadow-none backdrop-blur-sm">
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
  const selectedOption = options.find((option) => option.value === selectedKey);
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
      {selectedOption?.hint ? (
        <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">{selectedOption.hint}</p>
      ) : null}
    </Select>
  );
}

const DOCUMENT_TARGET_OPTIONS: Array<{ value: DocumentTarget; label: string }> = [
  { value: "prd", label: "PRD" },
  { value: "spec", label: "Spec" }
];

const MODE_OPTIONS: Array<{ value: AutonomyMode; label: string }> = [
  { value: "stepped", label: "Stepped Approval" },
  { value: "milestone", label: "Milestone Approval" },
  { value: "god_mode", label: "God Mode" }
];

const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

const FIELD_INPUT_CLASS =
  "w-full rounded-[1.1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[15px] text-[var(--text-main)] shadow-none outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-0";

const TEXTAREA_CLASS =
  "min-h-[8.5rem] w-full rounded-[1.1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[15px] leading-7 text-[var(--text-main)] shadow-none outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-0 resize-none";

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

const SECONDARY_BUTTON_CLASS =
  "rounded-[1.1rem] border border-[var(--border-soft)] bg-white/5 px-5 py-3 font-medium text-[var(--text-main)] shadow-none transition hover:bg-white/8";

const PRIMARY_BUTTON_CLASS =
  "rounded-[1.1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-5 py-3 font-semibold text-[#15131c] shadow-none transition hover:opacity-95";

export default ControlColumn;
