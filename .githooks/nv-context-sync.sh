#!/usr/bin/env sh

set +e

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

warn() {
  printf '%s\n' "$*" >&2
}

stat_mtime() {
  if stat -c %Y "$1" >/dev/null 2>&1; then
    stat -c %Y "$1"
    return
  fi

  if stat -f %m "$1" >/dev/null 2>&1; then
    stat -f %m "$1"
    return
  fi

  echo 0
}

changed_files="$(git diff --name-only --cached; git diff --name-only)"

if printf '%s\n' "$changed_files" | grep -Eq '^(package\.json|bun\.lock|vite\.config\.ts|tsconfig\.json|src-tauri/Cargo\.toml|src-tauri/tauri\.conf\.json|docs/PRD\.md|docs/SPEC\.md|\.github/workflows/|eslint|prettier|biome|ruff|black|\.pre-commit-config\.yaml)'; then
  warn "nv-context: package, runtime, workflow, or doc files changed. Review AGENTS.md/CLAUDE.md if the agent guidance is now stale."
fi

now="$(date +%s)"

for path in AGENTS.md CLAUDE.md HANDOFF.md hooks-config.json src/AGENTS.md src-tauri/AGENTS.md docs/AGENTS.md; do
  if [ ! -f "$path" ]; then
    continue
  fi

  mtime="$(stat_mtime "$path")"
  if [ "$mtime" -gt 0 ]; then
    age_days="$(( (now - mtime) / 86400 ))"
    if [ "$age_days" -ge 14 ]; then
      warn "nv-context: $path is $age_days days old. Re-run /nv-context or review it manually."
    fi
  fi
done

soft_negative_hits="$(grep -nE "(don't|do not|avoid)" AGENTS.md CLAUDE.md src/AGENTS.md src-tauri/AGENTS.md docs/AGENTS.md 2>/dev/null)"
if [ -n "$soft_negative_hits" ]; then
  warn "nv-context: soft negative instructions found in agent config files. Rewrite them as positive MUST rules."
fi

exit 0
