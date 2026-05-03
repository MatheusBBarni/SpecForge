import { describe, expect, it } from "vitest";
import type { WorkspaceDocument } from "../types";
import {
  getActiveDocumentFromPreview,
  getDocumentPreviewFileName,
  hasDocumentPreview
} from "./documentPreview";

describe("documentPreview", () => {
  const canonical: WorkspaceDocument = {
    content: "# Canonical",
    fileName: "PRD.md",
    sourcePath: "docs/PRD.md"
  };
  const preview: WorkspaceDocument = {
    content: "# Preview",
    fileName: "prd.md",
    sourcePath: ".specforge/previews/prd.md"
  };

  it("uses the preview document when one exists", () => {
    expect(getActiveDocumentFromPreview(canonical, preview)).toBe(preview);
  });

  it("falls back to the canonical document when preview is missing", () => {
    expect(getActiveDocumentFromPreview(canonical, null)).toBe(canonical);
  });

  it("reports preview presence from document content", () => {
    expect(hasDocumentPreview(preview)).toBe(true);
    expect(hasDocumentPreview(null)).toBe(false);
  });

  it("uses stable preview filenames per target", () => {
    expect(getDocumentPreviewFileName("prd")).toBe("prd.md");
    expect(getDocumentPreviewFileName("spec")).toBe("spec.md");
  });
});
