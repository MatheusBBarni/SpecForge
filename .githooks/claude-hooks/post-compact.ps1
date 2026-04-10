$payloadText = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($payloadText)) {
  exit 0
}

try {
  $payload = $payloadText | ConvertFrom-Json
} catch {
  exit 0
}

$summary = [string]$payload.compact_summary

if ([string]::IsNullOrWhiteSpace($summary)) {
  exit 0
}

$projectDir = if ($env:CLAUDE_PROJECT_DIR) {
  $env:CLAUDE_PROJECT_DIR
} else {
  (Get-Location).Path
}

$logPath = Join-Path $projectDir "NV_CONTEXT_LOG.md"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"

if (-not (Test-Path $logPath)) {
  Set-Content -Path $logPath -Value "# NV Context Log"
}

$entry = @(
  "",
  "### PostCompact $timestamp",
  '- Re-read AGENTS.md and HANDOFF.md before the next large change.',
  "",
  "```text",
  $summary.Trim(),
  "```"
) -join "`n"

Add-Content -Path $logPath -Value $entry

exit 0
