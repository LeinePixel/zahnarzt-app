// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { AppointmentSyncConfigError, loadAppointmentSyncConfig } from './sync-config'

const validEnvironment = {
  APPOINTMENT_SYNC_SYNTHETIC_ONLY: '1',
  APPOINTMENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_appointment_sync_fixture:secret@127.0.0.1:54322/postgres',
  MOCK_PVS_BASE_URL: 'http://127.0.0.1:3181',
  MOCK_PVS_READ_TOKEN: 'synthetic-read-token',
}

const expectInvalid = (environment: Record<string, string | undefined>) => {
  expect(() => loadAppointmentSyncConfig(environment)).toThrow(
    new AppointmentSyncConfigError('Terminsync-Konfiguration ist ungültig.'),
  )
}

describe('appointment sync runtime configuration', () => {
  it('accepts only an explicit local synthetic runtime configuration', () => {
    const config = loadAppointmentSyncConfig(validEnvironment)
    expect(config.databaseUrl).toBe(validEnvironment.APPOINTMENT_SYNC_DATABASE_URL)
    expect(config.mockPvs).toEqual({
      baseUrl: new URL(validEnvironment.MOCK_PVS_BASE_URL),
      readToken: validEnvironment.MOCK_PVS_READ_TOKEN,
    })
  })

  it.each([
    { APPOINTMENT_SYNC_SYNTHETIC_ONLY: undefined },
    { APPOINTMENT_SYNC_SYNTHETIC_ONLY: '0' },
    { APPOINTMENT_SYNC_DATABASE_URL: '' },
    { APPOINTMENT_SYNC_DATABASE_URL: 'https://dentpilot_appointment_sync_fixture:secret@127.0.0.1:54322/postgres' },
    { APPOINTMENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_appointment_sync_fixture:secret@example.invalid:54322/postgres' },
    { APPOINTMENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_appointment_sync_fixture:secret@localhost/postgres' },
    { APPOINTMENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_appointment_sync_fixture:secret@localhost:54322/' },
    { APPOINTMENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_appointment_sync_fixture:@localhost:54322/postgres' },
    { APPOINTMENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_sync_fixture:secret@localhost:54322/postgres' },
    { APPOINTMENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_appointment_sync_fixture:secret@localhost:54322/postgres?sslmode=disable' },
    { APPOINTMENT_SYNC_DATABASE_URL: 'postgresql://dentpilot_appointment_sync_fixture:secret@localhost:54322/postgres#fragment' },
    { MOCK_PVS_READ_TOKEN: '' },
  ])('rejects incomplete, privileged or non-local configuration: %o', override => {
    expectInvalid({ ...validEnvironment, ...override })
  })

  it.each([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SEED_PRAXISADMIN_PASSWORD',
    'APPOINTMENT_SYNC_ADMIN_DATABASE_URL',
    'MOCK_PVS_TEST_TOKEN',
  ])('rejects a nonempty privileged variable without exposing it: %s', variable => {
    expectInvalid({ ...validEnvironment, [variable]: 'must-not-appear' })
  })
})
