$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repositoryRoot 'supabase\config.toml'
$migrations = @(
  [PSCustomObject]@{
    Marker = '-- PROJ_19_COMPATIBILITY_BRIDGE'
    Path = Join-Path $repositoryRoot 'supabase\migrations\20260828090000_proj_19_compatibility_bridge.sql'
  },
  [PSCustomObject]@{
    Marker = '-- PROJ_19_PORTAL_ADMIN_IDENTITY_CONTEXT'
    Path = Join-Path $repositoryRoot 'supabase\migrations\20260829090000_proj_19_portal_admin_identity_context.sql'
  },
  [PSCustomObject]@{
    Marker = '-- PROJ_19_OPAQUE_ACTIVATION_RESULT'
    Path = Join-Path $repositoryRoot 'supabase\migrations\20260829110000_proj_19_opaque_activation_result.sql'
  },
  [PSCustomObject]@{
    Marker = '-- PROJ_19_FORWARD_MIGRATION'
    Path = Join-Path $repositoryRoot 'supabase\migrations\20260902203000_proj_19_forward_security_hardening.sql'
  }
)
$testPaths = @(
  (Join-Path $repositoryRoot 'supabase\tests\proj_19_forward_migration_upgrade.sql.template'),
  (Join-Path $repositoryRoot 'supabase\tests\proj_19_original_schema_upgrade.sql.template')
)
$config = Get-Content -Raw -LiteralPath $configPath
$projectIdMatch = [regex]::Match($config, '(?m)^project_id\s*=\s*"([^"]+)"\s*$')
if (-not $projectIdMatch.Success) {
  throw 'Could not resolve the local Supabase project_id.'
}

$containerName = "supabase_db_$($projectIdMatch.Groups[1].Value)"

foreach ($testPath in $testPaths) {
  $testTemplate = Get-Content -Raw -LiteralPath $testPath
  $testSql = $testTemplate

  foreach ($migration in $migrations) {
    $markerCount = [regex]::Matches(
      $testTemplate,
      [regex]::Escape($migration.Marker)
    ).Count

    if ($markerCount -eq 0) {
      continue
    }

    if ($migration.Marker -eq '-- PROJ_19_FORWARD_MIGRATION' -and $markerCount -ne 2) {
      throw "The upgrade regression $testPath must contain exactly two forward-migration markers."
    }

    if ($migration.Marker -eq '-- PROJ_19_COMPATIBILITY_BRIDGE' -and $markerCount -ne 2) {
      throw "The ordered upgrade regression $testPath must contain exactly two $($migration.Marker) markers."
    }

    if (
      $migration.Marker -ne '-- PROJ_19_FORWARD_MIGRATION' `
      -and $migration.Marker -ne '-- PROJ_19_COMPATIBILITY_BRIDGE' `
      -and $markerCount -ne 1
    ) {
      throw "The ordered upgrade regression $testPath must contain exactly one $($migration.Marker) marker."
    }

    $migrationSql = Get-Content -Raw -LiteralPath $migration.Path
    $testSql = $testSql.Replace($migration.Marker, $migrationSql)
  }

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
}
