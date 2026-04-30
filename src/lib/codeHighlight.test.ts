import { describe, expect, it } from "vitest";
import { detectCodeLanguage, tokenizeCodeLine } from "./codeHighlight";

describe("detectCodeLanguage", () => {
  it("detects common file types from paths", () => {
    expect(detectCodeLanguage("settings.json")).toBe("json");
    expect(detectCodeLanguage("src/App.tsx")).toBe("typescript");
    expect(detectCodeLanguage("README.md")).toBe("markdown");
    expect(detectCodeLanguage("src-tauri/src/lib.rs")).toBe("rust");
  });

  it("falls back to plaintext for unknown extensions", () => {
    expect(detectCodeLanguage("notes.unknown")).toBe("plaintext");
  });
});

describe("tokenizeCodeLine", () => {
  it("classifies JSON tokens for syntax coloring", () => {
    expect(tokenizeCodeLine('  "enabled": true, "count": 12', "json")).toEqual([
      { kind: "plain", text: "  " },
      { kind: "key", text: '"enabled"' },
      { kind: "punctuation", text: ":" },
      { kind: "plain", text: " " },
      { kind: "literal", text: "true" },
      { kind: "punctuation", text: "," },
      { kind: "plain", text: " " },
      { kind: "key", text: '"count"' },
      { kind: "punctuation", text: ":" },
      { kind: "plain", text: " " },
      { kind: "number", text: "12" },
    ]);
  });

  it("keeps plaintext as a single token", () => {
    expect(tokenizeCodeLine("plain words", "plaintext")).toEqual([
      { kind: "plain", text: "plain words" },
    ]);
  });
});
