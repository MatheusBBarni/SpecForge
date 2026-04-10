$projectDir = if ($env:CLAUDE_PROJECT_DIR) {
  $env:CLAUDE_PROJECT_DIR
} else {
  (Get-Location).Path
}

$manifestPath = Join-Path $projectDir "src-tauri\\Cargo.toml"

if (-not (Test-Path $manifestPath)) {
  exit 0
}

Push-Location $projectDir

try {
  & cargo fmt --manifest-path ".\\src-tauri\\Cargo.toml" | Out-Null
} finally {
  Pop-Location
}

exit 0
