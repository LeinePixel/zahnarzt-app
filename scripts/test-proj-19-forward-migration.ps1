$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repositoryRoot 'supabase\config.toml'
$migrationPath = Join-Path $repositoryRoot 'supabase\migrations\20260902203000_proj_19_forward_security_hardening.sql'
$testPath = Join-Path $repositoryRoot 'supabase\tests\proj_19_forward_migration_upgrade.sql.template'
$marker = '-- PROJ_19_FORWARD_MIGRATION'

$config = Get-Content -Raw -LiteralPath $configPath
$projectIdMatch = [regex]::Match($config, '(?m)^project_id\s*=\s*"([^"]+)"\s*$')
if (-not $projectIdMatch.Success) {
  throw 'Could not resolve the local Supabase project_id.'
}

$migration = Get-Content -Raw -LiteralPath $migrationPath
$testTemplate = Get-Content -Raw -LiteralPath $testPath
if ([regex]::Matches($testTemplate, [regex]::Escape($marker)).Count -ne 2) {
  throw 'The upgrade regression must contain exactly two migration markers.'
}

$testSql = $testTemplate.Replace($marker, $migration)
$containerName = "supabase_db_$($projectIdMatch.Groups[1].Value)"

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$output = $testSql |
  & docker exec -i $containerName psql `
    --username postgres `
    --dbname postgres `
    --no-psqlrc `
    --set ON_ERROR_STOP=1 2>&1
$psqlExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
$output | Write-Output

if ($psqlExitCode -ne 0 -or ($output -join "`n") -match '(?m)^\s*not ok\b') {
  exit 1
}
