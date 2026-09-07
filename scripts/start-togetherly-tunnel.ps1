param(
  [string]$LocalApi = "http://localhost:4000",
  [switch]$StartBackend
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "cloudflared was not found. Install it with: winget install --id Cloudflare.cloudflared"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git was not found in PATH."
}

if ($StartBackend) {
  Write-Host "Starting Togetherly backend in a separate window..."
  Start-Process cmd.exe -ArgumentList '/k', "cd /d `"$RepoRoot`" && npm run backend:dev"
  Start-Sleep -Seconds 2
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $env:TEMP "togetherly-cloudflared-$stamp.out.log"
$stderr = Join-Path $env:TEMP "togetherly-cloudflared-$stamp.err.log"

Write-Host "Starting Cloudflare Quick Tunnel -> $LocalApi"
$proc = Start-Process cloudflared -ArgumentList @('tunnel','--url',$LocalApi,'--no-autoupdate') -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr

$deadline = (Get-Date).AddSeconds(60)
$url = $null
while ((Get-Date) -lt $deadline -and -not $proc.HasExited -and -not $url) {
  Start-Sleep -Milliseconds 500
  $text = ''
  if (Test-Path $stdout) { $text += (Get-Content $stdout -Raw -ErrorAction SilentlyContinue) }
  if (Test-Path $stderr) { $text += "`n" + (Get-Content $stderr -Raw -ErrorAction SilentlyContinue) }
  $match = [regex]::Match($text, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
  if ($match.Success) { $url = $match.Value }
}

if (-not $url) {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Write-Host "---- cloudflared output ----"
  if (Test-Path $stderr) { Get-Content $stderr }
  throw "Could not discover the trycloudflare.com URL within 60 seconds."
}

$config = [ordered]@{
  apiUrl = $url
  updatedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$config | ConvertTo-Json | Set-Content -Path (Join-Path $RepoRoot 'runtime-config.json') -Encoding utf8

Write-Host "Discovered API URL: $url"
Write-Host "Publishing runtime-config.json to GitHub..."

git add runtime-config.json
$changes = git diff --cached --name-only
if ($changes) {
  git commit -m "Update Togetherly runtime API URL"
  if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
  git push origin main
  if ($LASTEXITCODE -ne 0) { throw "git push failed. The tunnel is still running, but GitHub was not updated." }
} else {
  Write-Host "runtime-config.json already points at this URL; no Git commit required."
}

Write-Host ""
Write-Host "Togetherly runtime API is now: $url" -ForegroundColor Green
Write-Host "Phones will discover it from GitHub on launch."
Write-Host "Keep this PowerShell window open. Ctrl+C stops the tunnel."
Write-Host ""

try {
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 2
  }
} finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}
