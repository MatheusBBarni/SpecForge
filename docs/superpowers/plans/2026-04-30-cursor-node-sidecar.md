# Cursor Node Sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Bun-on-PATH Cursor runner bridge with a packaged Cursor SDK sidecar that Rust can launch reliably in development and bundled desktop builds.

**Architecture:** Keep Tauri/Rust as the trusted desktop backend for filesystem, keyring, workspace validation, document writes, git diffing, and process supervision. Move all `@cursor/sdk` calls into one compiled Bun sidecar executable with a small JSON protocol over stdin/stdout JSON lines. Keep the React webview contract unchanged through `src/lib/runtime.ts`.

**Tech Stack:** Tauri 2, Rust `std::process::Command`, Bun `build --compile`, TypeScript, `@cursor/sdk`, Vitest, existing OS keyring integration.

---

## Context And Constraints

Current state:

- `src-tauri/src/cursor_agent.rs` shells out to `bun` from `PATH`.
- Rust runs source files directly: `src/cursorAgentRunner.ts` and `src/cursorModelsRunner.ts`.
- This works in a dev checkout but is fragile for packaged desktop builds because users may not have Bun installed and source `.ts` files are not a stable runtime asset.

Current docs checked:

- Tauri 2 sidecar docs support bundled external binaries through `bundle.externalBin` and require target-triple sidecar names such as `name-x86_64-pc-windows-msvc.exe`.
- Tauri docs show sidecars can communicate through stdin/stdout and stream output.
- Bun docs support single-file executables with `bun build --compile`, including Windows targets and automatic `.exe` output.

Approval gates:

- Changing `src-tauri/tauri.conf.json` needs explicit user approval under this repo's `AGENTS.md`.
- Adding `tauri-plugin-shell` would be a new runtime dependency and also needs approval. This plan avoids that dependency by launching the bundled binary with `std::process::Command`.

## File Structure

Create:

- `src/lib/cursorSidecarProtocol.ts`: shared TypeScript request/response/event types and pure helpers.
- `src/cursorSidecar.ts`: single sidecar executable entrypoint that dispatches `listModels` and `runAgentPrompt`.
- `scripts/build-cursor-sidecar.ts`: builds the sidecar executable and writes it to `src-tauri/binaries/specforge-cursor-sidecar-<target-triple>[.exe]`.
- `src/lib/cursorSidecarProtocol.test.ts`: unit tests for protocol normalization and output parsing helpers.

Modify:

- `package.json`: add `sidecar:build`; update Tauri scripts to build the sidecar before launching/packaging.
- `src-tauri/tauri.conf.json`: add `bundle.externalBin` after explicit approval.
- `src-tauri/src/cursor_agent.rs`: launch the packaged sidecar binary instead of resolving `bun` and `.ts` runner paths.
- `src-tauri/Cargo.toml`: no new dependency expected.
- `docs/SPEC.md`: update architecture text from “Bun TypeScript runner” to “packaged Cursor SDK sidecar”.

Remove after migration:

- `src/cursorAgentRunner.ts`
- `src/cursorModelsRunner.ts`

---

### Task 1: Add The TypeScript Sidecar Protocol

**Files:**

- Create: `src/lib/cursorSidecarProtocol.ts`
- Create: `src/lib/cursorSidecarProtocol.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Create `src/lib/cursorSidecarProtocol.test.ts`:

```ts
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
    expect(() => parseSidecarOutputLine("{broken")).toThrow("Cursor sidecar returned malformed JSON");
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
bun run test -- src/lib/cursorSidecarProtocol.test.ts
```

Expected: FAIL because `src/lib/cursorSidecarProtocol.ts` does not exist.

- [ ] **Step 3: Implement protocol helpers**

Create `src/lib/cursorSidecarProtocol.ts`:

```ts
import type { CursorModel, ModelId, ReasoningProfileId } from "../types";

export type CursorSidecarRequest =
  | {
      command: "listModels";
      apiKey?: string;
    }
  | {
      command: "runAgentPrompt";
      apiKey: string;
      workspaceRoot: string;
      model: ModelId;
      reasoning: ReasoningProfileId;
      prompt: string;
    };

export type CursorSidecarOutputLine =
  | { type: "event"; text: string }
  | { type: "result"; content: string }
  | { type: "models"; models: CursorModel[] };

export interface SdkModelParameterValue {
  value: string;
  displayName?: string;
}

export interface SdkModelParameter {
  id: string;
  displayName?: string;
  values?: SdkModelParameterValue[];
}

export interface SdkModel {
  id: string;
  displayName?: string;
  description?: string;
  parameters?: SdkModelParameter[];
}

export type CursorStreamEvent = {
  type?: string;
  message?: {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
  text?: string;
  name?: string;
  status?: string;
};

export function parseSidecarOutputLine(line: string): CursorSidecarOutputLine {
  try {
    const parsed = JSON.parse(line) as CursorSidecarOutputLine;

    if (parsed.type === "event" && typeof parsed.text === "string") {
      return parsed;
    }

    if (parsed.type === "result" && typeof parsed.content === "string") {
      return parsed;
    }

    if (parsed.type === "models" && Array.isArray(parsed.models)) {
      return parsed;
    }
  } catch (error) {
    throw new Error(
      `Cursor sidecar returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  throw new Error(`Cursor sidecar returned an unsupported output line: ${line}`);
}

export function normalizeCursorModels(models: SdkModel[]): CursorModel[] {
  return models
    .filter((model) => model.id.trim().length > 0)
    .map((model) => ({
      id: model.id,
      label: model.displayName?.trim() || formatLabel(model.id),
      description: model.description?.trim() || undefined,
      parameters: model.parameters
        ?.map((parameter) => ({
          id: parameter.id,
          label: parameter.displayName?.trim() || formatLabel(parameter.id),
          values: (parameter.values ?? [])
            .filter((entry) => entry.value.trim().length > 0)
            .map((entry) => ({
              value: entry.value,
              label: entry.displayName?.trim() || formatLabel(entry.value)
            }))
        }))
        .filter((parameter) => parameter.values.length > 0)
    }));
}

export function extractCursorRunText(
  runResult?: { result?: string },
  events: CursorStreamEvent[] = []
) {
  if (runResult?.result?.trim()) {
    return runResult.result.trim();
  }

  return events
    .flatMap((event) =>
      event.type === "assistant"
        ? event.message?.content
            ?.filter((block) => block.type === "text" && block.text)
            .map((block) => block.text ?? "") ?? []
        : []
    )
    .join("")
    .trim();
}

export function formatCursorStreamEvent(event: CursorStreamEvent) {
  switch (event.type) {
    case "thinking":
      return event.text?.trim() ? `[thinking] ${event.text.trim()}` : "";
    case "tool_call":
      return event.name ? `[tool] ${event.name}${event.status ? `: ${event.status}` : ""}` : "";
    case "status":
      return event.status ? `[status] ${event.status}` : "";
    default:
      return "";
  }
}

export function stripWrappingCodeFence(content: string) {
  const trimmed = content.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0]?.trimStart() ?? "";
  const lastLine = lines[lines.length - 1]?.trimStart() ?? "";

  if (!firstLine.startsWith("```") || !lastLine.startsWith("```")) {
    return trimmed;
  }

  return lines.slice(1, -1).join("\n").trim();
}

function formatLabel(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
```

- [ ] **Step 4: Run the protocol tests**

Run:

```powershell
bun run test -- src/lib/cursorSidecarProtocol.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/cursorSidecarProtocol.ts src/lib/cursorSidecarProtocol.test.ts
git commit -m "test: add cursor sidecar protocol"
```

---

### Task 2: Build One Cursor SDK Sidecar Entrypoint

**Files:**

- Create: `src/cursorSidecar.ts`
- Modify: `src/cursorAgentRunner.ts`
- Modify: `src/cursorModelsRunner.ts`

- [ ] **Step 1: Create the sidecar entrypoint**

Create `src/cursorSidecar.ts`:

```ts
import { Agent, Cursor } from "@cursor/sdk";
import {
  extractCursorRunText,
  formatCursorStreamEvent,
  normalizeCursorModels,
  stripWrappingCodeFence,
  type CursorSidecarOutputLine,
  type CursorSidecarRequest,
  type CursorStreamEvent,
  type SdkModel
} from "./lib/cursorSidecarProtocol";

async function main() {
  const request = JSON.parse(await readStdin()) as CursorSidecarRequest;

  switch (request.command) {
    case "listModels": {
      const models = await Cursor.models.list(
        request.apiKey?.trim() ? { apiKey: request.apiKey.trim() } : undefined
      );
      writeOutputLine({ type: "models", models: normalizeCursorModels(models as SdkModel[]) });
      return;
    }

    case "runAgentPrompt": {
      await runAgentPrompt(request);
      return;
    }
  }
}

async function runAgentPrompt(request: Extract<CursorSidecarRequest, { command: "runAgentPrompt" }>) {
  const agent = await Agent.create({
    apiKey: request.apiKey,
    model: {
      id: request.model,
      params: [{ id: "thinking", value: request.reasoning === "max" ? "high" : request.reasoning }]
    },
    local: { cwd: request.workspaceRoot }
  });
  const events: CursorStreamEvent[] = [];

  try {
    const run = await agent.send(request.prompt);

    for await (const event of run.stream() as AsyncGenerator<CursorStreamEvent>) {
      events.push(event);
      const text = formatCursorStreamEvent(event);

      if (text) {
        writeOutputLine({ type: "event", text });
      }
    }

    const result = await run.wait();
    const content = extractCursorRunText(result, events);

    if (!content.trim()) {
      throw new Error("Cursor SDK returned an empty response.");
    }

    writeOutputLine({ type: "result", content: stripWrappingCodeFence(content) });
  } finally {
    agent.close();
  }
}

async function readStdin() {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8") || "{}";
}

function writeOutputLine(line: CursorSidecarOutputLine) {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Keep legacy runner paths as thin compatibility wrappers**

Replace `src/cursorModelsRunner.ts` with:

```ts
import { Cursor } from "@cursor/sdk";
import { normalizeCursorModels, type SdkModel } from "./lib/cursorSidecarProtocol";

interface CursorModelsRunnerRequest {
  apiKey?: string;
}

async function main() {
  const request = JSON.parse(await readStdin()) as CursorModelsRunnerRequest;
  const models = await Cursor.models.list(
    request.apiKey?.trim() ? { apiKey: request.apiKey.trim() } : undefined
  );

  process.stdout.write(JSON.stringify(normalizeCursorModels(models as SdkModel[])));
}

async function readStdin() {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8") || "{}";
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
```

Replace duplicated helper code in `src/cursorAgentRunner.ts` by importing `extractCursorRunText`, `formatCursorStreamEvent`, and `stripWrappingCodeFence` from `./lib/cursorSidecarProtocol`.

- [ ] **Step 3: Typecheck**

Run:

```powershell
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/cursorSidecar.ts src/cursorAgentRunner.ts src/cursorModelsRunner.ts
git commit -m "refactor: unify cursor sdk runner entrypoint"
```

---

### Task 3: Add A Sidecar Build Script

**Files:**

- Create: `scripts/build-cursor-sidecar.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the sidecar build script**

Create `scripts/build-cursor-sidecar.ts`:

```ts
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const sidecarName = "specforge-cursor-sidecar";
const targetTriple = execFileSync("rustc", ["--print", "host-tuple"], {
  cwd: repoRoot,
  encoding: "utf8"
}).trim();
const extension = process.platform === "win32" ? ".exe" : "";
const outputPath = join(
  repoRoot,
  "src-tauri",
  "binaries",
  `${sidecarName}-${targetTriple}${extension}`
);

mkdirSync(dirname(outputPath), { recursive: true });
rmSync(outputPath, { force: true });

const result = await Bun.build({
  entrypoints: [join(repoRoot, "src", "cursorSidecar.ts")],
  compile: {
    outfile: outputPath
  },
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  }
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built Cursor sidecar: ${outputPath}`);
```

- [ ] **Step 2: Add package scripts**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "sidecar:build": "bun scripts/build-cursor-sidecar.ts",
    "tauri:dev": "bun run sidecar:build && tauri dev",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "bun ./node_modules/@biomejs/biome/bin/biome check src",
    "lint:fix": "bun ./node_modules/@biomejs/biome/bin/biome check --fix src",
    "preview": "vite preview",
    "tauri": "tauri"
  }
}
```

- [ ] **Step 3: Build the sidecar**

Run:

```powershell
bun run sidecar:build
```

Expected: creates `src-tauri/binaries/specforge-cursor-sidecar-x86_64-pc-windows-msvc.exe` on this Windows workspace, or the matching host triple on another machine.

- [ ] **Step 4: Typecheck**

Run:

```powershell
bun run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add package.json scripts/build-cursor-sidecar.ts src-tauri/binaries/.gitkeep
git commit -m "build: compile cursor sdk sidecar"
```

If `src-tauri/binaries/.gitkeep` does not exist, create it so the directory is tracked while generated sidecar binaries remain ignored.

---

### Task 4: Configure Tauri To Bundle The Sidecar

**Files:**

- Modify: `src-tauri/tauri.conf.json`
- Modify: `.gitignore`

- [ ] **Step 1: Get explicit approval**

Ask:

```text
This task modifies src-tauri/tauri.conf.json to bundle the Cursor sidecar. Approve that config change?
```

Expected: continue only after the user approves.

- [ ] **Step 2: Add the external binary config**

Modify `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "active": false,
    "externalBin": ["binaries/specforge-cursor-sidecar"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 3: Ignore generated sidecar binaries**

Add to `.gitignore`:

```gitignore
src-tauri/binaries/specforge-cursor-sidecar-*
!src-tauri/binaries/.gitkeep
```

- [ ] **Step 4: Validate config**

Run:

```powershell
cargo check --manifest-path .\src-tauri\Cargo.toml
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/tauri.conf.json .gitignore src-tauri/binaries/.gitkeep
git commit -m "build: bundle cursor sidecar with tauri"
```

---

### Task 5: Teach Rust To Launch The Packaged Sidecar

**Files:**

- Modify: `src-tauri/src/cursor_agent.rs`

- [ ] **Step 1: Add a Rust unit for output parsing before changing process launch**

Append tests to `src-tauri/src/cursor_agent.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_runner_output_reads_result_and_events() {
        let output = "{\"type\":\"event\",\"text\":\"[status] running\"}\n{\"type\":\"result\",\"content\":\"Done\"}\n";
        let parsed = parse_runner_output(output).expect("output should parse");

        assert_eq!(parsed.content, "Done");
        assert_eq!(parsed.events, vec![String::from("[status] running")]);
    }

    #[test]
    fn parse_model_output_reads_models_line() {
        let output = "{\"type\":\"models\",\"models\":[{\"id\":\"composer-2\",\"label\":\"Composer 2\"}]}\n";
        let parsed = parse_model_output(output).expect("models should parse");

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].id, "composer-2");
    }
}
```

- [ ] **Step 2: Run Rust tests and verify failure**

Run:

```powershell
cargo test --manifest-path .\src-tauri\Cargo.toml cursor_agent
```

Expected: FAIL because `parse_model_output` does not exist yet and `parse_runner_output` still expects only event/result lines.

- [ ] **Step 3: Replace Bun resolution with sidecar path resolution**

In `src-tauri/src/cursor_agent.rs`, remove direct `which::which("bun")` and runner path checks. Add:

```rust
fn resolve_cursor_sidecar_path() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("SPECFORGE_CURSOR_SIDECAR") {
        let path = PathBuf::from(path);

        if path.exists() {
            return Ok(path);
        }

        return Err(format!(
            "SPECFORGE_CURSOR_SIDECAR points to a missing file: {}.",
            path.display()
        ));
    }

    let app_root = resolve_app_root()?;
    let target_triple = option_env!("TAURI_ENV_TARGET_TRIPLE")
        .map(str::to_string)
        .or_else(|| host_target_triple().ok())
        .ok_or_else(|| String::from("Unable to determine the Cursor sidecar target triple."))?;
    let extension = if cfg!(windows) { ".exe" } else { "" };
    let sidecar_path = app_root.join("src-tauri").join("binaries").join(format!(
        "specforge-cursor-sidecar-{target_triple}{extension}"
    ));

    if sidecar_path.exists() {
        Ok(sidecar_path)
    } else {
        Err(format!(
            "Cursor SDK sidecar was not found at {}. Run `bun run sidecar:build` first.",
            sidecar_path.display()
        ))
    }
}

fn host_target_triple() -> Result<String, String> {
    let output = Command::new("rustc")
        .arg("--print")
        .arg("host-tuple")
        .output()
        .map_err(|error| format!("Unable to query rustc host tuple: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
```

- [ ] **Step 4: Send command-tagged requests to the sidecar**

Change the Rust request structs:

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "command")]
enum CursorSidecarRequest {
    #[serde(rename = "runAgentPrompt")]
    RunAgentPrompt {
        api_key: String,
        workspace_root: String,
        model: String,
        reasoning: String,
        prompt: String,
    },
    #[serde(rename = "listModels")]
    ListModels { api_key: Option<String> },
}
```

Update `run_cursor_agent_prompt_sync` to serialize `CursorSidecarRequest::RunAgentPrompt`.

Update `list_cursor_models_sync` to serialize `CursorSidecarRequest::ListModels`.

- [ ] **Step 5: Extract process execution into one helper**

Add:

```rust
fn run_cursor_sidecar(request: &CursorSidecarRequest) -> Result<String, String> {
    let sidecar_path = resolve_cursor_sidecar_path()?;
    let request_json = serde_json::to_vec(request)
        .map_err(|error| format!("Unable to prepare Cursor sidecar request: {error}"))?;
    let mut child = Command::new(&sidecar_path)
        .env("NO_COLOR", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!(
                "Unable to start the Cursor SDK sidecar at {}: {error}",
                sidecar_path.display()
            )
        })?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| String::from("Unable to open the Cursor SDK sidecar input."))?;
    stdin
        .write_all(&request_json)
        .map_err(|error| format!("Unable to send the Cursor SDK sidecar request: {error}"))?;
    drop(stdin);

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Unable to read Cursor SDK sidecar output: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format_process_failure(&stderr, &stdout));
    }

    Ok(stdout)
}
```

- [ ] **Step 6: Parse model sidecar output**

Add:

```rust
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum CursorSidecarOutputLine {
    Event { text: String },
    Result { content: String },
    Models { models: Vec<CursorModel> },
}

fn parse_model_output(stdout: &str) -> Result<Vec<CursorModel>, String> {
    for line in stdout.lines().filter(|line| !line.trim().is_empty()) {
        let parsed: CursorSidecarOutputLine = serde_json::from_str(line).map_err(|error| {
            format!("Cursor SDK sidecar returned malformed output: {error}. Output line: {line}")
        })?;

        if let CursorSidecarOutputLine::Models { models } = parsed {
            return Ok(models);
        }
    }

    Err(String::from("Cursor SDK sidecar returned no model list."))
}
```

Update `parse_runner_output` to use `CursorSidecarOutputLine` and ignore `Models`.

- [ ] **Step 7: Run Rust checks**

Run:

```powershell
cargo test --manifest-path .\src-tauri\Cargo.toml cursor_agent
cargo check --manifest-path .\src-tauri\Cargo.toml
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src-tauri/src/cursor_agent.rs
git commit -m "fix: launch packaged cursor sidecar"
```

---

### Task 6: Remove The Legacy Runner Files

**Files:**

- Delete: `src/cursorAgentRunner.ts`
- Delete: `src/cursorModelsRunner.ts`
- Modify: `docs/SPEC.md`

- [ ] **Step 1: Search for legacy runner references**

Run:

```powershell
Get-ChildItem -Path src,src-tauri,docs -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\target\\' } |
  Select-String -Pattern 'cursorAgentRunner','cursorModelsRunner','Bun TypeScript runner' -CaseSensitive:$false |
  Select-Object Path,LineNumber,Line
```

Expected: references exist in docs and possibly the deleted files only.

- [ ] **Step 2: Delete legacy runner files**

Delete:

```powershell
Remove-Item -LiteralPath .\src\cursorAgentRunner.ts
Remove-Item -LiteralPath .\src\cursorModelsRunner.ts
```

- [ ] **Step 3: Update docs**

In `docs/SPEC.md`, replace the architecture bullets with:

```md
* **React webview:** Owns routing, topic/session management UI, PRD/spec editing, workspace browsing, settings, passive rendering of runtime output, and PRD/spec prompt orchestration.
* **Cursor SDK sidecar:** Owns `@cursor/sdk` execution for PRD/spec generation because the SDK local runtime requires a Node-compatible process and cannot be bundled into the browser webview. The sidecar is compiled during desktop builds and communicates with Rust through a typed JSON stdin/stdout protocol.
* **Tauri/Rust backend:** Owns filesystem access, workspace scanning, session persistence, git diffing, native dialogs, PDF parsing, OS credential storage for the Cursor API key, generated document saving, sidecar supervision, and chat event streaming.
```

In section `5. PRD/Spec Generation`, replace runner-specific bullets with:

```md
* `src/lib/cursorAgentRuntime.ts` composes Cursor prompts and invokes the desktop Cursor sidecar command through Rust.
* `src/cursorSidecar.ts` creates the local Cursor SDK agent, streams run events, waits for completion, lists available models, and emits structured JSON lines.
* Rust validates the workspace root, reads the Cursor API key from OS credential storage, launches the packaged sidecar, and parses its structured JSON-line output.
```

- [ ] **Step 4: Verify no legacy references remain**

Run:

```powershell
Get-ChildItem -Path src,src-tauri,docs -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\target\\' } |
  Select-String -Pattern 'cursorAgentRunner','cursorModelsRunner','Bun TypeScript runner' -CaseSensitive:$false |
  Select-Object Path,LineNumber,Line
```

Expected: no output.

- [ ] **Step 5: Run frontend checks**

Run:

```powershell
bun run test
bun run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src docs/SPEC.md
git commit -m "docs: document cursor sidecar architecture"
```

---

### Task 7: End-To-End Runtime Verification

**Files:**

- No source changes expected.

- [ ] **Step 1: Build sidecar and frontend**

Run:

```powershell
bun run sidecar:build
bun run build
```

Expected: both PASS.

- [ ] **Step 2: Check Rust**

Run:

```powershell
cargo check --manifest-path .\src-tauri\Cargo.toml
```

Expected: PASS.

- [ ] **Step 3: Start Tauri dev**

Run:

```powershell
bun run tauri:dev
```

Expected: app launches and the sidecar binary is found without requiring `bun` at runtime.

- [ ] **Step 4: Manual Cursor smoke test**

In the app:

1. Open Settings.
2. Save a valid Cursor API key.
3. Confirm model list loads.
4. Open a project folder.
5. Run PRD generation with a short prompt.
6. Confirm the terminal/event log shows Cursor status/tool events.
7. Confirm generated Markdown is non-empty and can be saved through the existing document flow.

Expected: no error mentioning missing Bun, missing `.ts` runner, or malformed sidecar output.

- [ ] **Step 5: Commit verification-only doc note if needed**

If verification uncovers a necessary docs clarification, update `docs/SPEC.md` and commit:

```powershell
git add docs/SPEC.md
git commit -m "docs: clarify cursor sidecar verification"
```

If no docs change is needed, do not create an empty commit.

---

## Final Verification

Run these before calling the work complete:

```powershell
bun run test
bun run build
cargo test --manifest-path .\src-tauri\Cargo.toml cursor_agent
cargo check --manifest-path .\src-tauri\Cargo.toml
bun run sidecar:build
```

Expected:

- All commands exit successfully.
- `src-tauri/binaries/specforge-cursor-sidecar-<target-triple>[.exe]` exists locally.
- No runtime path depends on `which::which("bun")`.
- No app path references `src/cursorAgentRunner.ts` or `src/cursorModelsRunner.ts`.
- `docs/SPEC.md` describes the packaged sidecar rather than source TypeScript runners.

## Self-Review

Spec coverage:

- The plan keeps Rust as the trusted desktop backend.
- The plan keeps `@cursor/sdk` inside a Node-compatible sidecar.
- The plan removes runtime dependence on Bun from the packaged app.
- The plan updates shipped docs.
- The plan includes the required approval gate before changing `src-tauri/tauri.conf.json`.

Placeholder scan:

- No placeholder markers or unspecified implementation steps remain.

Type consistency:

- TypeScript sidecar requests use command tags: `listModels` and `runAgentPrompt`.
- Rust serializes the same command tags through `CursorSidecarRequest`.
- Sidecar output lines use `event`, `result`, and `models`.
