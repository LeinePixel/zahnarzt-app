// @vitest-environment node
import { expect, it } from 'vitest'
import { validateProvisioningConfig } from './provision-patient-sync-local'

it('rejects hosted administrative databases', () => {
  expect(() => validateProvisioningConfig({
    PATIENT_SYNC_SYNTHETIC_ONLY: '1',
    PATIENT_SYNC_ADMIN_DATABASE_URL: 'postgresql://admin:secret@example.invalid:5432/postgres',
    PATIENT_SYNC_PROVISION_INTEGRATION_ID: crypto.randomUUID(),
  })).toThrow('Lokale Provisionierungskonfiguration ist ungültig.')
})
