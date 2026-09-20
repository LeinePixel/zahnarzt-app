// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { loadMockPvsConfig, MockPvsConfigError } from './mock-pvs-config'
import { appointmentSchema, changeEventSchema, patientSchema, patientPageSchema } from './contracts'

const environment = { MOCK_PVS_BASE_URL: 'http://127.0.0.1:3181', MOCK_PVS_READ_TOKEN: ' synthetic-read-token ' }
const patient = { id: 'synthetic-patient', version: 1, firstName: 'Synthetic', lastName: 'Fixture', birthDate: '2000-01-01', email: null, phoneE164: '+491234567', sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z' }
describe('private local configuration', () => {
  it.each(['http://127.0.0.1:3181', 'http://localhost:3181/'])('accepts %s', origin => {
    expect(loadMockPvsConfig({ ...environment, MOCK_PVS_BASE_URL: origin })).toEqual({ baseUrl: new URL(origin), readToken: 'synthetic-read-token' })
  })
  it.each([undefined, '', 'https://localhost:3181', 'http://example.invalid:3181', 'http://localhost', 'http://user:password@localhost:3181', 'http://localhost:3181/path', 'http://localhost:3181/?q=value', 'http://localhost:3181/#fragment'])('rejects invalid origins neutrally', origin => {
    expect(() => loadMockPvsConfig({ ...environment, MOCK_PVS_BASE_URL: origin })).toThrow(new MockPvsConfigError('Mock-PVS-Integration ist ungültig.'))
  })
  it.each([undefined, '', '   ', 'synthetic\nheader'])('rejects absent or unsafe read tokens', token => {
    expect(() => loadMockPvsConfig({ ...environment, MOCK_PVS_READ_TOKEN: token })).toThrow(MockPvsConfigError)
  })
})
describe('DentPilot source contracts', () => {
  it('accepts a valid patient page and rejects extra envelope keys', () => {
    expect(patientPageSchema.safeParse({ data: [patient], nextCursor: null }).success).toBe(true)
    expect(patientPageSchema.safeParse({ data: [patient], nextCursor: null, raw: 'excluded' }).success).toBe(false)
  })
  it('rejects invalid timestamps and phone values', () => {
    expect(patientSchema.safeParse({ ...patient, sourceUpdatedAt: 'yesterday' }).success).toBe(false)
    expect(patientSchema.safeParse({ ...patient, phoneE164: '01234' }).success).toBe(false)
  })
  it('rejects appointments ending before they start', () => {
    expect(appointmentSchema.safeParse({ id: 'synthetic-appointment', version: 1, patientId: patient.id, startsAt: '2026-01-01T10:00:00Z', endsAt: '2026-01-01T09:00:00Z', status: 'confirmed', practitionerId: 'synthetic-practitioner', sourceCreatedAt: patient.sourceCreatedAt, sourceUpdatedAt: patient.sourceUpdatedAt }).success).toBe(false)
  })
  it.each([{ entityId: 'different', version: 1 }, { entityId: patient.id, version: 2 }])('rejects mismatched upsert identity and version', identity => {
    expect(changeEventSchema.safeParse({ eventId: 'synthetic-event', cursor: 'opaque', occurredAt: patient.sourceUpdatedAt, ...identity, entityType: 'patient', operation: 'upsert', resource: patient }).success).toBe(false)
  })
})
