import ignore from "ignore";

import { parseDocument } from "./runtime";

import type { WorkspaceEntry } from "../types";

export type ImportableFile = File & {
  path?: string;
  webkitRelativePath?: string;
};

interface WorkspaceImportSnapshot {
  rootName: string;
  entries: WorkspaceEntry[];
}

interface ProjectDocumentMatches {
  prdFile: ImportableFile | null;
  specFile: ImportableFile | null;
}

interface ParsedWorkspaceDocument {
  content: string;
  sourcePath: string;
}

export function buildWorkspaceImportSnapshot(files: ImportableFile[]): WorkspaceImportSnapshot {
  const normalizedPaths = files
    .map((file) => normalizePath(getRelativeFilePath(file)))
    .filter((path) => path.length > 0);

  const rootName = resolveWorkspaceRootName(normalizedPaths);
  const directoryEntries = new Map<string, WorkspaceEntry>();
  const fileEntries: WorkspaceEntry[] = [];

  for (const normalizedPath of normalizedPaths) {
    const trimmedPath = stripRootName(normalizedPath, rootName);
    const segments = trimmedPath.split("/").filter(Boolean);

    if (segments.length === 0) {
      continue;
    }

    for (let index = 0; index < segments.length - 1; index += 1) {
      const directoryPath = segments.slice(0, index + 1).join("/");

      if (!directoryEntries.has(directoryPath)) {
        directoryEntries.set(directoryPath, {
          name: segments[index],
          path: directoryPath,
          kind: "directory",
          depth: index
        });
      }
    }

    fileEntries.push({
      name: segments[segments.length - 1],
      path: segments.join("/"),
      kind: "file",
      depth: segments.length - 1
    });
  }

  const entries = [...directoryEntries.values(), ...fileEntries].sort(sortWorkspaceEntries);

  return {
    rootName: rootName || "Workspace",
    entries
  };
}

export function findProjectDocuments(files: ImportableFile[]): ProjectDocumentMatches {
  return {
    prdFile: pickDocument(files, ["prd.md", "prd.pdf"]),
    specFile: pickDocument(files, ["spec.md", "spec.pdf"])
  };
}

export async function filterWorkspaceFiles(files: ImportableFile[]) {
  const gitignoreFile = files.find(
    (file) => normalizePath(getRelativeFilePath(file)).toLowerCase() === ".gitignore"
  );

  if (!gitignoreFile) {
    return files;
  }

  const matcher = ignore();
  const gitignoreContents = await gitignoreFile.text();
  matcher.add(gitignoreContents);

  return files.filter((file) => {
    const normalizedPath = normalizePath(getRelativeFilePath(file));
    return normalizedPath === ".gitignore" || !matcher.ignores(normalizedPath);
  });
}

export async function parseWorkspaceDocument(
  file: ImportableFile
): Promise<ParsedWorkspaceDocument> {
  const extension = getExtension(file.name);

  if (extension === "pdf") {
    if (!file.path) {
      throw new Error(`PDF parsing for ${file.name} requires the desktop runtime file path.`);
    }

    return {
      content: await parseDocument(file.path),
      sourcePath: file.path
    };
  }

  return {
    content: await file.text(),
    sourcePath: file.path ?? getRelativeFilePath(file)
  };
}

export async function parseWorkspaceTextFile(file: ImportableFile) {
  return {
    content: await file.text(),
    sourcePath: file.path ?? getRelativeFilePath(file)
  };
}

export function isOpenableTextFile(file: ImportableFile) {
  const extension = getExtension(file.name);
  const textExtensions = new Set([
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "css",
    "html",
    "md",
    "txt",
    "toml",
    "rs",
    "yml",
    "yaml",
    "lock",
    "gitignore"
  ]);

  if (file.type.startsWith("text/")) {
    return true;
  }

  return textExtensions.has(extension) || file.name.toLowerCase() === ".gitignore";
}

function pickDocument(files: ImportableFile[], expectedNames: string[]) {
  const rankedFiles = files
    .filter((file) => expectedNames.includes(file.name.toLowerCase()))
    .sort((left, right) => {
      const leftRank = expectedNames.indexOf(left.name.toLowerCase());
      const rightRank = expectedNames.indexOf(right.name.toLowerCase());

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftDepth = getRelativeFilePath(left).split("/").length;
      const rightDepth = getRelativeFilePath(right).split("/").length;

      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth;
      }

      return getRelativeFilePath(left).localeCompare(getRelativeFilePath(right));
    });

  return rankedFiles[0] ?? null;
}

function getRelativeFilePath(file: ImportableFile) {
  return normalizePath(file.webkitRelativePath || file.name);
}

function getExtension(fileName: string) {
  const segments = fileName.toLowerCase().split(".");
  return segments.length > 1 ? segments[segments.length - 1] : "";
}

function resolveWorkspaceRootName(paths: string[]) {
  if (paths.length === 0) {
    return "Workspace";
  }

  const firstSegment = paths[0]?.split("/")[0];

  if (!firstSegment) {
    return "Workspace";
  }

  return paths.every((path) => path.startsWith(`${firstSegment}/`) || path === firstSegment)
    ? firstSegment
    : "Workspace";
}

function stripRootName(path: string, rootName: string) {
  if (!rootName || rootName === "Workspace") {
    return path;
  }

  return path.startsWith(`${rootName}/`) ? path.slice(rootName.length + 1) : path;
}

function sortWorkspaceEntries(left: WorkspaceEntry, right: WorkspaceEntry) {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }

  if (left.depth !== right.depth) {
    return left.depth - right.depth;
  }

  return left.path.localeCompare(right.path);
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}
