param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$remote = (git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remote)) {
  throw "Git remote 'origin' is not configured."
}

$blockedPatterns = @(
  ".env",
  ".env.local",
  ".env.production",
  "public/uploads/payments",
  "public/uploads/evidence",
  "public/uploads/learning-submissions",
  "public/uploads/instructor-signatures",
  "public/uploads/certificates/signatures",
  "storage/uploads"
)

git add -A

foreach ($pattern in $blockedPatterns) {
  git rm -r --cached --ignore-unmatch -- $pattern | Out-Null
}

$staged = git diff --cached --name-only
if ([string]::IsNullOrWhiteSpace($staged)) {
  Write-Host "No changes to back up."
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $Message = "Backup project snapshot $stamp"
}

git commit -m $Message
git push origin main
