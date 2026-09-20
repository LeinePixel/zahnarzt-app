// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { projectPatient, projectPatientChange, PatientProjectionError } from './source-projection'

const source = {
  id: 'synthetic-patient',
  version: 1,
  firstName: 'Synthetic',
  lastName: 'Fixture',
  birthDate: '2000-01-01',
  email: 'fixture@example.invalid',
  phoneE164: '+491234567',
  sourceCreatedAt: '2026-01-01T00:00:00Z',
  sourceUpdatedAt: '2026-01-01T00:00:00Z',
}

describe('minimal patient source projection', () => {
  it('retains exactly the approved patient fields', () => {
    expect(projectPatient(source)).toEqual({
      sourceId: source.id,
      sourceVersion: 1,
      firstName: source.firstName,
      lastName: source.lastName,
      birthDate: source.birthDate,
      phoneE164: source.phoneE164,
      sourceCreatedAt: source.sourceCreatedAt,
      sourceUpdatedAt: source.sourceUpdatedAt,
    })
    expect(Object.keys(projectPatient(source)).sort()).toEqual([
      'birthDate', 'firstName', 'lastName', 'phoneE164', 'sourceCreatedAt',
      'sourceId', 'sourceUpdatedAt', 'sourceVersion',
    ].sort())
  })

  it.each([
    { id: '' },
    { id: 'x'.repeat(101) },
    { firstName: '' },
    { firstName: 'x'.repeat(201) },
    { lastName: 'x'.repeat(201) },
    { birthDate: 'not-a-date' },
    { phoneE164: '01234' },
    { sourceCreatedAt: 'yesterday' },
    { sourceUpdatedAt: 'tomorrow' },
  ])('rejects invalid source fields neutrally: %o', change => {
    expect(() => projectPatient({ ...source, ...change })).toThrow(
      new PatientProjectionError('Patientenquelle ist ungültig.'),
    )
  })

  it('maps patient upserts and resource-free deletes', () => {
    expect(projectPatientChange({
      eventId: 'event-1', cursor: 'cursor-1', occurredAt: source.sourceUpdatedAt,
      entityType: 'patient', operation: 'upsert', entityId: source.id, version: 1,
      resource: source,
    })).toEqual({ operation: 'upsert', patient: projectPatient(source) })

    expect(projectPatientChange({
      eventId: 'event-2', cursor: 'cursor-2', occurredAt: source.sourceUpdatedAt,
      entityType: 'patient', operation: 'delete', entityId: source.id, version: 2,
    })).toEqual({ operation: 'delete', sourceId: source.id, sourceVersion: 2 })
  })

  it('ignores appointment changes', () => {
    expect(projectPatientChange({
      eventId: 'event-3', cursor: 'cursor-3', occurredAt: source.sourceUpdatedAt,
      entityType: 'appointment', operation: 'delete', entityId: 'appointment-1', version: 1,
    })).toBeNull()
  })
})
