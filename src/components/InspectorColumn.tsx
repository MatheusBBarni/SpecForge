import {
  NavArrowDown,
  NavArrowRight,
  Folder,
  Page
} from "iconoir-react";
import { memo, useCallback, useEffect, useMemo, useState, type ChangeEvent, type RefObject } from "react";

import type { WorkspaceEntry } from "../types";

const directoryPickerProps = {
  directory: "",
  multiple: true,
  webkitdirectory: ""
};

interface InspectorColumnProps {
  workspaceEntries: WorkspaceEntry[];
  hasWorkspaceEntries: boolean;
  emptyStateMessage: string;
  workspaceRootName: string;
  workspaceNotice: string;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onOpenFolder: () => void;
  onFolderChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFileOpen: (path: string) => void;
}

interface WorkspaceTreeNode {
  entry: WorkspaceEntry;
  children: WorkspaceTreeNode[];
}

export const InspectorColumn = memo(function InspectorColumn({
  workspaceEntries,
  hasWorkspaceEntries,
  emptyStateMessage,
  workspaceRootName,
  workspaceNotice,
  folderInputRef,
  onOpenFolder,
  onFolderChange,
  onFileOpen
}: InspectorColumnProps) {
  const workspaceTree = useMemo(() => buildWorkspaceTree(workspaceEntries), [workspaceEntries]);
  const directoryPaths = useMemo(
    () => collectDirectoryPaths(workspaceTree),
    [workspaceTree]
  );
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>(() => directoryPaths);
  const collapsedFoldersLookup = useMemo(() => new Set(collapsedFolders), [collapsedFolders]);

  useEffect(() => {
    setCollapsedFolders(directoryPaths);
  }, [directoryPaths, workspaceRootName]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsedFolders((currentValue) =>
      currentValue.includes(path)
        ? currentValue.filter((entry) => entry !== path)
        : [...currentValue, path]
    );
  }, []);

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
          {workspaceTree.map((node) =>
            renderTreeNode(node, collapsedFoldersLookup, toggleFolder, onFileOpen)
          )}
          {workspaceEntries.length === 0 ? (
            <p className="muted-copy">
              {hasWorkspaceEntries ? emptyStateMessage : "Open a folder to scan its documents and build a workspace tree."}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
});

function renderTreeNode(
  node: WorkspaceTreeNode,
  collapsedFolders: Set<string>,
  onToggleFolder: (path: string) => void,
  onFileOpen: (path: string) => void
) {
  const { entry, children } = node;
  const isDirectory = entry.kind === "directory";
  const isCollapsed = isDirectory && collapsedFolders.has(entry.path);
  const hasChildren = children.length > 0;

  return (
    <div className="tree-node" key={entry.path}>
      {isDirectory ? (
        <button
          aria-expanded={!isCollapsed}
          className="tree-entry tree-entry-button"
          onClick={() => onToggleFolder(entry.path)}
          style={{ paddingLeft: `${entry.depth * 18 + 12}px` }}
          type="button"
        >
          <span className="tree-entry-caret">
            {hasChildren ? (isCollapsed ? <NavArrowRight /> : <NavArrowDown />) : null}
          </span>
          <Folder />
          <span>{entry.name}</span>
        </button>
      ) : (
        <button
          className="tree-entry tree-entry-button"
          onClick={() => onFileOpen(entry.path)}
          style={{ paddingLeft: `${entry.depth * 18 + 12}px` }}
          type="button"
        >
          <span className="tree-entry-caret" />
          <Page />
          <span>{entry.name}</span>
        </button>
      )}
      {isDirectory && !isCollapsed ? children.map((child) => renderTreeNode(child, collapsedFolders, onToggleFolder, onFileOpen)) : null}
    </div>
  );
}

function buildWorkspaceTree(entries: WorkspaceEntry[]) {
  const nodes = new Map<string, WorkspaceTreeNode>();

  for (const entry of entries) {
    upsertWorkspaceNode(nodes, entry);
    ensureAncestorDirectories(nodes, entry.path);
  }

  const rootNodes: WorkspaceTreeNode[] = [];

  for (const node of nodes.values()) {
    node.children = [];
  }

  for (const node of nodes.values()) {
    const parentPath = getParentPath(node.entry.path);

    if (!parentPath) {
      rootNodes.push(node);
      continue;
    }

    const parentNode = nodes.get(parentPath);

    if (parentNode) {
      parentNode.children.push(node);
      continue;
    }

    rootNodes.push(node);
  }

  sortWorkspaceTree(rootNodes);
  return rootNodes;
}

function collectDirectoryPaths(nodes: WorkspaceTreeNode[]) {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.entry.kind === "directory") {
      paths.push(node.entry.path);
    }

    paths.push(...collectDirectoryPaths(node.children));
  }

  return paths;
}

function upsertWorkspaceNode(
  nodes: Map<string, WorkspaceTreeNode>,
  entry: WorkspaceEntry
) {
  const existingNode = nodes.get(entry.path);

  if (existingNode) {
    existingNode.entry = entry;
    return existingNode;
  }

  const nextNode: WorkspaceTreeNode = {
    entry,
    children: []
  };

  nodes.set(entry.path, nextNode);
  return nextNode;
}

function ensureAncestorDirectories(
  nodes: Map<string, WorkspaceTreeNode>,
  path: string
) {
  let currentPath = getParentPath(path);

  while (currentPath) {
    if (!nodes.has(currentPath)) {
      upsertWorkspaceNode(nodes, {
        name: currentPath.split("/").pop() ?? currentPath,
        path: currentPath,
        kind: "directory",
        depth: currentPath.split("/").length - 1
      });
    }

    currentPath = getParentPath(currentPath);
  }
}

function getParentPath(path: string) {
  const separatorIndex = path.lastIndexOf("/");

  return separatorIndex >= 0 ? path.slice(0, separatorIndex) : "";
}

function sortWorkspaceTree(nodes: WorkspaceTreeNode[]) {
  nodes.sort(compareWorkspaceNodes);

  for (const node of nodes) {
    if (node.children.length > 0) {
      sortWorkspaceTree(node.children);
    }
  }
}

function compareWorkspaceNodes(left: WorkspaceTreeNode, right: WorkspaceTreeNode) {
  if (left.entry.kind !== right.entry.kind) {
    return left.entry.kind === "directory" ? -1 : 1;
  }

  const nameComparison = left.entry.name.localeCompare(right.entry.name, undefined, {
    numeric: true,
    sensitivity: "base"
  });

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.entry.path.localeCompare(right.entry.path);
}
