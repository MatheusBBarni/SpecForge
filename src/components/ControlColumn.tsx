import {
  Activity,
  ChatBubble,
  CheckCircle,
  Spark,
  Upload
} from "iconoir-react";
import type { ChangeEvent, RefObject } from "react";

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

export function ControlColumn({
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

      <div className="hero-card">
        <div>
          <p className="eyebrow">Current Runbook</p>
          <h2>PRD to technical spec, then agent execution.</h2>
        </div>
        <p className="hero-copy">
          The workspace keeps the source requirements and approved specification side by side,
          then moves directly into milestone-based execution with diff gates and a kill switch.
        </p>
      </div>

      <div className="control-section">
        <div className="section-title">
          <Upload />
          <span>Ingestion</span>
        </div>
        <div className="dropzone">
          <p>Load Markdown or PDF into the PRD or spec pane.</p>
          <button className="ghost-button" onClick={onFilePick} type="button">
            Choose File
          </button>
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

        <div className="segmented-control">
          <button
            className={importTarget === "prd" ? "segment-active" : ""}
            onClick={() => onImportTargetChange("prd")}
            type="button"
          >
            Load into PRD
          </button>
          <button
            className={importTarget === "spec" ? "segment-active" : ""}
            onClick={() => onImportTargetChange("spec")}
            type="button"
          >
            Load into Spec
          </button>
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

        <div className="option-grid">
          {[
            { id: "gpt-5.4", label: "GPT-5.4", meta: "Highest leverage for implementation" },
            { id: "claude-3.7", label: "Claude 3.7", meta: "Strong at document expansion" },
            { id: "hybrid", label: "Hybrid", meta: "Use both CLIs by milestone" }
          ].map((model) => (
            <button
              className={selectedModel === model.id ? "option-card option-card-active" : "option-card"}
              key={model.id}
              onClick={() => onModelChange(model.id as ModelId)}
              type="button"
            >
              <span>{model.label}</span>
              <small>{model.meta}</small>
            </button>
          ))}
        </div>

        <div className="option-grid">
          {[
            {
              id: "stepped",
              label: "Stepped Approval",
              meta: "Pause before each write or command"
            },
            {
              id: "milestone",
              label: "Milestone Approval",
              meta: "Stop at logical completion boundaries"
            },
            {
              id: "god_mode",
              label: "God Mode",
              meta: "Run end to end unless a fatal error occurs"
            }
          ].map((mode) => (
            <button
              className={autonomyMode === mode.id ? "option-card option-card-active" : "option-card"}
              key={mode.id}
              onClick={() => onModeChange(mode.id as AutonomyMode)}
              type="button"
            >
              <span>{mode.label}</span>
              <small>{mode.meta}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <div className="section-title">
          <ChatBubble />
          <span>Inline Refinement</span>
        </div>
        <p className="muted-copy">
          Highlight text in the spec editor to scope the next revision. The generated change is appended
          as a new refinement block so the approval chain remains explicit.
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

      <div className="note-stack">
        {annotations.map((annotation) => (
          <article className={`note-card note-card-${annotation.tone}`} key={annotation.id}>
            <h3>{annotation.title}</h3>
            <p>{annotation.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
