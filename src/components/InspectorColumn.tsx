import {
  NavArrowDown,
  NavArrowRight,
  Folder,
  Page
} from "iconoir-react";
import { useEffect, useMemo, useState, type ChangeEvent, type RefObject } from "react";

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
  onFileOpen: (path: string) => void;
}

export function InspectorColumn({
  workspaceEntries,
  workspaceRootName,
  workspaceNotice,
  folderInputRef,
  onOpenFolder,
  onFolderChange,
  onFileOpen
}: InspectorColumnProps) {
  const workspaceSignature = workspaceEntries
    .map((entry) => `${entry.kind}:${entry.path}`)
    .join("|");
  const directoryPaths = useMemo(
    () => workspaceEntries.filter((entry) => entry.kind === "directory").map((entry) => entry.path),
    [workspaceSignature]
  );
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>(() => directoryPaths);
  const visibleEntries = useMemo(
    () => workspaceEntries.filter((entry) => isEntryVisible(entry, collapsedFolders)),
    [collapsedFolders, workspaceSignature]
  );

  useEffect(() => {
    setCollapsedFolders(directoryPaths);
  }, [directoryPaths, workspaceRootName]);

  function toggleFolder(path: string) {
    setCollapsedFolders((currentValue) =>
      currentValue.includes(path)
        ? currentValue.filter((entry) => entry !== path)
        : [...currentValue, path]
    );
  }

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
          {visibleEntries.map((entry) =>
            entry.kind === "directory" ? (
              <button
                className="tree-entry tree-entry-button"
                key={entry.path}
                onClick={() => toggleFolder(entry.path)}
                style={{ paddingLeft: `${entry.depth * 18 + 12}px` }}
                type="button"
              >
                {collapsedFolders.includes(entry.path) ? <NavArrowRight /> : <NavArrowDown />}
                <Folder />
                <span>{entry.name}</span>
              </button>
            ) : (
              <button
                className="tree-entry tree-entry-button"
                key={entry.path}
                onClick={() => onFileOpen(entry.path)}
                style={{ paddingLeft: `${entry.depth * 18 + 12}px` }}
                type="button"
              >
                <span className="tree-entry-spacer" />
                <Page />
                <span>{entry.name}</span>
              </button>
            )
          )}
          {workspaceEntries.length === 0 ? (
            <p className="muted-copy">Open a folder to scan its documents and build a workspace tree.</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function isEntryVisible(entry: WorkspaceEntry, collapsedFolders: string[]) {
  const segments = entry.path.split("/");

  for (let index = 0; index < segments.length - 1; index += 1) {
    const ancestorPath = segments.slice(0, index + 1).join("/");

    if (collapsedFolders.includes(ancestorPath)) {
      return false;
    }
  }

  return true;
}
