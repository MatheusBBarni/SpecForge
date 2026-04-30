import {
  Folder,
  NavArrowDown,
  NavArrowRight,
  Page
} from "iconoir-react";
import {
  type ChangeEvent,
  memo,
  type RefObject, 
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

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
  workspaceRootPath: string;
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
  workspaceRootPath,
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
  const previousWorkspaceRootPathRef = useRef(workspaceRootPath);

  useEffect(() => {
    setCollapsedFolders((currentValue) => {
      if (previousWorkspaceRootPathRef.current !== workspaceRootPath) {
        previousWorkspaceRootPathRef.current = workspaceRootPath;
        return directoryPaths;
      }

      const currentLookup = new Set(currentValue);
      const nextValue = [...currentValue];
      let hasNewDirectory = false;

      for (const path of directoryPaths) {
        if (currentLookup.has(path)) {
          continue;
        }

        nextValue.push(path);
        hasNewDirectory = true;
      }

      return hasNewDirectory ? nextValue : currentValue;
    });
  }, [directoryPaths, workspaceRootPath]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsedFolders((currentValue) =>
      currentValue.includes(path)
        ? currentValue.filter((entry) => entry !== path)
        : [...currentValue, path]
    );
  }, []);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">
            Workspace
          </p>
          <h2 className="m-0 truncate text-lg font-semibold text-[var(--text-main)]">
            {workspaceRootName}
          </h2>
        </div>
        <button className={BUTTON_CLASS} onClick={onOpenFolder} type="button">
          <Folder className="size-5" />
          Open Folder
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-3 text-[var(--text-main)]">
          <Folder className="size-5 text-[var(--accent-2)]" />
          <span className="text-sm font-semibold uppercase tracking-[0.08em]">
            Project Files
          </span>
        </div>
        <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">{workspaceNotice}</p>
        <input
          {...directoryPickerProps}
          className="hidden"
          onChange={onFolderChange}
          ref={folderInputRef}
          type="file"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto pr-1">
          {workspaceTree.map((node) =>
            renderTreeNode(node, collapsedFoldersLookup, toggleFolder, onFileOpen)
          )}
          {workspaceEntries.length === 0 ? (
            <p className="m-0 text-sm leading-7 text-[var(--text-subtle)]">
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
    <div key={entry.path}>
      {isDirectory ? (
        <button
          aria-expanded={!isCollapsed}
          className="flex w-full items-center gap-3 rounded py-2 pr-3 text-left text-[var(--text-muted)] transition hover:bg-[var(--bg-nav-active)] hover:text-[var(--text-main)]"
          onClick={() => onToggleFolder(entry.path)}
          style={{ paddingLeft: `${entry.depth * 18 + 12}px` }}
          type="button"
        >
          <span className="inline-flex w-4 flex-none items-center justify-center">
            {hasChildren ? (isCollapsed ? <NavArrowRight /> : <NavArrowDown />) : null}
          </span>
          <Folder className="size-4 flex-none" />
          <span className="truncate">{entry.name}</span>
        </button>
      ) : (
        <button
          className="flex w-full items-center gap-3 rounded py-2 pr-3 text-left text-[var(--text-muted)] transition hover:bg-[var(--bg-nav-active)] hover:text-[var(--text-main)]"
          onClick={() => onFileOpen(entry.path)}
          style={{ paddingLeft: `${entry.depth * 18 + 12}px` }}
          type="button"
        >
          <span className="inline-flex w-4 flex-none items-center justify-center" />
          <Page className="size-4 flex-none" />
          <span className="truncate">{entry.name}</span>
        </button>
      )}
      {isDirectory && !isCollapsed ? children.map((child) => renderTreeNode(child, collapsedFolders, onToggleFolder, onFileOpen)) : null}
    </div>
  );
}

const BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-4 py-3 font-medium text-[var(--text-main)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]";

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
