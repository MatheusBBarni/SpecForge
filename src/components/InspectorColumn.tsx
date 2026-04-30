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
  workspaceNotice,
  folderInputRef,
  onOpenFolder,
  onFolderChange,
  onFileOpen
}: InspectorColumnProps) {
  const visibleWorkspaceEntries = useMemo(
    () => workspaceEntries.filter((entry) => !isGitDirectoryEntry(entry.path)),
    [workspaceEntries]
  );
  const workspaceTree = useMemo(() => buildWorkspaceTree(visibleWorkspaceEntries), [visibleWorkspaceEntries]);
  const directoryPaths = useMemo(() => collectDirectoryPaths(workspaceTree), [workspaceTree]);
  const directorySignature = useMemo(() => directoryPaths.join("\n"), [directoryPaths]);
  const previousDirectorySignatureRef = useRef("");
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>([]);
  const collapsedFoldersLookup = useMemo(() => new Set(collapsedFolders), [collapsedFolders]);

  useEffect(() => {
    if (previousDirectorySignatureRef.current === directorySignature) {
      return;
    }

    previousDirectorySignatureRef.current = directorySignature;
    setCollapsedFolders(directoryPaths);
  }, [directoryPaths, directorySignature]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsedFolders((currentValue) =>
      currentValue.includes(path)
        ? currentValue.filter((entry) => entry !== path)
        : [...currentValue, path]
    );
  }, []);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-[var(--bg-panel)] shadow-none">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-4 border-b border-[var(--border-strong)] px-4 py-2">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Workspace
          </p>
        </div>
        <button className={BUTTON_CLASS} onClick={onOpenFolder} type="button">
          <Folder className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 px-4 pt-4 pb-3 text-[var(--text-main)]">
          <Folder className="size-5 text-[var(--accent-2)]" />
          <span className="truncate text-sm font-medium">
            {workspaceRootName}
          </span>
        </div>
        {workspaceNotice ? (
          <p className="mx-4 mt-0 mb-3 text-sm leading-7 text-[var(--text-subtle)]">{workspaceNotice}</p>
        ) : null}
        <input
          {...directoryPickerProps}
          className="hidden"
          onChange={onFolderChange}
          ref={folderInputRef}
          type="file"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
          {workspaceTree.map((node) =>
            renderTreeNode(node, collapsedFoldersLookup, toggleFolder, onFileOpen)
          )}
          {visibleWorkspaceEntries.length === 0 ? (
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
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFolder(entry.path);
          }}
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

function isGitDirectoryEntry(path: string) {
  return path === ".git" || path.startsWith(".git/");
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

const BUTTON_CLASS =
  "inline-flex size-8 items-center justify-center rounded border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] p-0 text-[var(--text-main)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]";

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
