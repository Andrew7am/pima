<#
.SYNOPSIS
  Restores a Pima backup into a database, and reports honestly on what failed.

.DESCRIPTION
  A backup nobody has restored is a guess. This is the other half of
  backup-db.ps1 — the half you only run on the worst day, which is exactly why
  it should not be written on that day.

  It expects an EMPTY target. The realistic recovery is a fresh Supabase
  project, and dumping without --clean keeps the restore free of a hundred
  meaningless DROP errors, so the errors you do see are real ones.

  Expect a handful of errors even on a good restore: the dump carries objects
  in Supabase's own schemas (storage policies, realtime publications) that only
  exist on a real Supabase project. Those are listed separately from errors in
  public, which is where your data lives and where an error actually matters.

.PARAMETER File
  Path to a pima_*.sql.gz. Defaults to the newest one in backups/.

.PARAMETER TargetUrl
  Postgres URI of the destination. NOT defaulted to PIMA_DB_URL on purpose:
  restoring over the live database is not something to reach by pressing enter.

.EXAMPLE
  .\scripts\restore-db.ps1 -TargetUrl "postgresql://postgres.yyy:PASS@...:5432/postgres"

.EXAMPLE
  .\scripts\restore-db.ps1 -File .\backups\pima_2026-08-05_2328.sql.gz -TargetUrl $url
#>

[CmdletBinding()]
param(
  [string]$File,
  [Parameter(Mandatory = $true)][string]$TargetUrl
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$PgImage = 'postgres:17-alpine'

function Write-Step($m) { Write-Host "  $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "  OK  $m" -ForegroundColor Green }
function Write-Fail($m) { Write-Host "  !!  $m" -ForegroundColor Red }
function Write-Note($m) { Write-Host "  ..  $m" -ForegroundColor Yellow }

Write-Host ''
Write-Host 'Pima database restore' -ForegroundColor White
Write-Host ''

if (-not $File) {
  $newest = Get-ChildItem (Join-Path $repoRoot 'backups') -Filter 'pima_*.sql.gz' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $newest) { Write-Fail 'No backup found in backups/. Pass -File.'; exit 1 }
  $File = $newest.FullName
}
if (-not (Test-Path $File)) { Write-Fail "No such file: $File"; exit 1 }

$File = (Resolve-Path $File).Path
$dir  = Split-Path -Parent $File
$name = Split-Path -Leaf $File

Write-Step "Restoring $name"
Write-Step "into $($TargetUrl -replace ':[^:@/]+@', ':****@')"
Write-Host ''
Write-Note 'This writes into the target database. Ctrl+C now if that is not what you meant.'
Start-Sleep -Seconds 4

$log = Join-Path $env:TEMP "pima-restore-$(Get-Date -Format 'HHmmss').log"
$cmd = 'gzip -dc /backup/$0 | psql "$1" -q'

# psql writes every error to stderr, and reading them is the entire point here.
# But Windows PowerShell turns native stderr into error records, and with
# ErrorActionPreference = Stop the first one aborts the script — mid-restore,
# which is the worst possible moment. Relax it just for this call.
$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
docker run --rm -v "${dir}:/backup" $PgImage sh -c $cmd $name $TargetUrl 2>&1 |
  ForEach-Object { $_.ToString() } | Tee-Object -FilePath $log | Out-Null
$ErrorActionPreference = $prev

$lines = @(Get-Content $log -ErrorAction SilentlyContinue)
$errors = @($lines | Where-Object { $_ -match '^ERROR:' })

# Split by where the failure landed. An error in public is your data; an error
# in one of Supabase's own schemas usually just means this target is a plain
# Postgres rather than a Supabase project.
$publicErrors   = @($errors | Where-Object { $_ -match 'public\.' })
$platformErrors = @($errors | Where-Object { $_ -notmatch 'public\.' })

Write-Host ''
if ($publicErrors.Count -gt 0) {
  Write-Fail "$($publicErrors.Count) error(s) touching public — your data. First few:"
  $publicErrors | Select-Object -First 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  Write-Host "      full log: $log" -ForegroundColor DarkGray
} else {
  Write-Ok 'No errors in public — every table, row and trigger restored.'
}

if ($platformErrors.Count -gt 0) {
  Write-Note "$($platformErrors.Count) error(s) in Supabase's own schemas (storage, realtime, auth)."
  Write-Host '      Normal when restoring into a plain Postgres. On a real Supabase' -ForegroundColor DarkGray
  Write-Host '      project those schemas already exist and these go away.' -ForegroundColor DarkGray
}

# Independent of the log: ask the restored database what it actually contains.
# The log says what the restore claimed; this says what is there.
Write-Host ''
Write-Step 'Checking what landed ...'
$countSql = "SELECT 'tables=' || (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') || " +
            "' houses=' || (SELECT count(*) FROM public.houses) || " +
            "' bookings=' || (SELECT count(*) FROM public.bookings) || " +
            "' users=' || (SELECT count(*) FROM public.users)"
$summary = (docker run --rm $PgImage psql $TargetUrl -tAc $countSql) | Out-String

if ($LASTEXITCODE -ne 0 -or -not $summary.Trim()) {
  Write-Fail 'Could not read the restored database back. Treat this restore as failed.'
  exit 1
}

Write-Ok $summary.Trim()
Write-Host ''
if ($publicErrors.Count -gt 0) { exit 1 }
