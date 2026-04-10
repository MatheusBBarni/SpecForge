# Docs Scope

## Always
- MUST keep `docs/PRD.md` and `docs/SPEC.md` truthful to the code that ships today.
- MUST call out aspirational or not-yet-implemented behavior explicitly instead of presenting it as complete.
- MUST update the docs when model names, approval modes, import flow, or runtime ownership change.

## Never
- NEVER use `docs/ui-base.png` as the only source of truth for behavior.

## Landmines
- The app bundles `docs/PRD.md` and `docs/SPEC.md` into the default review panes, so stale docs become stale UI immediately.
- `docs/SPEC.md` currently documents dependencies and backend features that are not all implemented in the repo.
