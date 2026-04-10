import {
  Folder,
  Page
} from "iconoir-react";
import type { ChangeEvent, RefObject } from "react";

import type { WorkspaceEntry } from "../types";

const directoryPickerProps = {
  directory: "",
  multiple: true,
  webkitdirectory: ""
};

interface InspectorColumnProps {
  workspaceEntries: WorkspaceEntry[];
  workspaceRootName: string;
  workspaceNotice: string;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onOpenFolder: () => void;
  onFolderChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function InspectorColumn({
  workspaceEntries,
  workspaceRootName,
  workspaceNotice,
  folderInputRef,
  onOpenFolder,
  onFolderChange
}: InspectorColumnProps) {
  return (
    <aside className="inspector-column panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>{workspaceRootName}</h2>
        </div>
        <button className="ghost-button" onClick={onOpenFolder} type="button">
          <Folder />
          Open Folder
        </button>
      </div>

      <div className="inspector-section">
        <div className="section-title">
          <Folder />
          <span>Project Files</span>
        </div>
        <p className="muted-copy">{workspaceNotice}</p>
        <input
          {...directoryPickerProps}
          className="hidden-file-input"
          onChange={onFolderChange}
          ref={folderInputRef}
          type="file"
        />
        <div className="tree-list">
          {workspaceEntries.map((entry) => (
            <div
              className="tree-entry"
              key={entry.path}
              style={{ paddingLeft: `${entry.depth * 18 + 12}px` }}
            >
              {entry.kind === "directory" ? <Folder /> : <Page />}
              <span>{entry.name}</span>
            </div>
          ))}
          {workspaceEntries.length === 0 ? (
            <p className="muted-copy">Open a folder to scan its documents and build a workspace tree.</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
