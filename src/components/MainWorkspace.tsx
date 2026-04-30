import {
  Button,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownTrigger
} from "@heroui/react";
import {
  CheckCircle,
  FileNotFound
} from "iconoir-react";
import { type ChangeEvent, type Key, memo, useEffect, useMemo } from "react";

import { getWorkspaceDisplayPath } from "../lib/projectConfig";
import type {
  AgentStatus,
  EditorTab,
  ExternalEditor,
  PaneMode,
  WorkspaceTab
} from "../types";
import { DocumentActionBar } from "./DocumentActionBar";
import { DocumentEmptyState } from "./DocumentEmptyState";
import { DocumentPane } from "./DocumentPane";
import { ExecutionPanel } from "./ExecutionPanel";
import { PrdEmptyState } from "./PrdEmptyState";
import { SpecEmptyState } from "./SpecEmptyState";
import { WorkspaceTabBar } from "./WorkspaceTabBar";

interface MainWorkspaceProps {
  activeTab: WorkspaceTab;
  openEditorTabs: EditorTab[];
  workspaceRootName: string;
  prdPath: string;
  specPath: string;
  prdContent: string;
  specContent: string;
  prdPaneMode: PaneMode;
  specPaneMode: PaneMode;
  isSpecApproved: boolean;
  canGeneratePrd: boolean;
  isGeneratingPrd: boolean;
  prdGenerationPrompt: string;
  prdGenerationError: string;
  prdGenerationHelperText: string;
  canGenerateSpec: boolean;
  isGeneratingSpec: boolean;
  specGenerationPrompt: string;
  specGenerationError: string;
  specGenerationHelperText: string;
  prdPromptTemplate: string;
  specPromptTemplate: string;
  configPath: string;
  terminalOutput: string[];
  executionSummary: string | null;
  visibleDiff: string;
  agentStatus: AgentStatus;
  executionControlsEnabled?: boolean;
  externalEditors: ExternalEditor[];
  onActiveTabChange: (tab: WorkspaceTab) => void;
  onPrdPaneModeChange: (mode: PaneMode) => void;
  onSpecPaneModeChange: (mode: PaneMode) => void;
  onPrdContentChange: (value: string) => void;
  onSpecContentChange: (value: string) => void;
  onLoadPrd: () => void;
  onLoadSpec: () => void;
  onApproveSpec: () => void;
  onPrdGenerationPromptChange: (value: string) => void;
  onGeneratePrd: () => void;
  onSpecGenerationPromptChange: (value: string) => void;
  onGenerateSpec: () => void;
  onSpecSelect: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onEditorTabClose: (path: string) => void;
  onOpenEditorTabExternally: (path: string, editorId: string) => void;
  onApproveExecutionGate: () => void;
  onEmergencyStop: () => void;
}

export const MainWorkspace = memo(function MainWorkspace({
  activeTab,
  openEditorTabs,
  workspaceRootName,
  prdPath,
  specPath,
  prdContent,
  specContent,
  prdPaneMode,
  specPaneMode,
  isSpecApproved,
  canGeneratePrd,
  isGeneratingPrd,
  prdGenerationPrompt,
  prdGenerationError,
  prdGenerationHelperText,
  canGenerateSpec,
  isGeneratingSpec,
  specGenerationPrompt,
  specGenerationError,
  specGenerationHelperText,
  prdPromptTemplate,
  specPromptTemplate,
  configPath,
  terminalOutput,
  executionSummary,
  visibleDiff,
  agentStatus,
  executionControlsEnabled = true,
  externalEditors,
  onActiveTabChange,
  onPrdPaneModeChange,
  onSpecPaneModeChange,
  onPrdContentChange,
  onSpecContentChange,
  onLoadPrd,
  onLoadSpec,
  onApproveSpec,
  onPrdGenerationPromptChange,
  onGeneratePrd,
  onSpecGenerationPromptChange,
  onGenerateSpec,
  onSpecSelect,
  onEditorTabClose,
  onOpenEditorTabExternally,
  onApproveExecutionGate,
  onEmergencyStop
}: MainWorkspaceProps) {
  const activeEditorTab = useMemo(
    () => openEditorTabs.find((entry) => entry.id === activeTab),
    [activeTab, openEditorTabs]
  );
  const displayPrdPath = useMemo(
    () => getWorkspaceDisplayPath(prdPath, workspaceRootName),
    [prdPath, workspaceRootName]
  );
  const displaySpecPath = useMemo(
    () => getWorkspaceDisplayPath(specPath, workspaceRootName),
    [specPath, workspaceRootName]
  );
  const hasPrdContent = prdContent.trim().length > 0;
  const hasSpecContent = specContent.trim().length > 0;
  const showPrdEmptyState = !hasPrdContent && prdPaneMode === "preview";
  const showSpecPreviewState = !hasSpecContent && specPaneMode === "preview";
  const approveSpecButton = (
    <button
      className={`${HEADER_ACTION_BUTTON_CLASS} ${
        isSpecApproved ? APPROVED_ACTION_BUTTON_CLASS : ""
      } ${!hasSpecContent ? "cursor-not-allowed opacity-50 hover:-translate-y-0" : ""}`}
      disabled={!hasSpecContent}
      onClick={onApproveSpec}
      type="button"
    >
      <CheckCircle className="size-4" />
      {isSpecApproved ? "Approved" : "Approve Spec"}
    </button>
  );

  useEffect(() => {
    if (!activeEditorTab) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const isCloseShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "w";

      if (!isCloseShortcut) {
        return;
      }

      event.preventDefault();
      onEditorTabClose(activeEditorTab.path);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeEditorTab, onEditorTabClose]);

  return (
    <section className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-[var(--bg-panel)] shadow-none">
      <WorkspaceTabBar
        activeTab={activeTab}
        onActiveTabChange={onActiveTabChange}
        onEditorTabClose={onEditorTabClose}
        openEditorTabs={openEditorTabs}
      />

      {activeTab === "review" ? (
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:grid-rows-1">
          <section className="flex min-h-0 min-w-0 flex-col border-b border-[var(--border-strong)] xl:border-r xl:border-b-0">
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-strong)] px-4 py-2">
              <div className="min-w-0">
                <h2 className="m-0 truncate font-[var(--font-mono)] text-sm font-medium text-[var(--text-main)]">
                  {displayPrdPath || "PRD.md"}
                </h2>
              </div>
              <DocumentActionBar
                loadLabel="Load PRD"
                mode={prdPaneMode}
                onLoad={onLoadPrd}
                onModeChange={onPrdPaneModeChange}
              />
            </div>
            {showPrdEmptyState ? (
              <PrdEmptyState
                canGenerate={canGeneratePrd}
                configPath={configPath}
                error={prdGenerationError}
                helperText={prdGenerationHelperText}
                isGenerating={isGeneratingPrd}
                onGenerate={onGeneratePrd}
                onPromptChange={onPrdGenerationPromptChange}
                prompt={prdGenerationPrompt}
                templatePrompt={prdPromptTemplate}
              />
            ) : (
              <DocumentPane
                className="m-4 flex-1"
                content={prdContent}
                mode={prdPaneMode}
                onChange={onPrdContentChange}
              />
            )}
          </section>

          <section className="flex min-h-0 min-w-0 flex-col bg-[var(--bg-panel)]">
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-strong)] bg-[var(--bg-panel-strong)] px-4 py-2">
              <div className="min-w-0">
                <h2 className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-main)]">
                  Spec
                </h2>
                <p className="m-0 truncate pt-1 font-[var(--font-mono)] text-xs text-[var(--text-muted)]">
                  {displaySpecPath || "spec.md"}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <DocumentActionBar
                  loadLabel="Load Spec"
                  mode={specPaneMode}
                  onLoad={onLoadSpec}
                  onModeChange={onSpecPaneModeChange}
                  showModeButtons={hasSpecContent || !showSpecPreviewState}
                />
                {approveSpecButton}
              </div>
            </div>
            {hasSpecContent || !showSpecPreviewState ? (
              <DocumentPane
                className="m-4 flex-1"
                content={specContent}
                mode={specPaneMode}
                onChange={onSpecContentChange}
                onSelect={onSpecSelect}
              />
            ) : !hasPrdContent ? (
              <DocumentEmptyState
                description="Load or draft a PRD first if you want SpecForge to generate a technical spec. You can still load an existing spec at any time."
                heading="PRD required before generation"
                icon={<FileNotFound className="size-6" />}
              />
            ) : (
              <SpecEmptyState
                canGenerate={canGenerateSpec}
                configPath={configPath}
                error={specGenerationError}
                helperText={specGenerationHelperText}
                isGenerating={isGeneratingSpec}
                onGenerate={onGenerateSpec}
                onPromptChange={onSpecGenerationPromptChange}
                prompt={specGenerationPrompt}
                templatePrompt={specPromptTemplate}
              />
            )}
          </section>
        </div>
      ) : activeTab === "execute" ? (
        <div className="h-full min-h-0 p-4">
          <ExecutionPanel
            agentStatus={agentStatus}
            executionSummary={executionSummary}
            onApproveExecutionGate={onApproveExecutionGate}
            onEmergencyStop={onEmergencyStop}
            showControls={executionControlsEnabled}
            terminalOutput={terminalOutput}
            visibleDiff={visibleDiff}
          />
        </div>
      ) : activeEditorTab ? (
        <div className="grid h-full min-h-0 min-w-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-3 p-4">
          <div className="flex min-h-0 items-center justify-end">
            <ExternalEditorMenu
              editors={externalEditors}
              onOpen={(editorId) => onOpenEditorTabExternally(activeEditorTab.path, editorId)}
            />
          </div>
          <textarea
            className="min-h-0 min-w-0 w-full resize-none rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4 font-[var(--font-mono)] text-[15px] leading-7 text-[var(--text-main)] outline-none"
            readOnly
            value={activeEditorTab.content}
          />
        </div>
      ) : (
        <div className="grid h-full min-h-0 gap-4 p-4">
          <article className="flex min-h-0 flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] p-8 text-center">
            <FileNotFound className="size-8 text-[var(--text-subtle)]" />
            <div>
              <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
                Workspace File
              </p>
              <h2 className="m-0 text-lg font-semibold text-[var(--text-main)]">
                No file selected
              </h2>
            </div>
            <p className="m-0 max-w-md text-sm leading-7 text-[var(--text-subtle)]">
              Open a text or code file from the right sidebar to inspect it here.
            </p>
          </article>
        </div>
      )}
    </section>
  );
});

function ExternalEditorMenu({
  editors,
  onOpen
}: {
  editors: ExternalEditor[];
  onOpen: (editorId: string) => void;
}) {
  const isDisabled = editors.length === 0;

  return (
    <DropdownRoot>
      <DropdownTrigger>
        <Button className={OPEN_EDITOR_BUTTON_CLASS} isDisabled={isDisabled}>
          Open in
        </Button>
      </DropdownTrigger>
      <DropdownPopover className="min-w-56 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-1 shadow-[var(--shadow)]">
        <DropdownMenu
          aria-label="Open file in external editor"
          onAction={(key: Key) => onOpen(String(key))}
        >
          {editors.map((editor) => (
            <DropdownItem
              className="cursor-pointer rounded px-3 py-2.5 text-sm text-[var(--text-main)] outline-none transition data-[focused=true]:bg-[var(--bg-nav-active)]"
              id={editor.id}
              key={editor.id}
              textValue={editor.label}
            >
              {editor.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </DropdownPopover>
    </DropdownRoot>
  );
}

const HEADER_ACTION_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-4 py-3 font-medium text-[var(--text-main)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]";

const APPROVED_ACTION_BUTTON_CLASS =
  "border-emerald-400/30 bg-emerald-400/12 text-[var(--text-main)]";

const OPEN_EDITOR_BUTTON_CLASS =
  "rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";
