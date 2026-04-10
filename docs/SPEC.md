# Technical Specification: SpecForge (MVP)

## 1. System Architecture

SpecForge uses a bifurcated architecture facilitated by Tauri's Inter-Process Communication (IPC):

* **The Webview (Frontend):** Handles all UI, user interactions, AI chat interfaces, and state management.
* **The Core (Backend):** A Rust daemon running natively that handles file I/O, Git operations, and securely spawning/monitoring child processes (Claude CLI, Codex CLI).

## 2. Technology Stack

### 2.1. Frontend

* **Framework:** React 18+ (Strict Mode enabled).
* **Build Tool:** Vite (standard with Tauri).
* **Styling:** Tailwind CSS.
* **UI Components:** HeroUI (for accessible, pre-styled components, modals, sliders, and split panes).
* **Icons:** Iconoir (lightweight, consistent SVG icons).
* **State Management:** Zustand (ideal for handling rapid updates from streaming CLI outputs without unnecessary re-renders).
* **Markdown/Code Rendering:** `react-markdown` paired with `react-syntax-highlighter` for displaying the PRD, Spec, and diffs.

### 2.2. Backend & System

* **Framework:** Tauri (Rust).
* **CLI Execution:** Rust's standard `std::process::Command` with piped `stdout`/`stderr` for real-time streaming to the frontend.
* **Version Control:** `git2` crate (Rust bindings for `libgit2`) for programmatic commits, branching, and diff generation without relying on the system's Git executable.
* **File Parsing:** * *Markdown:* Handled directly via Rust `std::fs` reading.
  * *PDF:* `pdf-extract` or `lopdf` crate for extracting raw text buffers from uploaded PDFs.

## 3. Environment Analysis & Settings

### 3.1. CLI Detection & Validation (Rust Backend)

The Rust core performs a "Pre-flight Check" upon launch and when triggered via Settings.

* **Path Detection:** Uses the `which` crate (or `std::process::Command` invoking `where`/`which`) to locate `claude` and `codex` binaries across macOS and Windows.
* **Authentication Check:** Executes "dry-run" commands (`claude whoami` / `claude config` and the Codex CLI equivalent) to parse exit codes or `stdout`. Returns status: `Authenticated`, `Not Authenticated`, or `Binary Not Found`.

### 3.2. Settings Architecture (Frontend)

Implemented as a dedicated View/Modal using HeroUI.

* **CLI Configuration Dashboard:** Displays visual status indicators (Iconoir) for Claude and Codex CLIs. Provides optional input fields for users to define manual binary paths.
* **Theme Management:** Supports Dark, Light, and System themes. Preference is persisted locally via `tauri-plugin-store` and toggled via the Tailwind `.dark` class on the root HTML element.

## 4. Data Models & State Management (Zustand)

The frontend utilizes three primary Zustand stores to separate concerns:

### 4.1. `useProjectStore`

Manages the core documents and configuration.

```typescript
interface ProjectState {
  prdContent: string | null;
  specContent: string | null;
  selectedModel: 'claude' | 'gpt4o';
  autonomyMode: 'stepped' | 'milestone' | 'god_mode';
  
  setPrdContent: (content: string) => void;
  setSpecContent: (content: string) => void;
  setAutonomyMode: (mode: 'stepped' | 'milestone' | 'god_mode') => void;
}
```

### 4.2. `useAgentStore`

Manages the real-time execution and CLI streaming.

```typescript
interface AgentState {
  status: 'idle' | 'generating_spec' | 'executing' | 'awaiting_approval' | 'halted' | 'error';
  terminalOutput: string[];
  currentMilestone: string | null;
  pendingDiff: string | null;
  
  appendTerminalOutput: (line: string) => void;
  setStatus: (status: AgentState['status']) => void;
  emergencyStop: () => void;
}
```

### 4.3. `useSettingsStore`

Manages app preferences and environment status.

```typescript
interface SettingsState {
  theme: 'dark' | 'light' | 'system';
  claudeStatus: 'checking' | 'found' | 'missing' | 'unauthorized';
  codeStatus: 'checking' | 'found' | 'missing' | 'unauthorized';
  claudePath: string | null;
  codePath: string | null;
  
  checkEnvironment: () => Promise<void>; 
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}
```

## 5. Backend API (Tauri Commands)

The Rust backend exposes specific functions to the React frontend via `@tauri-apps/api/core`:

* **Environment:** `run_environment_scan() -> Result<EnvStatus, String>`
* **File I/O:** `parse_document(file_path: String) -> Result<String, String>`
* **Process Management:**
  * `spawn_cli_agent(spec_payload: String, mode: String)`
  * `kill_agent_process()` (Emergency Stop)
* **Git Operations (via `git2`):**
  * `git_init_repository(path: String) -> Result<(), String>`
  * `git_get_diff() -> Result<String, String>`
  * `git_commit_milestone(message: String) -> Result<(), String>`

## 6. Core Workflows & Logic

### 6.1. Spec Generation & Human-in-the-Loop

* Frontend sends parsed PRD text to the LLM.
* Resulting markdown string is saved to `useProjectStore.specContent`.
* UI renders a HeroUI Split Pane.
* If the user highlights text and requests changes, the specific chunk + prompt is sent back to the LLM, dynamically updating `specContent`.

### 6.2. Agentic Execution & Autonomy Loop

When the user clicks "Start Build":

1. React calls `spawn_cli_agent` with the approved Spec.
2. Rust spawns the CLI process.
3. **Streaming:** Rust listens to `stdout` and emits Tauri Window Events (`emit("cli-output", line)`) to the frontend.
4. **Interception (Autonomy Engine):**
   * **Stepped:** Rust intercepts file-write/shell commands, pauses the process, and emits `awaiting_approval`.
   * **Milestone:** Rust waits for milestone completion, runs `git_get_diff()`, and sends the diff for approval.
5. Upon user "Approve" in React, `approve_action()` signals Rust to allow the CLI to proceed.

## 7. Security Considerations

* **Process Isolation:** The React frontend must never execute shell commands directly. All CLI executions are strictly defined and routed through Rust Tauri commands.
* **API Keys/Secrets:** Handled by the underlying CLI tools where possible. If SpecForge needs to store secrets, they will be securely stored in the OS keychain using a crate like `keyring`, never in plain text.
