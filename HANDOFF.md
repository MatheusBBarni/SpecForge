# Handoff

## Current Task
- Branch: `refactor/cursor-sdk`.
- Refactor PRD/spec generation from Codex/Claude ACP-backed Rust commands to Cursor SDK-backed generation.
- Current slice focuses on PRD/spec generation and settings, not chat migration.

## Key Decisions
- `@cursor/sdk` cannot be bundled into the Vite webview because it imports Node/Bun runtime modules and native dependencies.
- React composes Cursor PRD/spec prompts and drives the existing generation flow.
- `src/cursorAgentRunner.ts` is the Bun-only SDK entry point; do not import it from webview code.
- Rust delegates Cursor generation to the Bun runner, stores the Cursor API key via OS credential storage, and saves generated Markdown.
- Cursor API keys are never written to `.specforge/settings.json` or localStorage.
- Chat execution still has the legacy Codex/Claude CLI path and is outside this slice.

## Open Questions
- Packaged app strategy for the Bun runner and `@cursor/sdk` dependency still needs a deliberate follow-up.
- Chat/execution migration to Cursor SDK remains pending.

## Files Modified
- Added Cursor SDK runtime files: `src/cursorAgentRunner.ts`, `src/lib/cursorAgentRuntime.ts`, `src-tauri/src/cursor_agent.rs`, `src-tauri/src/secrets.rs`.
- Updated settings/project state, config screens, PRD/spec handlers, runtime bridge, Rust models/project normalization, docs, and dependency manifests.

## Verification
- `bun test`: passed, 77 tests.
- `bunx tsc --noEmit`: passed.
- `bun run lint`: passed with existing warnings.
- `bun run build`: passed.
- `cargo fmt --manifest-path .\src-tauri\Cargo.toml`: ran.
- `cargo check --manifest-path .\src-tauri\Cargo.toml`: passed.

## Next Steps
- Decide how the Bun Cursor runner should be bundled for packaged desktop builds.
- Migrate chat/execution off legacy Codex/Claude CLI runtime when ready.
- Address existing Biome warnings separately if a clean lint output is desired.
