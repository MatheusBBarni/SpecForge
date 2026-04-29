pub(crate) const SAMPLE_DIFF: &str = r#"diff --git a/src/App.tsx b/src/App.tsx
index 0000000..forge42 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@
- Render placeholder starter card
+ Introduce PRD/spec review workspace with execution controls
+ Add Dracula-first theme tokens and persisted preferences
+ Surface CLI health, diff approvals, and terminal streaming"#;

pub(crate) const SPECFORGE_SETTINGS_RELATIVE_PATH: &str = ".specforge/settings.json";
pub(crate) const DEFAULT_PROJECT_PRD_PATH: &str = "docs/PRD.md";
pub(crate) const DEFAULT_PROJECT_SPEC_PATH: &str = "docs/SPEC.md";
pub(crate) const DEFAULT_PRD_AGENT_DESCRIPTION: &str = r#"Act as an Expert Senior Product Manager. Your goal is to help me write a comprehensive, well-structured Product Requirements Document (PRD) for a new product, feature, or app.

Use the operator context as the source material. Draft a complete PRD in Markdown unless the context is too ambiguous to proceed.

Cover:
- Problem statement
- Target audience and personas
- Goals and non-goals
- Core user flows
- Functional requirements
- Success metrics
- Constraints, risks, and open questions

Return only the PRD Markdown."#;
pub(crate) const DEFAULT_SPEC_AGENT_DESCRIPTION: &str = r#"Act as an Expert Software Architect and Tech Lead. I have attached the Product Requirements Document (PRD) for the project.

Analyze the PRD and draft a comprehensive Technical Specification Document in Markdown.

Please structure the spec with the following sections:

1. High-Level Architecture: A conceptual overview of how the system components will interact.
2. Tech Stack & Tooling: Define the frontend, backend, and infrastructure.
3. Data Models & Database Schema: Define the core entities, their attributes, and relationships.
4. API Contracts: Outline the primary endpoints (methods, routes, request/response structures) needed to support the user flows.
5. Component & State Management: How data will flow through the application and how the UI will be structured.
6. Security & Edge Cases: Potential vulnerabilities, error handling, and performance bottlenecks.
7. Engineering Milestones: Break the implementation down into logical, phased deliverables.

Return only the spec Markdown."#;
pub(crate) const DEFAULT_EXECUTION_AGENT_DESCRIPTION: &str = r#"Act as a Senior Software Engineer executing from an approved technical specification.

Use the approved spec as the source of truth. Preserve the current repository style, keep changes scoped, and verify behavior with the project's existing commands before reporting completion."#;
