$payloadText = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($payloadText)) {
  exit 0
}

try {
  $payload = $payloadText | ConvertFrom-Json
} catch {
  exit 0
}

$command = [string]$payload.tool_input.command

if ($command -notmatch '^\s*git\s+commit(?:\s|$)') {
  exit 0
}

$projectDir = if ($env:CLAUDE_PROJECT_DIR) {
  $env:CLAUDE_PROJECT_DIR
} else {
  (Get-Location).Path
}

Push-Location $projectDir

try {
  & bun run build
  if ($LASTEXITCODE -ne 0) {
    [Console]::Error.WriteLine('Blocked git commit because bun run build failed. If Bun reports broken shims, run bun install --force first.')
    exit 2
  }

  & cargo check --manifest-path ".\\src-tauri\\Cargo.toml"
  if ($LASTEXITCODE -ne 0) {
    [Console]::Error.WriteLine('Blocked git commit because cargo check --manifest-path .\src-tauri\Cargo.toml failed.')
    exit 2
  }
} finally {
  Pop-Location
}

exit 0
