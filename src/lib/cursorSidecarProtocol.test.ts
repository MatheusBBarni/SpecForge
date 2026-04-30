import { describe, expect, it } from "vitest";

import {
  formatCursorStreamEvent,
  normalizeCursorModels,
  parseSidecarOutputLine,
  stripWrappingCodeFence
} from "./cursorSidecarProtocol";

describe("cursor sidecar protocol", () => {
  it("parses event output lines", () => {
    expect(parseSidecarOutputLine('{"type":"event","text":"[status] queued"}')).toEqual({
      type: "event",
      text: "[status] queued"
    });
  });

  it("parses result output lines", () => {
    expect(parseSidecarOutputLine('{"type":"result","content":"Done"}')).toEqual({
      type: "result",
      content: "Done"
    });
  });

  it("rejects malformed output lines", () => {
    expect(() => parseSidecarOutputLine("{broken")).toThrow(
      "Cursor sidecar returned malformed JSON"
    );
  });

  it("normalizes Cursor models", () => {
    expect(
      normalizeCursorModels([
        {
          id: "composer-2",
          displayName: "Composer 2",
          parameters: [
            {
              id: "thinking",
              values: [{ value: "medium", displayName: "Medium" }]
            }
          ]
        }
      ])
    ).toEqual([
      {
        id: "composer-2",
        label: "Composer 2",
        description: undefined,
        parameters: [
          {
            id: "thinking",
            label: "Thinking",
            values: [{ value: "medium", label: "Medium" }]
          }
        ]
      }
    ]);
  });

  it("formats known stream events", () => {
    expect(formatCursorStreamEvent({ type: "thinking", text: "Checking files" })).toBe(
      "[thinking] Checking files"
    );
    expect(formatCursorStreamEvent({ type: "tool_call", name: "grep", status: "running" })).toBe(
      "[tool] grep: running"
    );
    expect(formatCursorStreamEvent({ type: "status", status: "complete" })).toBe(
      "[status] complete"
    );
  });

  it("strips a wrapping markdown code fence", () => {
    expect(stripWrappingCodeFence("```md\n# Title\n```")).toBe("# Title");
  });
});
