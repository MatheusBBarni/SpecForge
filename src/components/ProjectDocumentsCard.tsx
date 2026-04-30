import {
  Card,
  Input,
  TextArea
} from "@heroui/react";
import { Database, Folder } from "iconoir-react";
import { memo } from "react";

import {
  FIELD_LABEL_CLASS,
  INPUT_CLASS,
  ScopedPathReference,
  SETTINGS_CARD_BODY_CLASS,
  SETTINGS_CARD_HEADER_CLASS,
  SETTINGS_PANEL_CLASS,
  SETTINGS_SURFACE_CLASS,
  SettingsSectionHeader,
  TEXTAREA_CLASS
} from "./SettingsPrimitives";

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
    <Card className={`${SETTINGS_PANEL_CLASS} rounded-lg`}>
      <div className={SETTINGS_CARD_HEADER_CLASS}>
        <SettingsSectionHeader icon={<Database className="size-5" />} title="Document Context" />
      </div>
      <Card.Content className={SETTINGS_CARD_BODY_CLASS}>
        <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--text-subtle)]">
          <span>Paths are stored relative to the active workspace in</span>
          <ScopedPathReference path={configPath} workspaceRootName={workspaceRootName} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2" htmlFor="settings-prd-path">
            <span className={FIELD_LABEL_CLASS}>PRD path</span>
            <Input
              className={INPUT_CLASS}
              id="settings-prd-path"
              onChange={(event) => onPrdPathChange(event.target.value)}
              placeholder="docs/PRD.md"
              value={prdPath}
            />
          </label>

          <label className="grid gap-2" htmlFor="settings-spec-path">
            <span className={FIELD_LABEL_CLASS}>Spec path</span>
            <Input
              className={INPUT_CLASS}
              id="settings-spec-path"
              onChange={(event) => onSpecPathChange(event.target.value)}
              placeholder="docs/SPEC.md"
              value={specPath}
            />
          </label>
        </div>

        <label className="grid gap-2" htmlFor="settings-supporting-documents">
          <span className={FIELD_LABEL_CLASS}>Additional documents</span>
          <TextArea
            className={TEXTAREA_CLASS}
            id="settings-supporting-documents"
            onChange={(event) => onSupportingDocumentsChange(event.target.value)}
            placeholder={"docs/notes/constraints.md\ndocs/research/api.md"}
            value={supportingDocumentsValue}
          />
          <p className="m-0 text-sm leading-6 text-[var(--text-subtle)]">
            Add one relative path per line for any extra references you want to keep with the
            project.
          </p>
        </label>

        <div className={`${SETTINGS_SURFACE_CLASS} px-4 py-4`}>
          <div className="flex items-start gap-3">
            <Folder className="mt-1 size-4 shrink-0 text-[var(--accent)]" />
            <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
              Generated AI documents are written to the configured PRD and SPEC paths. Configure
              Markdown targets if you want the generated output saved back into the workspace.
            </p>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
});
