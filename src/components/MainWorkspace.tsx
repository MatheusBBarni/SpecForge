import {
  CheckCircle,
  FileNotFound
} from "iconoir-react";
import { memo, useEffect, useMemo, type ChangeEvent } from "react";

import { DocumentActionBar } from "./DocumentActionBar";
import { DocumentEmptyState } from "./DocumentEmptyState";
import { DocumentPane } from "./DocumentPane";
import { ExecutionPanel } from "./ExecutionPanel";
import { SpecEmptyState } from "./SpecEmptyState";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import type {
  AgentStatus,
  EditorTab,
  PaneMode,
  WorkspaceTab
} from "../types";

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
  canGenerateSpec: boolean;
  isGeneratingSpec: boolean;
  specGenerationPrompt: string;
  specGenerationError: string;
  specGenerationHelperText: string;
  terminalOutput: string[];
  executionSummary: string | null;
  visibleDiff: string;
  agentStatus: AgentStatus;
  onActiveTabChange: (tab: WorkspaceTab) => void;
  onPrdPaneModeChange: (mode: PaneMode) => void;
  onSpecPaneModeChange: (mode: PaneMode) => void;
  onPrdContentChange: (value: string) => void;
  onSpecContentChange: (value: string) => void;
  onLoadPrd: () => void;
  onLoadSpec: () => void;
  onApproveSpec: () => void;
  onSpecGenerationPromptChange: (value: string) => void;
  onGenerateSpec: () => void;
  onSpecSelect: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onEditorTabChange: (path: string, content: string) => void;
  onEditorTabClose: (path: string) => void;
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
  canGenerateSpec,
  isGeneratingSpec,
  specGenerationPrompt,
  specGenerationError,
  specGenerationHelperText,
  terminalOutput,
  executionSummary,
  visibleDiff,
  agentStatus,
  onActiveTabChange,
  onPrdPaneModeChange,
  onSpecPaneModeChange,
  onPrdContentChange,
  onSpecContentChange,
  onLoadPrd,
  onLoadSpec,
  onApproveSpec,
  onSpecGenerationPromptChange,
  onGenerateSpec,
  onSpecSelect,
  onEditorTabChange,
  onEditorTabClose,
  onApproveExecutionGate,
  onEmergencyStop
}: MainWorkspaceProps) {
  const activeEditorTab = useMemo(
    () => openEditorTabs.find((entry) => entry.id === activeTab),
    [activeTab, openEditorTabs]
  );
  const displayPrdPath = useMemo(
    () => getDisplayDocumentPath(prdPath, workspaceRootName),
    [prdPath, workspaceRootName]
  );
  const displaySpecPath = useMemo(
    () => getDisplayDocumentPath(specPath, workspaceRootName),
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
    <section className="flex min-h-0 h-full flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-[var(--shadow)] backdrop-blur-[30px]">
      <WorkspaceTabBar
        activeTab={activeTab}
        onActiveTabChange={onActiveTabChange}
        onEditorTabClose={onEditorTabClose}
        openEditorTabs={openEditorTabs}
      />

      {activeTab === "review" ? (
        <div className="grid h-full min-h-0 gap-4 p-4 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-2 xl:grid-rows-1">
          <section className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="m-0 text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
                  PRD (Product Requirements Document)
                </h2>
                <p className="m-0 truncate pt-1 text-lg font-semibold text-[var(--text-main)]">
                  {displayPrdPath || "PRD.md"}
                </p>
              </div>
              <DocumentActionBar
                loadLabel="Load PRD"
                mode={prdPaneMode}
                onLoad={onLoadPrd}
                onModeChange={onPrdPaneModeChange}
              />
            </div>
            {showPrdEmptyState ? (
              <DocumentEmptyState
                description="Load an existing PRD or switch to Edit to draft one manually before generating a spec."
                heading="No PRD file detected"
                icon={<FileNotFound className="size-6" />}
              />
            ) : (
              <DocumentPane content={prdContent} mode={prdPaneMode} onChange={onPrdContentChange} />
            )}
          </section>

          <section className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="m-0 text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
                  Spec (Technical Specification)
                </h2>
                <p className="m-0 truncate pt-1 text-lg font-semibold text-[var(--text-main)]">
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
                error={specGenerationError}
                helperText={specGenerationHelperText}
                isGenerating={isGeneratingSpec}
                onGenerate={onGenerateSpec}
                onPromptChange={onSpecGenerationPromptChange}
                prompt={specGenerationPrompt}
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
            terminalOutput={terminalOutput}
            visibleDiff={visibleDiff}
          />
        </div>
      ) : activeEditorTab ? (
        <div className="grid h-full min-h-0 gap-4 p-4">
          <article className="flex min-h-0 flex-col gap-4 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
            <div>
              <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
                Workspace File
              </p>
              <h2 className="m-0 text-lg font-semibold text-[var(--text-main)]">
                {activeEditorTab.path}
              </h2>
            </div>

            <textarea
              className="min-h-0 flex-1 resize-none rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-4 font-[var(--font-mono)] text-[15px] leading-7 text-[var(--text-main)]"
              onChange={(event) => onEditorTabChange(activeEditorTab.path, event.target.value)}
              value={activeEditorTab.content}
            />
          </article>
        </div>
      ) : (
        <div className="grid h-full min-h-0 gap-4 p-4">
          <article className="flex min-h-0 flex-col items-center justify-center gap-3 rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-8 text-center">
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
              Open a text or code file from the right sidebar to edit it here.
            </p>
          </article>
        </div>
      )}
    </section>
  );
});

function getDisplayDocumentPath(path: string, workspaceRootName: string) {
  const normalizedPath = path.replace(/\\/g, "/");

  if (!workspaceRootName) {
    return normalizedPath;
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  const rootIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === workspaceRootName.toLowerCase()
  );

  if (rootIndex >= 0 && rootIndex < segments.length - 1) {
    return segments.slice(rootIndex + 1).join("/");
  }

  return normalizedPath;
}

const HEADER_ACTION_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white/5 px-4 py-3 font-medium text-[var(--text-main)] transition hover:-translate-y-0.5 hover:bg-white/8";

const APPROVED_ACTION_BUTTON_CLASS =
  "border-emerald-400/30 bg-emerald-400/12 text-[var(--text-main)]";
