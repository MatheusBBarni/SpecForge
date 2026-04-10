import {
  Activity,
  ChatBubble,
  CheckCircle,
  Spark,
  Upload
} from "iconoir-react";
import { memo, type ChangeEvent, type RefObject } from "react";

import type {
  AutonomyMode,
  ModelId,
  SpecAnnotation
} from "../types";

type DocumentTarget = "prd" | "spec";

interface ControlColumnProps {
  selectedModel: ModelId;
  autonomyMode: AutonomyMode;
  selectedSpecText: string;
  reviewPrompt: string;
  annotations: SpecAnnotation[];
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
  onModeChange: (mode: AutonomyMode) => void;
  onReviewPromptChange: (value: string) => void;
  onApplyRefinement: () => void;
  onApproveSpec: () => void;
}

export const ControlColumn = memo(function ControlColumn({
  selectedModel,
  autonomyMode,
  selectedSpecText,
  reviewPrompt,
  annotations,
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
  onModeChange,
  onReviewPromptChange,
  onApplyRefinement,
  onApproveSpec
}: ControlColumnProps) {
  const handlePrdPick = () => {
    onImportTargetChange("prd");
    onFilePick();
  };

  const handleSpecPick = () => {
    onImportTargetChange("spec");
    onFilePick();
  };

  return (
    <section className="control-column panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Control Deck</p>
          <h1>SpecForge Review</h1>
        </div>
        <div className="panel-badge">
          <Spark />
          MVP
        </div>
      </div>

      <div className="control-section">
        <div className="section-title">
          <Upload />
          <span>Ingestion</span>
        </div>
        <div className="dropzone">
          <p>Load Markdown or PDF directly into PRD or spec.</p>
          <div className="button-row">
            <button className="ghost-button" onClick={handlePrdPick} type="button">
              Choose PRD File
            </button>
            <button className="ghost-button" onClick={handleSpecPick} type="button">
              Choose Spec File
            </button>
          </div>
          <input
            accept=".md,.pdf"
            className="hidden-file-input"
            onChange={onFileChange}
            ref={fileInputRef}
            type="file"
          />
        </div>

        <div className="field-stack">
          <label className="field-label" htmlFor="path-import">
            Open from path
          </label>
          <input
            id="path-import"
            onChange={(event) => onImportPathChange(event.target.value)}
            placeholder="docs/PRD.md"
            value={importPath}
          />
        </div>
        <div className="field-stack">
          <label className="field-label" htmlFor="path-target">
            Load target
          </label>
          <select
            id="path-target"
            onChange={(event) => onImportTargetChange(event.target.value as DocumentTarget)}
            value={importTarget}
          >
            <option value="prd">PRD</option>
            <option value="spec">Spec</option>
          </select>
        </div>

        <button
          className="primary-button primary-button-wide"
          disabled={isImporting}
          onClick={onPathImport}
          type="button"
        >
          {isImporting ? "Parsing..." : "Parse Document"}
        </button>
        {importError ? <p className="inline-error">{importError}</p> : null}
      </div>

      <div className="control-section">
        <div className="section-title">
          <Activity />
          <span>Agent Configuration</span>
        </div>
        <div className="field-stack">
          <label className="field-label" htmlFor="selected-model">
            Agent model
          </label>
          <select
            id="selected-model"
            onChange={(event) => onModelChange(event.target.value as ModelId)}
            value={selectedModel}
          >
            <option value="gpt-5.4">GPT-5.4</option>
            <option value="claude-3.7">Claude 3.7</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        <div className="field-stack">
          <label className="field-label" htmlFor="autonomy-mode">
            Approval mode
          </label>
          <select
            id="autonomy-mode"
            onChange={(event) => onModeChange(event.target.value as AutonomyMode)}
            value={autonomyMode}
          >
            <option value="stepped">Stepped Approval</option>
            <option value="milestone">Milestone Approval</option>
            <option value="god_mode">God Mode</option>
          </select>
        </div>
      </div>

      <div className="control-section">
        <div className="section-title">
          <ChatBubble />
          <span>Inline Refinement</span>
        </div>
        <p className="muted-copy">
          Highlight text in the spec editor to scope the next revision.
        </p>

        <div className="selection-preview">
          <span>Selected scope</span>
          <p>{selectedSpecText || "No spec text selected yet."}</p>
        </div>

        <textarea
          onChange={(event) => onReviewPromptChange(event.target.value)}
          placeholder="Ask the agent to tighten requirements, add endpoints, or expand acceptance criteria."
          rows={4}
          value={reviewPrompt}
        />

        <div className="button-row">
          <button
            className="ghost-button"
            disabled={!reviewPrompt.trim()}
            onClick={onApplyRefinement}
            type="button"
          >
            <Spark />
            Apply Refinement
          </button>
          <button className="primary-button" onClick={onApproveSpec} type="button">
            <CheckCircle />
            {isSpecApproved ? "Approved" : "Approve Spec"}
          </button>
        </div>
      </div>
    </section>
  );
});

export default ControlColumn;
