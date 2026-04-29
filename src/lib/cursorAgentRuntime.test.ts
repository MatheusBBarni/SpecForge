import { describe, expect, it } from "vitest";
import {
  buildCursorPrdPrompt,
  buildCursorSpecPrompt,
  extractCursorRunText
} from "./cursorAgentRuntime";

describe("buildCursorPrdPrompt", () => {
  it("combines the agent description with operator context", () => {
    const prompt = buildCursorPrdPrompt({
      agentDescription: "You write PRDs.",
      userPrompt: "Build a desktop app for specs."
    });

    expect(prompt).toContain("You write PRDs.");
    expect(prompt).toContain("--- BEGIN OPERATOR CONTEXT ---");
    expect(prompt).toContain("Build a desktop app for specs.");
  });
});

describe("buildCursorSpecPrompt", () => {
  it("includes the PRD content after the operator context", () => {
    const prompt = buildCursorSpecPrompt({
      agentDescription: "You write specs.",
      userPrompt: "Use Tauri.",
      prdContent: "# Product"
    });

    expect(prompt).toContain("You write specs.");
    expect(prompt).toContain("Use Tauri.");
    expect(prompt).toContain("Attached Product Requirements Document (PRD)");
    expect(prompt).toContain("# Product");
  });
});

describe("extractCursorRunText", () => {
  it("prefers the run result when present", () => {
    expect(extractCursorRunText({ result: "Generated markdown" })).toBe("Generated markdown");
  });

  it("collects streamed assistant text blocks", () => {
    const text = extractCursorRunText(
      { result: "" },
      [
        {
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Hello" },
              { type: "text", text: " world" }
            ]
          }
        }
      ]
    );

    expect(text).toBe("Hello world");
  });
});
