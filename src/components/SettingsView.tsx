import {
  CheckCircle,
  CodeBracketsSquare,
  Database,
  RefreshCircle,
  SunLight,
  Terminal,
  WarningTriangle
} from "iconoir-react";
import { memo } from "react";

import type { EnvironmentStatus, SpecAnnotation, ThemeMode } from "../types";

interface SettingsViewProps {
  annotations: SpecAnnotation[];
  environment: EnvironmentStatus;
  theme: ThemeMode;
  claudePath: string;
  codexPath: string;
  onThemeChange: (theme: ThemeMode) => void;
  onClaudePathChange: (value: string) => void;
  onCodexPathChange: (value: string) => void;
  onRefresh: () => void;
}

export const SettingsView = memo(function SettingsView({
  annotations,
  environment,
  theme,
  claudePath,
  codexPath,
  onThemeChange,
  onClaudePathChange,
  onCodexPathChange,
  onRefresh
}: SettingsViewProps) {
  return (
    <section className="settings-page">
      <div className="settings-hero panel">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Environment and Theme Setup</h1>
          <p className="hero-copy">
            Configure Claude CLI, Codex CLI, and the active theme in one place. The workspace
            view stays focused on review and execution.
          </p>
        </div>
        <button className="ghost-button" onClick={onRefresh} type="button">
          <RefreshCircle />
          Refresh Status
        </button>
      </div>

      <div className="settings-grid">
        <article className="settings-panel">
          <div className="section-title">
            <Terminal />
            <span>Claude CLI</span>
          </div>
          <EnvironmentCard entry={environment.claude} />
          <div className="field-stack">
            <label className="field-label" htmlFor="settings-claude-path">
              Binary path override
            </label>
            <input
              id="settings-claude-path"
              onChange={(event) => onClaudePathChange(event.target.value)}
              placeholder="Optional manual path"
              value={claudePath}
            />
          </div>
        </article>

        <article className="settings-panel">
          <div className="section-title">
            <CodeBracketsSquare />
            <span>Codex CLI</span>
          </div>
          <EnvironmentCard entry={environment.codex} />
          <div className="field-stack">
            <label className="field-label" htmlFor="settings-codex-path">
              Binary path override
            </label>
            <input
              id="settings-codex-path"
              onChange={(event) => onCodexPathChange(event.target.value)}
              placeholder="Optional manual path"
              value={codexPath}
            />
          </div>
        </article>

        <article className="settings-panel settings-panel-wide">
          <div className="section-title">
            <SunLight />
            <span>Theme</span>
          </div>
          <div className="option-grid option-grid-inline">
            {[
              { id: "dracula", label: "Dracula", meta: "Primary dark IDE theme" },
              { id: "light", label: "Light", meta: "High-contrast daylight palette" },
              { id: "system", label: "System", meta: "Follow the OS appearance" }
            ].map((entry) => (
              <button
                className={theme === entry.id ? "option-card option-card-active" : "option-card"}
                key={entry.id}
                onClick={() => onThemeChange(entry.id as ThemeMode)}
                type="button"
              >
                <span>{entry.label}</span>
                <small>{entry.meta}</small>
              </button>
            ))}
          </div>
        </article>

        <article className="settings-panel settings-panel-wide">
          <div className="section-title">
            <CheckCircle />
            <span>Review Flow Defaults</span>
          </div>
          <div className="settings-list">
            <div>PRD and spec files are picked separately from the control deck.</div>
            <div>Stepped and milestone modes pause execution at approval boundaries.</div>
            <div>God Mode runs end to end unless a fatal error stops the agent loop.</div>
            <div>The Dracula theme remains the workspace default and is managed here.</div>
          </div>
        </article>

        <article className="settings-panel settings-panel-wide">
          <div className="section-title">
            <Database />
            <span>Workspace Conventions</span>
          </div>
          <p className="muted-copy">
            When you open a workspace folder from the right sidebar, SpecForge scans for the first
            matching document set using this priority:
          </p>
          <div className="settings-list">
            <div>`PRD.md`, then `PRD.pdf`</div>
            <div>`spec.md`, then `spec.pdf`</div>
          </div>
          <p className="muted-copy">
            Matching files are loaded directly into the review panes so the workspace is ready
            without a second import step.
          </p>
        </article>

        {annotations.length > 0 ? (
          <article className="settings-panel settings-panel-wide">
            <div className="section-title">
              <CheckCircle />
              <span>Workspace Notes</span>
            </div>
            <div className="note-stack">
              {annotations.map((annotation) => (
                <article className={`note-card note-card-${annotation.tone}`} key={annotation.id}>
                  <h3>{annotation.title}</h3>
                  <p>{annotation.body}</p>
                </article>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
});

const EnvironmentCard = memo(function EnvironmentCard({
  entry
}: {
  entry: EnvironmentStatus["claude"];
}) {
  return (
    <article className="health-card">
      <div className="health-title">
        {entry.status === "found" ? <CheckCircle /> : <WarningTriangle />}
        <div>
          <h3>{entry.name}</h3>
          <p>{formatHealth(entry.status)}</p>
        </div>
      </div>
      <p className="muted-copy">{entry.detail}</p>
      {entry.path ? <code>{entry.path}</code> : null}
    </article>
  );
});

function formatHealth(status: EnvironmentStatus["claude"]["status"]) {
  if (status === "found") {
    return "Ready";
  }

  if (status === "unauthorized") {
    return "Needs authentication";
  }

  return "Missing";
}

export default SettingsView;
