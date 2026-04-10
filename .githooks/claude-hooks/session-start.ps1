$projectDir = if ($env:CLAUDE_PROJECT_DIR) {
  $env:CLAUDE_PROJECT_DIR
} else {
  (Get-Location).Path
}

$threshold = (Get-Date).AddDays(-14)
$targets = @("AGENTS.md", "CLAUDE.md", "HANDOFF.md", "hooks-config.json")
$stale = @()

foreach ($target in $targets) {
  $path = Join-Path $projectDir $target
  if (-not (Test-Path $path)) {
    continue
  }

  $item = Get-Item $path
  if ($item.LastWriteTime -lt $threshold) {
    $stale += "$target ($($item.LastWriteTime.ToString('yyyy-MM-dd')))"
  }
}

if ($stale.Count -gt 0) {
  Write-Output "Agent config check: the following files are older than 14 days: $($stale -join ', '). Review them or rerun /nv-context before a large change."
}

exit 0
