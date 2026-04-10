import {
  CheckCircle,
  CodeBracketsSquare,
  Terminal,
  XmarkCircle
} from "iconoir-react";
import { memo, useEffect, useMemo, type ChangeEvent } from "react";

import { DiffPreview } from "./DiffPreview";
import { MarkdownDocument } from "./MarkdownDocument";
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
  terminalOutput: string[];
  executionSummary: string | null;
  visibleDiff: string;
  agentStatus: AgentStatus;
  onActiveTabChange: (tab: WorkspaceTab) => void;
  onPrdPaneModeChange: (mode: PaneMode) => void;
  onSpecPaneModeChange: (mode: PaneMode) => void;
  onPrdContentChange: (value: string) => void;
  onSpecContentChange: (value: string) => void;
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
  terminalOutput,
  executionSummary,
  visibleDiff,
  agentStatus,
  onActiveTabChange,
  onPrdPaneModeChange,
  onSpecPaneModeChange,
  onPrdContentChange,
  onSpecContentChange,
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
    <section className="main-column panel">
      <div className="tabbar">
        <button
          className={activeTab === "review" ? "tab-active" : ""}
          onClick={() => onActiveTabChange("review")}
          type="button"
        >
          Review
        </button>
        <button
          className={activeTab === "execute" ? "tab-active" : ""}
          onClick={() => onActiveTabChange("execute")}
          type="button"
        >
          Execute
        </button>
        {openEditorTabs.map((tab) => (
          <div
            className={tab.id === activeTab ? "workspace-file-tab workspace-file-tab-active" : "workspace-file-tab"}
            key={tab.id}
          >
            <button
              className="workspace-file-tab-button"
              onClick={() => onActiveTabChange(tab.id)}
              type="button"
            >
              {tab.title}
            </button>
            <button
              aria-label={`Close ${tab.title}`}
              className="workspace-file-tab-close"
              onClick={() => onEditorTabClose(tab.path)}
              type="button"
            >
              <span aria-hidden="true" className="workspace-file-tab-close-mark">
                x
              </span>
            </button>
          </div>
        ))}
      </div>

      {activeTab === "review" ? (
        <div className="document-grid">
          <article className="document-panel">
            <div className="document-header">
              <div>
                <p className="eyebrow">Source PRD</p>
                <h2>{displayPrdPath}</h2>
              </div>
              <div className="segmented-control">
                <button
                  className={prdPaneMode === "preview" ? "segment-active" : ""}
                  onClick={() => onPrdPaneModeChange("preview")}
                  type="button"
                >
                  Preview
                </button>
                <button
                  className={prdPaneMode === "edit" ? "segment-active" : ""}
                  onClick={() => onPrdPaneModeChange("edit")}
                  type="button"
                >
                  Edit
                </button>
              </div>
            </div>

            {prdPaneMode === "preview" ? (
              <div className="document-body">
                <MarkdownDocument content={prdContent} />
              </div>
            ) : (
              <textarea
                className="document-editor"
                onChange={(event) => onPrdContentChange(event.target.value)}
                value={prdContent}
              />
            )}
          </article>

          <article className="document-panel">
            <div className="document-header">
              <div>
                <p className="eyebrow">Technical Spec</p>
                <h2>{displaySpecPath}</h2>
              </div>
              <div className="segmented-control">
                <button
                  className={specPaneMode === "preview" ? "segment-active" : ""}
                  onClick={() => onSpecPaneModeChange("preview")}
                  type="button"
                >
                  Preview
                </button>
                <button
                  className={specPaneMode === "edit" ? "segment-active" : ""}
                  onClick={() => onSpecPaneModeChange("edit")}
                  type="button"
                >
                  Edit
                </button>
              </div>
            </div>

            {specPaneMode === "preview" ? (
              <div className="document-body">
                <MarkdownDocument content={specContent} />
              </div>
            ) : (
              <textarea
                className="document-editor"
                onChange={(event) => onSpecContentChange(event.target.value)}
                onSelect={onSpecSelect}
                value={specContent}
              />
            )}
          </article>
        </div>
      ) : activeTab === "execute" ? (
        <div className="execution-layout">
          <section className="console-panel">
            <div className="section-title">
              <Terminal />
              <span>Execution Stream</span>
            </div>
            <div className="console-window">
              {terminalOutput.length === 0 ? (
                <p className="console-placeholder">
                  Approve the spec, then start a build to stream the agent loop here.
                </p>
              ) : (
                terminalOutput.map((line, index) => (
                  <div className="console-line" key={`${line}-${index}`}>
                    {line}
                  </div>
                ))
              )}
            </div>
            <div className="button-row">
              {agentStatus === "awaiting_approval" ? (
                <button className="primary-button" onClick={onApproveExecutionGate} type="button">
                  <CheckCircle />
                  Approve Gate
                </button>
              ) : null}
              <button className="danger-button" onClick={onEmergencyStop} type="button">
                <XmarkCircle />
                Emergency Stop
              </button>
            </div>
          </section>

          <section className="diff-panel-wrapper">
            <div className="section-title">
              <CodeBracketsSquare />
              <span>Approval Diff</span>
            </div>
            <DiffPreview diff={visibleDiff} />
            <p className="muted-copy">
              {executionSummary ||
                "Diff output stays visible across approval gates so the next mutation can be reviewed in context."}
            </p>
          </section>
        </div>
      ) : activeEditorTab ? (
        <div className="file-editor-layout">
          <article className="document-panel">
            <div className="document-header">
              <div>
                <p className="eyebrow">Workspace File</p>
                <h2>{activeEditorTab.path}</h2>
              </div>
            </div>
            <textarea
              className="document-editor"
              onChange={(event) => onEditorTabChange(activeEditorTab.path, event.target.value)}
              value={activeEditorTab.content}
            />
          </article>
        </div>
      ) : (
        <div className="file-editor-layout">
          <article className="document-panel">
            <div className="document-header">
              <div>
                <p className="eyebrow">Workspace File</p>
                <h2>No file selected</h2>
              </div>
            </div>
            <div className="document-body">
              <p className="muted-copy">Open a text or code file from the right sidebar to edit it here.</p>
            </div>
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
