import type { WorkspaceDocument } from "../types";
import type { DocumentTarget } from "./appShell";

export function getActiveDocumentFromPreview(
  canonicalDocument: WorkspaceDocument | null,
  previewDocument: WorkspaceDocument | null
) {
  return previewDocument ?? canonicalDocument;
}

export function hasDocumentPreview(previewDocument: WorkspaceDocument | null) {
  return previewDocument !== null && previewDocument.content.trim().length > 0;
}

export function getDocumentPreviewFileName(target: DocumentTarget) {
  return `${target}.md`;
}
