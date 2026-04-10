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

if ($command -match '^\s*git\s+push(?:\s+\S+)?\s+(main|master)(?:\s|$)') {
  [Console]::Error.WriteLine("Direct pushes to main/master are blocked. Push a branch and open a pull request instead.")
  exit 2
}

exit 0
