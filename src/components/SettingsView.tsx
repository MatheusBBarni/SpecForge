import {
  CheckCircle,
  CodeBracketsSquare,
  Database,
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
}

export const SettingsView = memo(function SettingsView({
  annotations,
  environment,
  theme,
  claudePath,
  codexPath,
  onThemeChange,
  onClaudePathChange,
  onCodexPathChange
}: SettingsViewProps) {
  return (
    <section className="grid gap-4 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)] backdrop-blur-[30px]">
        <div className="max-w-3xl">
          <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
            Settings
          </p>
          <h2 className="m-0 text-[1.4rem] font-semibold text-[var(--text-main)]">
            Environment and Theme Setup
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-subtle)]">
            Configure Claude CLI, Codex CLI, and the active theme in one place. The workspace
            view stays focused on review and execution.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className={PANEL_CLASS}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <Terminal className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">Claude CLI</span>
          </div>
          <EnvironmentCard entry={environment.claude} />
          <div className="flex flex-col gap-2">
            <label className={FIELD_LABEL_CLASS} htmlFor="settings-claude-path">
              Binary path override
            </label>
            <input
              className={INPUT_CLASS}
              id="settings-claude-path"
              onChange={(event) => onClaudePathChange(event.target.value)}
              placeholder="Optional manual path"
              value={claudePath}
            />
          </div>
        </article>

        <article className={PANEL_CLASS}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <CodeBracketsSquare className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">Codex CLI</span>
          </div>
          <EnvironmentCard entry={environment.codex} />
          <div className="flex flex-col gap-2">
            <label className={FIELD_LABEL_CLASS} htmlFor="settings-codex-path">
              Binary path override
            </label>
            <input
              className={INPUT_CLASS}
              id="settings-codex-path"
              onChange={(event) => onCodexPathChange(event.target.value)}
              placeholder="Optional manual path"
              value={codexPath}
            />
          </div>
        </article>

        <article className={`${PANEL_CLASS} xl:col-span-2`}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <SunLight className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">Theme</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { id: "dracula", label: "Dracula", meta: "Primary dark IDE theme" },
              { id: "light", label: "Light", meta: "High-contrast daylight palette" },
              { id: "system", label: "System", meta: "Follow the OS appearance" }
            ].map((entry) => (
              <button
                className={
                  theme === entry.id ? ACTIVE_OPTION_CARD_CLASS : OPTION_CARD_CLASS
                }
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

        <article className={`${PANEL_CLASS} xl:col-span-2`}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <CheckCircle className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">
              Review Flow Defaults
            </span>
          </div>
          <div className={LIST_CLASS}>
            <div>PRD and spec files are picked separately from the control deck.</div>
            <div>Stepped and milestone modes pause execution at approval boundaries.</div>
            <div>God Mode runs end to end unless a fatal error stops the agent loop.</div>
            <div>The Dracula theme remains the workspace default and is managed here.</div>
          </div>
        </article>

        <article className={`${PANEL_CLASS} xl:col-span-2`}>
          <div className="flex items-center gap-3 text-[var(--text-main)]">
            <Database className="size-5 text-[var(--accent-2)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.08em]">
              Workspace Conventions
            </span>
          </div>
          <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
            When you open a workspace folder from the right sidebar, SpecForge scans for the first
            matching document set using this priority:
          </p>
          <div className={LIST_CLASS}>
            <div>`PRD.md`, then `PRD.pdf`</div>
            <div>`spec.md`, then `spec.pdf`</div>
          </div>
          <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
            Matching files are loaded directly into the review panes so the workspace is ready
            without a second import step.
          </p>
        </article>

        {annotations.length > 0 ? (
          <article className={`${PANEL_CLASS} xl:col-span-2`}>
            <div className="flex items-center gap-3 text-[var(--text-main)]">
              <CheckCircle className="size-5 text-[var(--accent-2)]" />
              <span className="text-sm font-semibold uppercase tracking-[0.08em]">
                Workspace Notes
              </span>
            </div>
            <div className="grid gap-3">
              {annotations.map((annotation) => (
                <article className={getAnnotationClassName(annotation.tone)} key={annotation.id}>
                  <h3 className="m-0 text-base font-semibold text-[var(--text-main)]">
                    {annotation.title}
                  </h3>
                  <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
                    {annotation.body}
                  </p>
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
    <article className="grid gap-3 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-3">
        {entry.status === "found" ? (
          <CheckCircle className="size-5 text-[var(--success)]" />
        ) : (
          <WarningTriangle className="size-5 text-[var(--warning)]" />
        )}
        <div>
          <h3 className="m-0 text-base font-semibold text-[var(--text-main)]">{entry.name}</h3>
          <p className="m-0 text-sm text-[var(--text-subtle)]">{formatHealth(entry.status)}</p>
        </div>
      </div>
      <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">{entry.detail}</p>
      {entry.path ? (
        <code className="rounded-[0.5rem] bg-white/5 px-2 py-1 font-[var(--font-mono)] text-[0.85rem] text-[var(--text-main)]">
          {entry.path}
        </code>
      ) : null}
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

function getAnnotationClassName(tone: "info" | "warning" | "success") {
  const toneClass =
    tone === "info"
      ? "border-[rgba(139,233,253,0.24)]"
      : tone === "warning"
        ? "border-[rgba(255,184,108,0.3)]"
        : "border-[rgba(80,250,123,0.3)]";

  return `grid gap-2 rounded-[1rem] border ${toneClass} bg-[var(--bg-surface)] p-4`;
}

const PANEL_CLASS =
  "grid gap-4 rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)] backdrop-blur-[30px]";

const LIST_CLASS =
  "grid gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4 font-[var(--font-mono)] text-sm text-[var(--text-main)]";

const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

const INPUT_CLASS =
  "w-full rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[15px] text-[var(--text-main)] placeholder:text-[var(--text-muted)]";

const OPTION_CARD_CLASS =
  "grid gap-1 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4 text-left text-[var(--text-main)] transition hover:-translate-y-0.5 hover:border-[rgba(189,147,249,0.34)]";

const ACTIVE_OPTION_CARD_CLASS =
  "grid gap-1 rounded-[1rem] border border-[rgba(189,147,249,0.42)] bg-[linear-gradient(135deg,rgba(189,147,249,0.18),rgba(139,233,253,0.08)),var(--bg-surface)] px-4 py-4 text-left text-[var(--text-main)] transition";

export default SettingsView;
