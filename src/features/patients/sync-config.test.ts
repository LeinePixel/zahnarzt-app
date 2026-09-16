// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { loadPatientSyncConfig, PatientSyncConfigError } from './sync-config'

const validEnvironment = {
  PATIENT_SYNC_SYNTHETIC_ONLY: '1',
  PATIENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_sync_fixture:secret@127.0.0.1:54322/postgres',
  MOCK_PVS_BASE_URL: 'http://127.0.0.1:3181',
  MOCK_PVS_READ_TOKEN: 'synthetic-read-token',
}

const expectInvalid = (environment: Record<string, string | undefined>) => {
  expect(() => loadPatientSyncConfig(environment)).toThrow(
    new PatientSyncConfigError('Patientensync-Konfiguration ist ungültig.'),
  )
}

describe('patient sync runtime configuration', () => {
  it('accepts only an explicit local synthetic runtime configuration', () => {
    const config = loadPatientSyncConfig(validEnvironment)
    expect(config.databaseUrl).toBe(validEnvironment.PATIENT_SYNC_DATABASE_URL)
    expect(config.mockPvs).toEqual({
      baseUrl: new URL(validEnvironment.MOCK_PVS_BASE_URL),
      readToken: validEnvironment.MOCK_PVS_READ_TOKEN,
    })
  })

  it.each([
    { PATIENT_SYNC_SYNTHETIC_ONLY: undefined },
    { PATIENT_SYNC_SYNTHETIC_ONLY: '0' },
    { PATIENT_SYNC_DATABASE_URL: '' },
    { PATIENT_SYNC_DATABASE_URL: 'https://dentpilot_sync_fixture:secret@127.0.0.1:54322/postgres' },
    { PATIENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_sync_fixture:secret@example.invalid:54322/postgres' },
    { PATIENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_sync_fixture:secret@localhost/postgres' },
    { PATIENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_sync_fixture:secret@localhost:54322/' },
    { PATIENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_sync_fixture:@localhost:54322/postgres' },
    { PATIENT_SYNC_DATABASE_URL: 'postgresql://postgres:secret@localhost:54322/postgres' },
    { PATIENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_sync_fixture:secret@localhost:54322/postgres?sslmode=disable' },
    { PATIENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_sync_fixture:secret@localhost:54322/postgres#fragment' },
    { MOCK_PVS_READ_TOKEN: '' },
  ])('rejects incomplete or non-local configuration: %o', override => {
    expectInvalid({ ...validEnvironment, ...override })
  })

  it.each([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SEED_PRAXISADMIN_PASSWORD',
    'PATIENT_SYNC_ADMIN_DATABASE_URL',
    'MOCK_PVS_TEST_TOKEN',
  ])('rejects a nonempty privileged variable without exposing it: %s', variable => {
    expectInvalid({ ...validEnvironment, [variable]: 'must-not-appear' })
  })
})
