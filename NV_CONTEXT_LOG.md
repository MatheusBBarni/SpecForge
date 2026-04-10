# NV Context Log

## 2026-04-10
- Auto-detected a solo git history with one unique author.
- Existing shared agent config files were absent before this setup pass.
- Existing CI, automated tests, and committed lint/format config were absent before this setup pass.
- Auto decision: use an AGENTS-centered hierarchy for Codex, plus a minimal `CLAUDE.md` shim for Claude Code compatibility.
- Auto decision: add on-demand architecture/testing docs instead of bloating the root guidance files.
- Validation note: `cargo check --manifest-path .\src-tauri\Cargo.toml` succeeds in this environment.
- Validation note: `bun run build` currently fails because Bun reports corrupted `node_modules` bin shims and asks for `bun install --force`.
