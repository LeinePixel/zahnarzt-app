// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { appointmentSchema, changeEventSchema, patientSchema } from './contracts'

const patient = {
  id: 'mock-patient-001', version: 1, firstName: 'Test1', lastName: 'Patient1',
  birthDate: '1980-01-01', email: 'test1@mock-pvs.invalid', phoneE164: '+999000000001',
  sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
}
const appointment = {
  id: 'mock-appointment-001', version: 1, patientId: 'mock-patient-001',
  startsAt: '2026-10-02T10:00:00+02:00', endsAt: '2026-10-02T10:30:00+02:00',
  status: 'confirmed', practitionerId: 'mock-practitioner-001',
  sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
}

describe('Mock-PVS contracts', () => {
  it('accepts synthetic contact fields, nullable email and offset-aware appointments', () => {
    expect(patientSchema.safeParse(patient).success).toBe(true)
    expect(patientSchema.safeParse({ ...patient, email: null }).success).toBe(true)
    expect(appointmentSchema.safeParse(appointment).success).toBe(true)
  })
  it.each([
    { phoneE164: 'not-a-phone-number' }, { email: undefined }, { birthDate: '1980-02-30' },
    { version: 0 }, { diagnosis: 'excluded' }, { sourceUpdatedAt: '2026-01-01T00:00:00' },
  ])('rejects invalid or excessive patient fields (case %#)', patch => {
    expect(patientSchema.safeParse({ ...patient, ...patch }).success).toBe(false)
  })
  it.each([
    { endsAt: '2026-10-02T10:00:00+02:00' }, { endsAt: '2026-10-02T09:30:00+02:00' },
    { startsAt: '2026-10-02T10:00:00' }, { status: 'unknown' }, { notes: 'excluded' },
  ])('rejects invalid appointment values (case %#)', patch => {
    expect(appointmentSchema.safeParse({ ...appointment, ...patch }).success).toBe(false)
  })
  it('requires a matching complete upsert and forbids resources on tombstones', () => {
    const event = { eventId: 'mock-event-001', cursor: 'opaque', occurredAt: '2026-02-01T00:00:00Z', entityType: 'patient', entityId: patient.id, version: 1 }
    expect(changeEventSchema.safeParse({ ...event, operation: 'upsert', resource: patient }).success).toBe(true)
    expect(changeEventSchema.safeParse({ ...event, operation: 'upsert' }).success).toBe(false)
    expect(changeEventSchema.safeParse({ ...event, operation: 'upsert', resource: appointment }).success).toBe(false)
    expect(changeEventSchema.safeParse({ ...event, version: 2, operation: 'upsert', resource: patient }).success).toBe(false)
    expect(changeEventSchema.safeParse({ ...event, operation: 'delete' }).success).toBe(true)
    expect(changeEventSchema.safeParse({ ...event, operation: 'delete', resource: patient }).success).toBe(false)
  })
})
