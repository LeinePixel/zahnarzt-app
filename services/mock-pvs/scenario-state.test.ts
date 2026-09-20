// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { appointmentSchema, changeEventSchema, patientSchema } from './contracts'
import { createScenarioState } from './scenario-state'

const page = { cursor: null, limit: 100 }
const appointments = { ...page, patientId: null, from: null, to: null }

describe('scenario state', () => {
  it('returns stable non-overlapping pages of 25 and 1 patients', () => {
    const state = createScenarioState()
    const first = state.listPatients({ cursor: null, limit: 25 })
    expect(first.data).toHaveLength(25)
    expect(first.nextCursor !== null && !first.nextCursor.includes('mock-patient-')).toBe(true)
    const second = state.listPatients({ cursor: first.nextCursor, limit: 25 })
    expect(second.data).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.data, ...second.data].map(p => p.id)).size).toBe(26)
    expect(state.listPatients({ cursor: first.nextCursor, limit: 25 })).toEqual(second)
  })
  it('provides more than a standard page of appointments and all statuses', () => {
    const state = createScenarioState()
    const result = state.listAppointments(appointments)
    expect(result.data.length > 25).toBe(true)
    expect([...new Set(result.data.map(a => a.status))].sort()).toEqual(['cancelled', 'completed', 'confirmed', 'no_show', 'rescheduled'])
  })
  it('filters startsAt with an inclusive start and exclusive end, matching patient IDs exactly', () => {
    const state = createScenarioState()
    const result = state.listAppointments({ ...appointments, from: '2026-10-02T08:00:00Z', to: '2026-10-02T09:00:00Z' })
    expect(result.data.map(a => a.id)).toEqual(['mock-appointment-001'])
    expect(state.listAppointments({ ...appointments, patientId: 'mock-patient-001' }).data.map(a => a.patientId)).toEqual(['mock-patient-001'])
    expect(state.listAppointments({ ...appointments, patientId: 'mock-patient-00' }).data).toEqual([])
  })
  it('rejects unknown, cross-stream, cross-filter and cross-scenario cursors', () => {
    const state = createScenarioState()
    expect(() => state.listPatients({ ...page, cursor: 'unknown' })).toThrow('Ungültiger Cursor.')
    const patientCursor = state.listPatients({ ...page, limit: 1 }).nextCursor
    expect(() => state.listChanges({ ...page, cursor: patientCursor })).toThrow('Ungültiger Cursor.')
    const appointmentCursor = state.listAppointments({ ...appointments, limit: 1 }).nextCursor
    expect(() => state.listAppointments({ ...appointments, cursor: appointmentCursor, patientId: 'mock-patient-001' })).toThrow('Ungültiger Cursor.')
    state.activate('changes')
    const changesCursor = state.listChanges({ ...page, limit: 1 }).nextCursor
    expect(changesCursor).not.toBeNull()
    state.reset()
    expect(() => state.listChanges({ ...page, cursor: changesCursor })).toThrow('Ungültiger Cursor.')
  })
  it('repeats full versioned changes and resumes after an event cursor', () => {
    const state = createScenarioState()
    state.activate('changes')
    const result = state.listChanges(page)
    expect(result.data.length >= 2).toBe(true)
    expect(result.data.every(e => changeEventSchema.safeParse(e).success)).toBe(true)
    expect(result.data.every(e => e.operation === 'upsert' && e.version === 2)).toBe(true)
    expect(state.listChanges(page)).toEqual(result)
    expect(state.listChanges({ ...page, cursor: result.data[0].cursor }).data).toEqual(result.data.slice(1))
    expect(Date.parse(result.data[1].occurredAt) > Date.parse(result.data[0].occurredAt)).toBe(true)
    expect(state.listPatients(page).data[0].version).toBe(2)
    expect(state.listAppointments(appointments).data[0].status).toBe('rescheduled')
  })
  it('removes deleted sources and emits resource-free version-2 tombstones', () => {
    const state = createScenarioState()
    state.activate('deletions')
    const result = state.listChanges(page)
    expect(result.data.length > 0).toBe(true)
    expect(result.data.every(e => e.operation === 'delete' && e.version === 2 && !('resource' in e))).toBe(true)
    for (const event of result.data) {
      const records = event.entityType === 'patient' ? state.listPatients(page).data : state.listAppointments(appointments).data
      expect(records.some(r => r.id === event.entityId)).toBe(false)
    }
  })
  it('keeps invalid source data confined to its scenario and resets exactly', () => {
    const state = createScenarioState()
    const baseline = state.listPatients(page)
    state.activate('invalid-source-data')
    expect(state.listPatients(page).data.some(p => !patientSchema.safeParse(p).success)).toBe(true)
    expect(state.listAppointments(appointments).data.some(a => !appointmentSchema.safeParse(a).success)).toBe(true)
    expect(createScenarioState().listPatients(page)).toEqual(baseline)
    state.reset()
    expect(state.activeScenario()).toBe('baseline')
    expect(state.listPatients(page)).toEqual(baseline)
  })
  it.each(['baseline', 'changes', 'deletions', 'rate-limited', 'temporarily-unavailable'] as const)('validates every resource in %s', scenario => {
    const state = createScenarioState()
    state.activate(scenario)
    expect(state.listPatients(page).data.every(p => patientSchema.safeParse(p).success)).toBe(true)
    expect(state.listAppointments(appointments).data.every(a => appointmentSchema.safeParse(a).success)).toBe(true)
    expect(state.listChanges(page).data.every(e => changeEventSchema.safeParse(e).success)).toBe(true)
  })
})
