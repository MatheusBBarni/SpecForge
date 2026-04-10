import ignore from "ignore";

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

interface NormalizedWorkspaceFile {
  file: ImportableFile;
  normalizedPath: string;
  relativePath: string;
}

interface GitIgnoreMatcher {
  directoryPath: string;
  matcher: ignore.Ignore;
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
  if (files.length === 0) {
    return files;
  }

  const normalizedFiles = normalizeWorkspaceFiles(files);
  const gitignoreMatchers = await buildGitIgnoreMatchers(normalizedFiles);

  if (gitignoreMatchers.length === 0) {
    return files;
  }

  return normalizedFiles
    .filter((entry) => isGitIgnoreFile(entry.relativePath) || !isIgnored(entry.relativePath, gitignoreMatchers))
    .map((entry) => entry.file);
}

export async function parseWorkspaceDocument(
  file: ImportableFile
): Promise<ParsedWorkspaceDocument> {
  const extension = getExtension(file.name);

  if (extension === "pdf") {
    throw new Error(
      `PDF parsing for ${file.name} is only available in the desktop app. Use the native picker or convert the file to Markdown.`
    );
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

function normalizeWorkspaceFiles(files: ImportableFile[]): NormalizedWorkspaceFile[] {
  const normalizedPaths = files
    .map((file) => normalizePath(getRelativeFilePath(file)))
    .filter((path) => path.length > 0);
  const rootName = resolveWorkspaceRootName(normalizedPaths);

  return files
    .map((file) => {
      const normalizedPath = normalizePath(getRelativeFilePath(file));
      return {
        file,
        normalizedPath,
        relativePath: stripRootName(normalizedPath, rootName)
      };
    })
    .filter((entry) => entry.relativePath.length > 0);
}

async function buildGitIgnoreMatchers(
  files: NormalizedWorkspaceFile[]
): Promise<GitIgnoreMatcher[]> {
  const gitignoreFiles = files.filter((entry) => isGitIgnoreFile(entry.relativePath));
  const matchers = await Promise.all(
    gitignoreFiles.map(async (entry) => ({
      directoryPath: getParentPath(entry.relativePath),
      matcher: ignore().add(await entry.file.text())
    }))
  );

  return matchers.sort((left, right) => left.directoryPath.length - right.directoryPath.length);
}

function isIgnored(path: string, matchers: GitIgnoreMatcher[]) {
  let ignored = false;

  for (const matcher of matchers) {
    if (!isPathInDirectory(path, matcher.directoryPath)) {
      continue;
    }

    const relativePath = stripDirectoryPrefix(path, matcher.directoryPath);
    const result = matcher.matcher.test(relativePath);

    if (result.ignored) {
      ignored = true;
    }

    if (result.unignored) {
      ignored = false;
    }
  }

  return ignored;
}

function isGitIgnoreFile(path: string) {
  return path.split("/").slice(-1)[0]?.toLowerCase() === ".gitignore";
}

function getParentPath(path: string) {
  const separatorIndex = path.lastIndexOf("/");
  return separatorIndex >= 0 ? path.slice(0, separatorIndex) : "";
}

function isPathInDirectory(path: string, directoryPath: string) {
  return directoryPath.length === 0 || path === directoryPath || path.startsWith(`${directoryPath}/`);
}

function stripDirectoryPrefix(path: string, directoryPath: string) {
  if (!directoryPath) {
    return path;
  }

  return path.startsWith(`${directoryPath}/`) ? path.slice(directoryPath.length + 1) : path;
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
  const leftSegments = left.path.split("/");
  const rightSegments = right.path.split("/");
  const maxSharedDepth = Math.min(leftSegments.length, rightSegments.length);

  for (let index = 0; index < maxSharedDepth; index += 1) {
    if (leftSegments[index] === rightSegments[index]) {
      continue;
    }

    const leftIsDirectory = index < leftSegments.length - 1 || left.kind === "directory";
    const rightIsDirectory = index < rightSegments.length - 1 || right.kind === "directory";

    if (leftIsDirectory !== rightIsDirectory) {
      return leftIsDirectory ? -1 : 1;
    }

    return leftSegments[index].localeCompare(rightSegments[index]);
  }

  if (leftSegments.length !== rightSegments.length) {
    return leftSegments.length - rightSegments.length;
  }

  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }

  return left.path.localeCompare(right.path);
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}
