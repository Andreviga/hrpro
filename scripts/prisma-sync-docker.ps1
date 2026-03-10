[CmdletBinding()]
param(
	[string]$ContainerName = "hrprofolhadepagamento-db-1",
	[string]$Database = "hrpro",
	[string]$DbUser = "postgres",
	[string]$MigrationsPath,
	[switch]$SkipApply
)

$ErrorActionPreference = "Stop"

if (-not $MigrationsPath) {
	$MigrationsPath = Join-Path $PSScriptRoot "..\server\prisma\migrations"
}

$resolvedMigrationsPath = (Resolve-Path $MigrationsPath).Path

if (-not (Test-Path $resolvedMigrationsPath)) {
	throw "Migrations path not found: $resolvedMigrationsPath"
}

function Invoke-Psql {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Sql,
		[switch]$Silent
	)

	$result = $Sql | docker exec -i $ContainerName psql -v ON_ERROR_STOP=1 -U $DbUser -d $Database -t -A
	if ($LASTEXITCODE -ne 0) {
		throw "psql command failed against container '$ContainerName'."
	}

	$outputText = ($result | Out-String)
	$lines = @($outputText -split "`r?`n" | Where-Object { $_ -and $_.Trim() -ne "" })
	if (-not $Silent -and $lines.Count -gt 0) {
		$lines | ForEach-Object { Write-Host $_ }
	}

	return $lines
}

Write-Host "Checking container '$ContainerName'..."
$isRunning = docker inspect -f "{{.State.Running}}" $ContainerName 2>$null
if ($LASTEXITCODE -ne 0 -or $isRunning.Trim().ToLowerInvariant() -ne "true") {
	throw "Container '$ContainerName' is not running or was not found."
}

Write-Host "Checking _prisma_migrations table..."
$migrationsTable = Invoke-Psql -Sql "SELECT to_regclass('_prisma_migrations');" -Silent
if ($migrationsTable.Count -eq 0 -or (($migrationsTable -join "`n") -notmatch "_prisma_migrations")) {
	throw "Table _prisma_migrations not found in database '$Database'."
}

$filesystemMigrations = Get-ChildItem $resolvedMigrationsPath -Directory | Sort-Object Name
$filesystemMigrationNames = @($filesystemMigrations | Select-Object -ExpandProperty Name)

$databaseMigrationNames = @(Invoke-Psql -Sql "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name;" -Silent)
$pendingMigrations = @($filesystemMigrationNames | Where-Object { $_ -notin $databaseMigrationNames })

Write-Host "Migrations in filesystem: $($filesystemMigrationNames.Count)"
Write-Host "Migrations in database: $($databaseMigrationNames.Count)"
Write-Host "Pending migrations: $($pendingMigrations.Count)"

foreach ($migrationName in $pendingMigrations) {
	$migrationSqlPath = Join-Path (Join-Path $resolvedMigrationsPath $migrationName) "migration.sql"
	if (-not (Test-Path $migrationSqlPath)) {
		throw "migration.sql not found for migration '$migrationName' at path '$migrationSqlPath'."
	}

	if (-not $SkipApply) {
		Write-Host "Applying migration: $migrationName"
		$migrationSql = Get-Content $migrationSqlPath -Raw
		try {
			Invoke-Psql -Sql $migrationSql -Silent | Out-Null
		}
		catch {
			throw "Failed while applying migration '$migrationName'. If SQL was already applied manually, rerun with -SkipApply. Details: $($_.Exception.Message)"
		}
	}
	else {
		Write-Host "SkipApply enabled. Registering only: $migrationName"
	}

	$checksum = (Get-FileHash -Path $migrationSqlPath -Algorithm SHA256).Hash.ToLowerInvariant()
	$id = [guid]::NewGuid().ToString()
	$registerSql = @"
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT '$id', '$checksum', NOW(), '$migrationName', '', NULL, NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '$migrationName');
"@

	Invoke-Psql -Sql $registerSql -Silent | Out-Null
	Write-Host "Registered migration: $migrationName"
}

$finalDbMigrationNames = @(Invoke-Psql -Sql "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name;" -Silent)
$missingInDb = @($filesystemMigrationNames | Where-Object { $_ -notin $finalDbMigrationNames })
$orphanInDb = @($finalDbMigrationNames | Where-Object { $_ -notin $filesystemMigrationNames })

Write-Host ""
Write-Host "Final summary"
Write-Host "Migrations in filesystem: $($filesystemMigrationNames.Count)"
Write-Host "Migrations in database: $($finalDbMigrationNames.Count)"
Write-Host "Missing in database: $($missingInDb.Count)"
Write-Host "Orphan in database: $($orphanInDb.Count)"

if ($missingInDb.Count -eq 0) {
	Write-Host "Prisma migration history is synchronized."
}
else {
	Write-Host "There are still pending migrations in the database history."
	$missingInDb | ForEach-Object { Write-Host " - $_" }
	exit 2
}
