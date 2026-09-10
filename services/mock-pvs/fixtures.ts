import type { Appointment, ChangeEvent, Patient, ScenarioName } from './contracts'

type UnpositionedEvent = ChangeEvent extends infer E ? E extends ChangeEvent ? Omit<E, 'cursor'> : never : never
export type ScenarioFixture = { patients: Patient[]; appointments: Appointment[]; changes: UnpositionedEvent[] }
const createdAt = '2026-01-01T00:00:00Z'
const suffix = (index: number) => String(index + 1).padStart(3, '0')

// Deliberately fictional IDs, .invalid domains and non-routable +999 numbers.
// Each call creates fresh objects; state never shares mutable fixture instances.
export function createFixtures(scenario: ScenarioName): ScenarioFixture {
  const patients: Patient[] = Array.from({ length: 26 }, (_, i) => ({
    id: `mock-patient-${suffix(i)}`, version: 1,
    firstName: `Test${i + 1}`, lastName: `Patient${i + 1}`,
    birthDate: '1980-01-01', email: i === 25 ? null : `test${i + 1}@mock-pvs.invalid`,
    phoneE164: `+999000000${suffix(i)}`,
    sourceCreatedAt: createdAt, sourceUpdatedAt: createdAt,
  }))
  const statuses: Appointment['status'][] = ['confirmed', 'cancelled', 'no_show', 'rescheduled', 'completed']
  const appointments: Appointment[] = patients.map((patient, i) => ({
    id: `mock-appointment-${suffix(i)}`, version: 1, patientId: patient.id,
    startsAt: `2026-10-${String(i + 2).padStart(2, '0')}T10:00:00+02:00`,
    endsAt: `2026-10-${String(i + 2).padStart(2, '0')}T10:30:00+02:00`,
    status: statuses[i % statuses.length], practitionerId: 'mock-practitioner-001',
    sourceCreatedAt: createdAt, sourceUpdatedAt: createdAt,
  }))
  const changes: UnpositionedEvent[] = []
  if (scenario === 'changes') {
    patients[0] = { ...patients[0], version: 2, email: 'changed1@mock-pvs.invalid', sourceUpdatedAt: '2026-02-01T00:00:00Z' }
    appointments[0] = {
      ...appointments[0], version: 2, status: 'rescheduled',
      startsAt: '2026-10-02T11:00:00+02:00', endsAt: '2026-10-02T11:30:00+02:00',
      sourceUpdatedAt: '2026-02-01T00:01:00Z',
    }
    changes.push(
      { eventId: 'mock-event-001', occurredAt: patients[0].sourceUpdatedAt, entityType: 'patient', operation: 'upsert', entityId: patients[0].id, version: 2, resource: patients[0] },
      { eventId: 'mock-event-002', occurredAt: appointments[0].sourceUpdatedAt, entityType: 'appointment', operation: 'upsert', entityId: appointments[0].id, version: 2, resource: appointments[0] },
    )
  }
  if (scenario === 'deletions') {
    changes.push(
      { eventId: 'mock-event-001', occurredAt: '2026-02-01T00:00:00Z', entityType: 'appointment', operation: 'delete', entityId: appointments[25].id, version: 2 },
      { eventId: 'mock-event-002', occurredAt: '2026-02-01T00:01:00Z', entityType: 'patient', operation: 'delete', entityId: patients[25].id, version: 2 },
    )
    appointments.pop()
    patients.pop()
  }
  if (scenario === 'invalid-source-data') {
    patients[0].phoneE164 = 'not-a-phone-number'
    appointments[0].endsAt = '2026-10-02T09:30:00+02:00'
  }
  return { patients, appointments, changes }
}
