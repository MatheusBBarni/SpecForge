import {
  CheckCircle,
  CodeBracketsSquare,
  Terminal,
  XmarkCircle
} from "iconoir-react";
import type { ChangeEvent } from "react";

import { DiffPreview } from "./DiffPreview";
import { MarkdownDocument } from "./MarkdownDocument";
import type {
  AgentStatus,
  PaneMode,
  WorkspaceTab
} from "../types";

interface MainWorkspaceProps {
  activeTab: WorkspaceTab;
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
  onApproveExecutionGate: () => void;
  onEmergencyStop: () => void;
}

export function MainWorkspace({
  activeTab,
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
  onApproveExecutionGate,
  onEmergencyStop
}: MainWorkspaceProps) {
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
      </div>

      {activeTab === "review" ? (
        <div className="document-grid">
          <article className="document-panel">
            <div className="document-header">
              <div>
                <p className="eyebrow">Source PRD</p>
                <h2>{prdPath}</h2>
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
                <h2>{specPath}</h2>
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
      ) : (
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
      )}
    </section>
  );
}
