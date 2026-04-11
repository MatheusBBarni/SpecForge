import { Database, Folder } from "iconoir-react";
import { memo } from "react";

interface ProjectDocumentsCardProps {
  configPath: string;
  workspaceRootName: string;
  prdPath: string;
  specPath: string;
  supportingDocumentsValue: string;
  onPrdPathChange: (value: string) => void;
  onSpecPathChange: (value: string) => void;
  onSupportingDocumentsChange: (value: string) => void;
}

export const ProjectDocumentsCard = memo(function ProjectDocumentsCard({
  configPath,
  workspaceRootName,
  prdPath,
  specPath,
  supportingDocumentsValue,
  onPrdPathChange,
  onSpecPathChange,
  onSupportingDocumentsChange
}: ProjectDocumentsCardProps) {
  return (
    <article className={PANEL_CLASS}>
      <div className="flex items-center gap-3 text-[var(--text-main)]">
        <Database className="size-5 text-[var(--accent-2)]" />
        <span className="text-sm font-semibold uppercase tracking-[0.08em]">
          Document Paths
        </span>
      </div>

      <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
        Paths are stored relative to <code>{workspaceRootName || "the selected workspace"}</code>{" "}
        in <code>{configPath || ".specforge/settings.json"}</code>.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className={FIELD_LABEL_CLASS}>PRD path</span>
          <input
            className={INPUT_CLASS}
            onChange={(event) => onPrdPathChange(event.target.value)}
            placeholder="docs/PRD.md"
            value={prdPath}
          />
        </label>

        <label className="grid gap-2">
          <span className={FIELD_LABEL_CLASS}>Spec path</span>
          <input
            className={INPUT_CLASS}
            onChange={(event) => onSpecPathChange(event.target.value)}
            placeholder="docs/SPEC.md"
            value={specPath}
          />
        </label>
      </div>

      <label className="grid gap-2">
        <span className={FIELD_LABEL_CLASS}>Additional documents</span>
        <textarea
          className={TEXTAREA_CLASS}
          onChange={(event) => onSupportingDocumentsChange(event.target.value)}
          placeholder={"docs/notes/constraints.md\ndocs/research/api.md"}
          value={supportingDocumentsValue}
        />
        <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">
          Add one relative path per line for any extra references you want to keep with the
          project.
        </p>
      </label>

      <div className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-4">
        <div className="flex items-start gap-3">
          <Folder className="mt-1 size-4 shrink-0 text-[var(--accent-2)]" />
          <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
            Generated AI documents are written to the configured PRD and SPEC paths. Configure
            Markdown targets if you want the generated output saved back into the workspace.
          </p>
        </div>
      </div>
    </article>
  );
});

const PANEL_CLASS =
  "grid gap-4 rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)] backdrop-blur-[30px]";

const FIELD_LABEL_CLASS =
  "text-sm font-medium leading-6 text-[var(--text-subtle)]";

const INPUT_CLASS =
  "w-full rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-3 text-[15px] text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]";

const TEXTAREA_CLASS =
  "min-h-[8rem] w-full resize-y rounded-[1rem] border border-[var(--border-soft)] bg-black/20 px-4 py-4 font-[var(--font-mono)] text-[15px] leading-6 text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]";
