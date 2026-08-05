<#
.SYNOPSIS
  Takes a full, compressed, verified backup of the Pima Supabase database.

.DESCRIPTION
  The free Supabase plan has no automated backups. That makes a single bad
  DELETE, a dropped table, or a closed account permanent — this script is the
  only copy that exists.

  It runs pg_dump inside the postgres Docker image rather than needing Postgres
  installed on this machine, and it pins the image to the same major version
  the server runs: pg_dump refuses to dump a server newer than itself, and a
  silent version mismatch is exactly the failure you find out about on the day
  you need the backup.

  The backup directory is mounted into the container and the archive is written
  there directly. Nothing binary crosses the PowerShell pipeline — Windows
  PowerShell applies a text encoding to redirected native output, which
  silently corrupts a gzip stream and leaves a file that looks fine until the
  day you try to restore it.

  Every run is verified before it is kept. A dump that is truncated, empty, or
  missing tables it should contain is deleted and the script exits non-zero: a
  corrupt file sitting in the backup folder is worse than no file, because it
  reads as safety.

.PARAMETER ConnectionString
  The Postgres URI. Supabase dashboard:
  Project Settings -> Database -> Connection string -> URI.
  Prefer PIMA_DB_URL in the environment over passing it here, so the password
  never lands in your shell history.

.PARAMETER OutDir
  Where to write. Defaults to backups/ in the repo — already gitignored.

.PARAMETER Keep
  How many backups to retain. Older ones are removed after a successful run.

.EXAMPLE
  $env:PIMA_DB_URL = "postgresql://postgres.xxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
  .\scripts\backup-db.ps1

.EXAMPLE
  .\scripts\backup-db.ps1 -Install     # weekly scheduled task, Fridays 02:00
#>

[CmdletBinding()]
param(
  [string]$ConnectionString = $env:PIMA_DB_URL,
  [string]$OutDir,
  [int]$Keep = 12,
  [switch]$Install
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $repoRoot 'backups' }

# Matches the Postgres major version Supabase runs (SHOW server_version).
# Bump when the project is upgraded — pg_dump refuses a newer server and says so.
$PgImage = 'postgres:17-alpine'

function Write-Step($m) { Write-Host "  $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "  OK  $m" -ForegroundColor Green }
function Write-Fail($m) { Write-Host "  !!  $m" -ForegroundColor Red }

# ── Install mode ────────────────────────────────────────────────────
if ($Install) {
  $taskName = 'Pima database backup'
  $script = Join-Path $PSScriptRoot 'backup-db.ps1'

  if (-not $ConnectionString) {
    Write-Fail 'Set PIMA_DB_URL first, or pass -ConnectionString. The task needs it to run unattended.'
    exit 1
  }

  # Stored as a user environment variable so the task inherits it without the
  # password being written into the task definition, where Task Scheduler would
  # show it in plain text.
  [Environment]::SetEnvironmentVariable('PIMA_DB_URL', $ConnectionString, 'User')

  $action  = New-ScheduledTaskAction -Execute (Get-Command powershell).Source `
             -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
  $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 2am
  # StartWhenAvailable so a machine asleep at 02:00 still runs it when it wakes.
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
              -ExecutionTimeLimit (New-TimeSpan -Hours 2)

  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
                         -Settings $settings -Force | Out-Null
  Write-Ok "Scheduled task registered: '$taskName', every Friday at 02:00."
  Write-Host ''
  Write-Host '  Run it once now to confirm it works:' -ForegroundColor Yellow
  Write-Host "    Start-ScheduledTask -TaskName '$taskName'"
  exit 0
}

# ── Preconditions ───────────────────────────────────────────────────
Write-Host ''
Write-Host 'Pima database backup' -ForegroundColor White
Write-Host ''

if (-not $ConnectionString) {
  Write-Fail 'No connection string.'
  Write-Host ''
  Write-Host '  Supabase dashboard -> Project Settings -> Database -> Connection string -> URI'
  Write-Host '  Then:'
  Write-Host '    $env:PIMA_DB_URL = "postgresql://postgres.xxx:PASSWORD@...supabase.com:5432/postgres"'
  Write-Host ''
  exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Fail 'Docker is not on PATH. It runs pg_dump, so it has to be available.'
  exit 1
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Fail 'Docker is installed but not running. Start Docker Desktop and try again.'
  exit 1
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$OutDirFull = (Resolve-Path $OutDir).Path

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$name  = "pima_$stamp.sql.gz"
$file  = Join-Path $OutDirFull $name

# ── Dump ────────────────────────────────────────────────────────────
Write-Step "Dumping to $name ..."

# --no-owner / --no-acl: the roles on a restore target are not the roles here,
#   and ownership statements make a restore fail on its first line.
# No --clean: its DROP preamble errors on every object when the target is
#   empty, which is what a real recovery restores into. 153 red lines that all
#   mean nothing is worse than none, because the one that matters hides in them.
#   restore-db.ps1 expects an empty target and says so.
# --quote-all-identifiers: survives a future Postgres reserving a word this
#   schema uses.
# Pull first, on its own. `docker run` prints its download progress to stderr,
# and Windows PowerShell turns any stderr from a native command into error
# records — so folding it into the dump call makes a perfectly good first run
# look like a failure.
$havePg = docker images -q $PgImage
if (-not $havePg) {
  Write-Step "Fetching $PgImage (first run only) ..."
  docker pull $PgImage | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "Could not pull $PgImage. Check the internet connection."
    exit 1
  }
}

$dump = 'pg_dump "$0" --no-owner --no-acl --quote-all-identifiers | gzip -9 > /backup/$1'
docker run --rm -v "${OutDirFull}:/backup" $PgImage sh -c $dump $ConnectionString $name

if ($LASTEXITCODE -ne 0) {
  Write-Fail "pg_dump failed (exit $LASTEXITCODE). The message above says why."
  Remove-Item $file -ErrorAction SilentlyContinue
  exit 1
}

# ── Verify ──────────────────────────────────────────────────────────
# A backup nobody has opened is a guess. These three checks are cheap, and they
# are the difference between "there is a file" and "there is a backup".
Write-Step 'Verifying ...'

if (-not (Test-Path $file)) {
  Write-Fail 'pg_dump reported success but wrote no file.'
  exit 1
}

$sizeMb = [math]::Round((Get-Item $file).Length / 1MB, 2)
if ((Get-Item $file).Length -lt 20KB) {
  Write-Fail "Only $sizeMb MB — too small to be this database. Keeping nothing."
  Remove-Item $file
  exit 1
}

# gzip -t reads the whole stream and fails on a truncated file, which is what a
# connection dropped mid-dump leaves behind.
docker run --rm -v "${OutDirFull}:/backup" $PgImage sh -c 'gzip -t /backup/$0' $name *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Fail 'The archive is truncated or corrupt. Keeping nothing.'
  Remove-Item $file
  exit 1
}

# And confirm the tables that matter are in there. A dump can be valid gzip,
# the right size, and still be of the wrong database.
$expected = @('bookings', 'houses', 'users', 'payments', 'platform_settings')
$listCmd = 'gzip -dc /backup/$0 | grep -oE ''CREATE TABLE [^ ]+'''
$found = (docker run --rm -v "${OutDirFull}:/backup" $PgImage sh -c $listCmd $name) | Out-String

$missing = @($expected | Where-Object { $found -notmatch [regex]::Escape(".`"$_`"") -and $found -notmatch [regex]::Escape(".$_ ") })
if ($missing.Count -gt 0) {
  Write-Fail "The dump is missing: $($missing -join ', '). Keeping nothing."
  Remove-Item $file
  exit 1
}

$tableCount = ([regex]::Matches($found, 'CREATE TABLE')).Count
Write-Ok "$sizeMb MB, archive intact, $tableCount tables including all expected ones."

# ── Rotate ──────────────────────────────────────────────────────────
$all = @(Get-ChildItem $OutDirFull -Filter 'pima_*.sql.gz' | Sort-Object LastWriteTime -Descending)
if ($all.Count -gt $Keep) {
  $old = $all | Select-Object -Skip $Keep
  $old | Remove-Item -Force
  Write-Step "Removed $($old.Count) backup(s) beyond the last $Keep."
  $all = @(Get-ChildItem $OutDirFull -Filter 'pima_*.sql.gz')
}

Write-Host ''
Write-Ok "Backup complete: $file"
Write-Host "  $($all.Count) backup(s) on disk in $OutDirFull" -ForegroundColor DarkGray
Write-Host ''
Write-Host '  To restore into a database (replace TARGET_URL with the destination):' -ForegroundColor Yellow
# Built from a literal template rather than an interpolated string: the command
# contains both quote characters, and escaping them inline is how the previous
# two attempts at this line failed to parse.
$restore = @'
    docker run --rm -v "__DIR__:/backup" __IMAGE__ sh -c 'gzip -dc /backup/__FILE__ | psql "$0"' TARGET_URL
'@
$restore = $restore.Replace('__DIR__', $OutDirFull).Replace('__IMAGE__', $PgImage).Replace('__FILE__', $name)
Write-Host $restore
Write-Host ''
