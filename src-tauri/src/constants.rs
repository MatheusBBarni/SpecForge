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
pub(crate) const DEFAULT_PRD_PROMPT: &str = r#"Act as an Expert Senior Product Manager. Your goal is to help me write a comprehensive, well-structured Product Requirements Document (PRD) for a new [product / feature / app] called [Project Name].

I have some initial ideas, but I want to make sure the PRD is thorough. Before you draft the full document, please ask me a series of clarifying questions to gather the necessary context.

Please ask about:
- The core problem we are solving
- The target audience/user personas
- Key features and user flows
- Success metrics (KPIs)
- Technical or timeline constraints

Ask me these questions one or two at a time so I do not get overwhelmed. Once you have enough context, we will move on to drafting the actual PRD."#;
pub(crate) const DEFAULT_SPEC_PROMPT: &str = r#"Act as an Expert Software Architect and Tech Lead. I have attached the Product Requirements Document (PRD) for our upcoming project.

Your task is to analyze this PRD and draft a comprehensive Technical Specification Document.

Please structure the spec with the following sections:

1. High-Level Architecture: A conceptual overview of how the system components will interact.
2. Tech Stack & Tooling: Define the frontend, backend, and infrastructure.
3. Data Models & Database Schema: Define the core entities, their attributes, and relationships.
4. API Contracts: Outline the primary endpoints (methods, routes, request/response structures) needed to support the user flows.
5. Component & State Management: How data will flow through the application and how the UI will be structured.
6. Security & Edge Cases: Potential vulnerabilities, error handling, and performance bottlenecks.
7. Engineering Milestones: Break the implementation down into logical, phased deliverables.

Before writing the full document, please provide a brief bulleted summary of your proposed technical approach, and ask me up to 3 clarifying questions about any technical constraints or non-functional requirements that might be missing from the PRD."#;
