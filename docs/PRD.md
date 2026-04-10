# Product Requirements Document: SpecForge (MVP)

## 1. Product Overview

**SpecForge** is a desktop application designed to facilitate spec-driven development. It acts as an intelligent orchestrator between the user's initial product ideas and underlying AI agents (via Claude CLI and Codex CLI). Users upload high-level requirements, collaborate with their chosen AI to refine an actionable technical spec, and then unleash the AI to agentically write, test, and implement the codebase.

## 2. Target Audience

* **Solo Developers & Indie Hackers:** Looking to 10x their output by delegating boilerplate and feature implementation to AI.
* **Technical Product Managers:** Who want to translate PRDs directly into scaffolding or initial code drafts before handing them to an engineering team.
* **Software Engineers:** Transitioning to architecture-first workflows where they review logic rather than type every line.

## 3. Core User Flow (MVP)

1. **Ingestion:** The user drops a Markdown (`.md`) or PDF file containing a high-level PRD or feature request into the application.
2. **Model Selection:** The user selects their preferred underlying AI engine (e.g., Claude 3.5 Sonnet, GPT-4o) via the integrated CLIs.
3. **Spec Generation:** The AI reads the provided documents and generates a strict, highly detailed Technical Specification (defining architecture, endpoints, components, and data models).
4. **Review & Enhance (Human-in-the-Loop):** The user is presented with a side-by-side view. They can approve the spec, edit it manually, or chat with the AI to refine it iteratively.
5. **Agentic Execution:** Once approved, the app triggers the Codex CLI/Claude CLI. The AI agentically creates files, writes code, and executes terminal commands based *only* on the approved spec, adhering to the user's selected autonomy level.
6. **Output & Handoff:** The AI completes the task, and the user can review the diffs in their preferred IDE.

## 4. Key Features & Requirements

### 4.1. File Parsing & Ingestion

* **Markdown Support:** Native reading of `.md` files, preserving structure, headers, and code blocks.
* **PDF Parsing:** Text extraction from standard PDFs to feed into the AI's context window.

### 4.2. The Interactive Spec Editor

* **Split-pane UI:** Source PRD on the left, generated Technical Spec on the right.
* **Inline Chat:** Ability to highlight a specific section of the generated spec and ask the AI to modify or enhance specific requirements.

### 4.3. CLI & Agent Integration

* **Claude CLI Wrapper:** Securely pass prompts, context, and environment variables to the Claude CLI.
* **Codex CLI Wrapper:** Bridge the generated code into the user's local file system.
* **Agentic Loop:** The application must monitor the CLI output. If the AI encounters a terminal error (e.g., a missing dependency), it should attempt to resolve it automatically up to a predefined retry limit before alerting the user.

### 4.4. Agent Autonomy & Execution Controls

To accommodate different workflows and risk tolerances, the application will feature user-selectable autonomy modes, adjustable before or during the build phase.

* **Mode 1: Stepped Approval (High Human-in-the-Loop)**
  * **Behavior:** The AI pauses execution and prompts the user for approval before executing *any* destructive or write action.
  * **Triggers:** Asks for permission before creating/modifying files or running terminal commands.
* **Mode 2: Milestone Approval (Moderate Autonomy)**
  * **Behavior:** The AI executes autonomously within the bounds of a specific logical chunk or "milestone" defined in the Technical Spec.
  * **Triggers:** Pauses at the end of a milestone, presents a summary and a Git diff, and waits for approval before moving to the next.
* **Mode 3: Full Autonomy ("God Mode")**
  * **Behavior:** The AI executes the entire approved Technical Spec from start to finish without pausing.
  * **Triggers:** Halts only if it encounters a fatal error it cannot self-resolve after its retry limit.

**UI/UX Requirements for Autonomy:**

* **Autonomy Toggle:** A clear UI element to switch modes on the execution dashboard.
* **Execution Stream:** A console pane streaming the AI's "thinking process" and CLI actions in real-time.
* **Interruption Protocol:** An "Emergency Stop" button that instantly kills CLI processes and pauses the agent.
* **Diff Viewer:** A side-by-side code diff viewer during approval gates to review intended commits.

## 5. Technical Architecture (Recommended MVP Stack)

* **Desktop Framework:** Electron or Tauri for cross-platform compatibility across macOS and Windows.
* **Frontend:** React for building a modular, responsive UI.
* **State Management:** Zustand or Redux to efficiently handle the real-time streaming state of AI chats, file parsing, and CLI outputs.
* **Backend/Local Processing:** Node.js (Electron) or Rust (Tauri) to handle secure execution of local shell commands and filesystem access.
* **Version Control:** Deep Git integration to automatically commit the generated codebase at milestones, allowing easy rollbacks.

## 6. Out of Scope for MVP

* Cloud syncing of specs or user accounts.
* Real-time multi-player collaboration.
* Visual node-based architecture diagrams.
