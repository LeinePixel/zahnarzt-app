import { createHash } from 'node:crypto'
import type { Appointment, ChangeEvent, Patient, ScenarioName } from './contracts'
import { createFixtures } from './fixtures'

export type Page<T> = { data: readonly T[]; nextCursor: string | null }
type Pagination = { cursor: string | null; limit: number }
type AppointmentQuery = Pagination & { patientId: string | null; from: string | null; to: string | null }
export type ScenarioState = {
  activeScenario(): ScenarioName
  activate(name: ScenarioName): void
  reset(): void
  listPatients(input: Pagination): Page<Patient>
  listAppointments(input: AppointmentQuery): Page<Appointment>
  listChanges(input: Pagination): Page<ChangeEvent>
}

export class InvalidCursorError extends Error {
  constructor() { super('Ungültiger Cursor.') }
}

export function createScenarioState(): ScenarioState {
  let active: ScenarioName = 'baseline'
  let fixture = createFixtures(active)
  const cursors = new Map<string, { stream: string; scenario: ScenarioName; offset: number }>()

  function cursorFor(stream: string, offset: number) {
    const cursor = createHash('sha256').update(JSON.stringify(['v1', stream, active, offset])).digest('base64url')
    cursors.set(cursor, { stream, scenario: active, offset })
    return cursor
  }
  function paginate<T>(records: readonly T[], stream: string, input: Pagination): Page<T> {
    const entry = input.cursor === null ? null : cursors.get(input.cursor)
    if (input.cursor !== null && (!entry || entry.stream !== stream || entry.scenario !== active)) throw new InvalidCursorError()
    const offset = entry?.offset ?? 0
    const end = Math.min(offset + input.limit, records.length)
    return { data: structuredClone(records.slice(offset, end)), nextCursor: end < records.length ? cursorFor(stream, end) : null }
  }
  function activate(name: ScenarioName) {
    active = name
    fixture = createFixtures(name)
    cursors.clear()
  }
  return {
    activeScenario: () => active,
    activate,
    reset: () => activate('baseline'),
    listPatients: input => paginate(fixture.patients, 'patients', input),
    listAppointments(input) {
      const records = fixture.appointments.filter(a =>
        (input.patientId === null || a.patientId === input.patientId) &&
        (input.from === null || Date.parse(a.startsAt) >= Date.parse(input.from)) &&
        (input.to === null || Date.parse(a.startsAt) < Date.parse(input.to)),
      )
      // Continuation positions belong to the filtered stream, never another query.
      const stream = JSON.stringify(['appointments', input.patientId, input.from, input.to])
      return paginate(records, stream, input)
    },
    listChanges(input) {
      const events = fixture.changes.map((event, index): ChangeEvent => ({ ...event, cursor: cursorFor('changes', index + 1) }))
      return paginate(events, 'changes', input)
    },
  }
}
