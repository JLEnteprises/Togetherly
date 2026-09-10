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
$runtimeConfigJson = $config | ConvertTo-Json
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Discovered API URL: $url"
Write-Host "Publishing only runtime-config.json to GitHub main..."

# Never commit from the user's current checkout. Build a temporary clean worktree
# from GitHub's latest main so local branches, staged files and unfinished work
# cannot accidentally become part of the runtime URL commit.
git fetch origin main
if ($LASTEXITCODE -ne 0) {
  throw "git fetch origin main failed. The tunnel is still running, but GitHub was not updated."
}

$publishWorktree = Join-Path $env:TEMP "togetherly-runtime-publish-$stamp"
$worktreeAdded = $false
$pushed = $false

try {
  if (Test-Path $publishWorktree) {
    Remove-Item -Recurse -Force $publishWorktree
  }

  git worktree add --detach $publishWorktree origin/main
  if ($LASTEXITCODE -ne 0) { throw "Could not create a clean temporary worktree from origin/main." }
  $worktreeAdded = $true

  $publishConfigPath = Join-Path $publishWorktree 'runtime-config.json'
  [System.IO.File]::WriteAllText($publishConfigPath, $runtimeConfigJson + [Environment]::NewLine, $utf8NoBom)

  Push-Location $publishWorktree
  try {
    git add -- runtime-config.json
    if ($LASTEXITCODE -ne 0) { throw "Could not stage runtime-config.json in the temporary worktree." }

    $stagedFiles = @(git diff --cached --name-only)
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect the temporary commit." }

    if ($stagedFiles.Count -eq 0) {
      Write-Host "runtime-config.json already matches GitHub; no commit required."
      $pushed = $true
    } elseif ($stagedFiles.Count -ne 1 -or $stagedFiles[0] -ne 'runtime-config.json') {
      throw "Safety check failed: the temporary commit contains something other than runtime-config.json. Nothing was pushed."
    } else {
      git commit -m "Update Togetherly runtime API URL"
      if ($LASTEXITCODE -ne 0) { throw "git commit failed in the isolated worktree." }

      # Fast-forward only. If GitHub main moved after our fetch, this fails safely
      # instead of overwriting or bundling unrelated work.
      git push origin HEAD:main
      if ($LASTEXITCODE -ne 0) {
        throw "git push failed. GitHub main may have changed; nothing was force-pushed. Run the launcher again to retry."
      }
      $pushed = $true
    }
  } finally {
    Pop-Location
  }
} finally {
  if ($worktreeAdded) {
    git worktree remove --force $publishWorktree 2>$null
  }
  if (Test-Path $publishWorktree) {
    Remove-Item -Recurse -Force $publishWorktree -ErrorAction SilentlyContinue
  }
}

if (-not $pushed) {
  throw "GitHub was not updated."
}

Write-Host ""
Write-Host "Togetherly runtime API is now: $url" -ForegroundColor Green
Write-Host "Only runtime-config.json was published to GitHub main."
Write-Host "Your current branch, staged files and local code were not committed or pushed."
Write-Host "Phones will discover the URL from GitHub on launch."
Write-Host "Keep this PowerShell window open. Ctrl+C stops the tunnel."
Write-Host ""

try {
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 2
  }
} finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}
