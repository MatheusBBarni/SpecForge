import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CliHealthCard } from "./CliHealthCard";

describe("CliHealthCard", () => {
  it("shows tool readiness without exposing executable paths", () => {
    render(
      <CliHealthCard
        entry={{
          detail: "Install Codex CLI to discover models.",
          name: "Codex CLI",
          path: "C:/Users/example/AppData/Roaming/npm/codex.cmd",
          status: "found"
        }}
      />
    );

    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.queryByText(/codex\.cmd/i)).not.toBeInTheDocument();
  });
});
