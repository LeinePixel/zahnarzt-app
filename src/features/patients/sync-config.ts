import 'server-only'

import { loadMockPvsConfig, type MockPvsConfig } from '@/features/integrations/mock-pvs-config'

export type PatientSyncConfig = { databaseUrl: string; mockPvs: MockPvsConfig }

export class PatientSyncConfigError extends Error {
  override name = 'PatientSyncConfigError'
}

const forbiddenRuntimeVariables = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'PATIENT_SYNC_ADMIN_DATABASE_URL',
  'MOCK_PVS_TEST_TOKEN',
]

function isForbiddenEnvironment(environment: Record<string, string | undefined>): boolean {
  return Object.entries(environment).some(([name, value]) => {
    if (!value) return false
    return forbiddenRuntimeVariables.includes(name) || /^SEED_.*PASSWORD$/i.test(name)
  })
}

function validateDatabaseUrl(value: string | undefined): string {
  if (!value || value !== value.trim()) throw new Error()
  const url = new URL(value)
  const decodedPassword = decodeURIComponent(url.password)
  const databaseSegments = url.pathname.split('/').filter(Boolean)

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || !url.port
    || databaseSegments.length !== 1
    || !decodeURIComponent(databaseSegments[0])
    || !/^dentpilot_sync_[a-z0-9_]+$/.test(decodeURIComponent(url.username))
    || !decodedPassword
    || /[\u0000-\u001f\u007f]/.test(decodedPassword)
    || Boolean(url.search)
    || Boolean(url.hash)
  ) throw new Error()

  return value
}

export function loadPatientSyncConfig(
  environment: Record<string, string | undefined> = process.env,
): PatientSyncConfig {
  try {
    if (environment.PATIENT_SYNC_SYNTHETIC_ONLY !== '1' || isForbiddenEnvironment(environment)) {
      throw new Error()
    }
    return {
      databaseUrl: validateDatabaseUrl(environment.PATIENT_SYNC_DATABASE_URL),
      mockPvs: loadMockPvsConfig(environment),
    }
  } catch {
    throw new PatientSyncConfigError('Patientensync-Konfiguration ist ungültig.')
  }
}
