import {
  Button,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownTrigger
} from "@heroui/react";
import {
  Check,
  NavArrowDown
} from "iconoir-react";

import { getReasoningOptions } from "../lib/agentConfig";
import type { CursorModel, ModelId, ReasoningProfileId } from "../types";

interface ModelReasoningDropdownProps {
  selectedModel: ModelId;
  selectedReasoning: ReasoningProfileId;
  modelOptions: Array<{ value: ModelId; label: string; hint?: string }>;
  reasoningOptions: Array<{ value: ReasoningProfileId; label: string; hint?: string }>;
  cursorModels: CursorModel[];
  onChange: (nextValue: {
    selectedModel: ModelId;
    selectedReasoning: ReasoningProfileId;
  }) => void;
}

const CONFIG_MENU_ITEM_CLASS =
  "cursor-pointer rounded px-3 py-2 text-sm text-[var(--text-main)] outline-none transition data-[focused=true]:bg-white/10";

export function ModelReasoningDropdown({
  selectedModel,
  selectedReasoning,
  modelOptions,
  reasoningOptions,
  cursorModels,
  onChange
}: ModelReasoningDropdownProps) {
  const selectedModelLabel =
    modelOptions.find((option) => option.value === selectedModel)?.label ?? selectedModel;
  const selectedReasoningLabel =
    reasoningOptions.find((option) => option.value === selectedReasoning)?.label ??
    selectedReasoning;

  return (
    <DropdownRoot>
      <DropdownTrigger>
        <Button
          aria-label="Model and reasoning"
          className="inline-flex min-h-9 max-w-56 items-center gap-2 rounded-full border border-transparent bg-white/[0.06] px-3 text-sm font-medium text-[var(--text-main)] transition hover:bg-white/[0.1]"
        >
          <span className="truncate">{formatCompactModelLabel(selectedModelLabel)}</span>
          <span className="truncate text-[var(--text-subtle)]">{selectedReasoningLabel}</span>
          <NavArrowDown className="size-3.5 shrink-0 text-[var(--text-subtle)]" />
        </Button>
      </DropdownTrigger>
      <DropdownPopover
        className="w-64 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)]"
        placement="top start"
      >
        <DropdownMenu
          aria-label="Model and reasoning options"
          onAction={(key) => {
            const [kind, value] = String(key).split(":");

            if (kind === "reasoning") {
              onChange({
                selectedModel,
                selectedReasoning: value
              });
              return;
            }

            if (kind === "model") {
              const nextReasoningOptions = getReasoningOptions(value, cursorModels);
              const nextReasoning = nextReasoningOptions.some(
                (option) => option.value === selectedReasoning
              )
                ? selectedReasoning
                : nextReasoningOptions[0]?.value ?? selectedReasoning;

              onChange({
                selectedModel: value,
                selectedReasoning: nextReasoning
              });
            }
          }}
        >
          <DropdownItem
            className="px-3 pb-1 pt-2 text-xs font-semibold text-[var(--text-muted)]"
            id="reasoning-label"
            isDisabled
          >
            Intelligence
          </DropdownItem>
          {reasoningOptions.map((option) => (
            <DropdownItem
              className={CONFIG_MENU_ITEM_CLASS}
              id={`reasoning:${option.value}`}
              key={option.value}
              textValue={option.label}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{option.label}</span>
                {option.value === selectedReasoning ? (
                  <Check className="size-4 text-[var(--text-main)]" />
                ) : null}
              </div>
            </DropdownItem>
          ))}
          <DropdownItem
            className="mt-1 border-t border-[var(--border-soft)] px-3 pb-1 pt-3 text-xs font-semibold text-[var(--text-muted)]"
            id="model-label"
            isDisabled
          >
            Model
          </DropdownItem>
          {modelOptions.map((option) => (
            <DropdownItem
              className={CONFIG_MENU_ITEM_CLASS}
              id={`model:${option.value}`}
              key={option.value}
              textValue={option.label}
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="truncate">{option.label}</span>
                {option.value === selectedModel ? (
                  <Check className="size-4 shrink-0 text-[var(--text-main)]" />
                ) : null}
              </div>
            </DropdownItem>
          ))}
        </DropdownMenu>
      </DropdownPopover>
    </DropdownRoot>
  );
}

function formatCompactModelLabel(label: string) {
  return label
    .replace(/^GPT-/, "")
    .replace(/^Claude /, "")
    .replace(/^Gemini /, "")
    .replace(/^Composer /, "Composer ");
}
