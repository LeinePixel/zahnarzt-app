// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  AppointmentProjectionError,
  projectAppointment,
  projectAppointmentChange,
} from './source-projection'

const source = {
  id: 'synthetic-appointment',
  version: 1,
  patientId: 'synthetic-patient',
  startsAt: '2026-10-02T08:00:00Z',
  endsAt: '2026-10-02T08:30:00Z',
  status: 'confirmed' as const,
  practitionerId: 'synthetic-practitioner',
  sourceCreatedAt: '2026-01-01T00:00:00Z',
  sourceUpdatedAt: '2026-01-01T00:00:00Z',
}

describe('minimal appointment source projection', () => {
  it('retains exactly the approved appointment fields', () => {
    expect(projectAppointment(source)).toEqual({
      sourceId: source.id,
      sourceVersion: 1,
      patientSourceId: source.patientId,
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      status: source.status,
      practitionerSourceId: source.practitionerId,
      sourceCreatedAt: source.sourceCreatedAt,
      sourceUpdatedAt: source.sourceUpdatedAt,
    })
    expect(Object.keys(projectAppointment(source)).sort()).toEqual([
      'endsAt', 'patientSourceId', 'practitionerSourceId', 'sourceCreatedAt',
      'sourceId', 'sourceUpdatedAt', 'sourceVersion', 'startsAt', 'status',
    ].sort())
  })

  it.each(['confirmed', 'cancelled', 'no_show', 'rescheduled', 'completed'] as const)(
    'accepts the closed %s status',
    status => expect(projectAppointment({ ...source, status }).status).toBe(status),
  )

  it.each([
    { id: '' },
    { id: 'x'.repeat(101) },
    { version: 0 },
    { patientId: '' },
    { patientId: 'x'.repeat(101) },
    { practitionerId: '' },
    { practitionerId: 'x'.repeat(101) },
    { startsAt: 'not-a-time' },
    { endsAt: 'not-a-time' },
    { endsAt: source.startsAt },
    { endsAt: '2026-10-02T07:59:59Z' },
    { status: 'scheduled' },
    { sourceCreatedAt: 'yesterday' },
    { sourceUpdatedAt: 'tomorrow' },
  ])('rejects invalid source fields neutrally: %o', change => {
    expect(() => projectAppointment({ ...source, ...change })).toThrow(
      new AppointmentProjectionError('Terminquelle ist ungültig.'),
    )
  })

  it('rejects unknown source fields rather than retaining them', () => {
    expect(() => projectAppointment({ ...source, note: 'must not persist' })).toThrow(
      new AppointmentProjectionError('Terminquelle ist ungültig.'),
    )
  })

  it('maps appointment upserts and resource-free deletes', () => {
    expect(projectAppointmentChange({
      eventId: 'event-1', cursor: 'cursor-1', occurredAt: source.sourceUpdatedAt,
      entityType: 'appointment', operation: 'upsert', entityId: source.id, version: 1,
      resource: source,
    })).toEqual({ operation: 'upsert', appointment: projectAppointment(source) })

    expect(projectAppointmentChange({
      eventId: 'event-2', cursor: 'cursor-2', occurredAt: source.sourceUpdatedAt,
      entityType: 'appointment', operation: 'delete', entityId: source.id, version: 2,
    })).toEqual({ operation: 'delete', sourceId: source.id, sourceVersion: 2 })
  })

  it('ignores patient changes', () => {
    expect(projectAppointmentChange({
      eventId: 'event-3', cursor: 'cursor-3', occurredAt: source.sourceUpdatedAt,
      entityType: 'patient', operation: 'delete', entityId: 'patient-1', version: 1,
    })).toBeNull()
  })
})
