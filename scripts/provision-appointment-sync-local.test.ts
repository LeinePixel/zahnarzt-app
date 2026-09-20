// @vitest-environment node
import { expect, it } from 'vitest'
import { validateProvisioningConfig } from './provision-appointment-sync-local'

const valid = {
  APPOINTMENT_SYNC_SYNTHETIC_ONLY: '1',
  APPOINTMENT_SYNC_ADMIN_DATABASE_URL: 'postgresql://admin:secret@127.0.0.1:54322/postgres',
  APPOINTMENT_SYNC_PROVISION_INTEGRATION_ID: crypto.randomUUID(),
}

it('accepts an explicit local synthetic provisioning target', () => {
  expect(validateProvisioningConfig(valid)).toEqual({
    adminDatabaseUrl: valid.APPOINTMENT_SYNC_ADMIN_DATABASE_URL,
    integrationId: valid.APPOINTMENT_SYNC_PROVISION_INTEGRATION_ID,
  })
})

it.each([
  { APPOINTMENT_SYNC_SYNTHETIC_ONLY: '0' },
  { APPOINTMENT_SYNC_ADMIN_DATABASE_URL: 'postgresql://admin:secret@example.invalid:5432/postgres' },
  { APPOINTMENT_SYNC_ADMIN_DATABASE_URL: 'postgresql://admin:secret@localhost/postgres' },
  { APPOINTMENT_SYNC_ADMIN_DATABASE_URL: 'postgresql://admin:@localhost:54322/postgres' },
  { APPOINTMENT_SYNC_PROVISION_INTEGRATION_ID: 'not-a-uuid' },
])('rejects non-local, incomplete or non-synthetic provisioning: %o', override => {
  expect(() => validateProvisioningConfig({ ...valid, ...override }))
    .toThrow('Lokale Termin-Sync-Provisionierungskonfiguration ist ungültig.')
})
