import {
  FileNotFound
} from "iconoir-react";
import { memo, useEffect, useMemo, type ChangeEvent } from "react";

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
  const hasSpecContent = specContent.trim().length > 0;

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
          <DocumentPane
            content={prdContent}
            eyebrow="Source PRD"
            mode={prdPaneMode}
            onChange={onPrdContentChange}
            onModeChange={onPrdPaneModeChange}
            title={displayPrdPath}
          />
          {hasSpecContent ? (
            <DocumentPane
              content={specContent}
              eyebrow="Technical Spec"
              mode={specPaneMode}
              onChange={onSpecContentChange}
              onModeChange={onSpecPaneModeChange}
              onSelect={onSpecSelect}
              title={displaySpecPath}
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
              title={displaySpecPath || "spec.md"}
            />
          )}
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
