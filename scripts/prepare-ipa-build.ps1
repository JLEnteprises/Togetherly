$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$project = Get-Location

if (-not (Test-Path (Join-Path $project 'package.json'))) {
  throw 'Run this script from the real Togetherly SDK57 project root (the folder containing package.json).'
}

$gitignore = Join-Path $project '.gitignore'
$required = @(
  'node_modules/',
  '.expo/',
  '.env',
  '.env.*',
  '!.env.example',
  'ios/',
  'android/',
  'server/node_modules/'
)

if (-not (Test-Path $gitignore)) {
  New-Item -ItemType File -Path $gitignore | Out-Null
}

$current = Get-Content $gitignore -ErrorAction SilentlyContinue
foreach ($line in $required) {
  if ($current -notcontains $line) {
    Add-Content -Path $gitignore -Value $line
  }
}

Write-Host 'Togetherly IPA build files are ready.' -ForegroundColor Green
Write-Host 'The GitHub workflow is at .github/workflows/build-ios-unsigned.yml'
Write-Host 'Your .env files are excluded from Git.'
