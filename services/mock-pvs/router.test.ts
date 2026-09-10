// @vitest-environment node
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appointmentSchema, patientSchema, type Appointment, type ChangeEvent, type Patient } from './contracts'
import { loadMockPvsConfig } from './config'
import { createMockPvsServer } from './router'
import { createScenarioState } from './scenario-state'

type Paged<T> = { data: T[]; nextCursor: string | null }
const readToken = randomBytes(32).toString('hex')
const testToken = randomBytes(32).toString('hex')
const config = loadMockPvsConfig({ MOCK_PVS_PORT: '3181', MOCK_PVS_READ_TOKEN: readToken, MOCK_PVS_TEST_TOKEN: testToken })
let server: Server
let baseUrl: string

beforeEach(async () => {
  server = createMockPvsServer(config, createScenarioState())
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server unavailable')
  baseUrl = 'http://127.0.0.1:' + address.port
})
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})
function request(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', 'Bearer ' + token)
  return fetch(baseUrl + path, { ...init, headers })
}
async function json<T>(path: string): Promise<Paged<T>> {
  const response = await request(path, readToken)
  expect(response.status).toBe(200)
  return await response.json() as Paged<T>
}

describe('protected read API', () => {
  it('returns protected health with no-store and no CORS', async () => {
    const response = await request('/v1/health', readToken)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.has('access-control-allow-origin')).toBe(false)
    await expect(response.json()).resolves.toEqual({ data: { apiVersion: 'v1' } })
  })
  it.each(['missing', 'wrong', 'test scope', 'basic', 'extra bearer value'])('rejects %s authorization neutrally', async kind => {
    const header = kind === 'test scope' ? 'Bearer ' + testToken : kind === 'basic' ? 'Basic ' + readToken : kind === 'extra bearer value' ? 'Bearer ' + readToken + ' extra' : 'Bearer wrong'
    const response = await request('/v1/patients', undefined, { headers: kind === 'missing' ? {} : { Authorization: header } })
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
  })
  it('paginates patients without duplication and repeats the same page', async () => {
    const first = await json<Patient>('/v1/patients')
    expect(Object.keys(first).sort()).toEqual(['data', 'nextCursor'])
    expect(first.data).toHaveLength(25)
    expect(first.nextCursor).not.toBeNull()
    const path = '/v1/patients?cursor=' + encodeURIComponent(first.nextCursor!)
    const second = await json<Patient>(path)
    expect(second.data).toHaveLength(1)
    expect(new Set([...first.data, ...second.data].map(p => p.id)).size).toBe(26)
    expect(second.nextCursor).toBeNull()
    expect(await json<Patient>(path)).toEqual(second)
  })
  it('looks up exactly one patient', async () => {
    const response = await request('/v1/patients/mock-patient-001', readToken)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Object.keys(body)).toEqual(['data'])
    expect(body.data.id).toBe('mock-patient-001')
  })
  it.each(['/v1/patients/unknown', '/unknown', '/v1/unknown'])('returns neutral 404 for %s', async path => {
    const response = await request(path, readToken)
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'not_found' })
  })
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('forbids %s on regular data', async method => {
    const response = await request('/v1/patients', readToken, { method })
    expect(response.status).toBe(404)
  })
  it.each([
    '/v1/patients?limit=101', '/v1/patients?limit=0', '/v1/patients?limit=-1', '/v1/patients?limit=1.5',
    '/v1/patients?limit=', '/v1/patients?limit=NaN', '/v1/patients?limit=1&limit=2',
    '/v1/patients?cursor=unknown', '/v1/patients?extra=1',
    '/v1/appointments?from=invalid', '/v1/appointments?patientId=',
    '/v1/appointments?from=2026-10-02T10:00:00',
    '/v1/appointments?from=2026-10-02T08:00:00Z&to=2026-10-02T08:00:00Z',
  ])('rejects malformed queries (case %#)', async path => {
    const response = await request(path, readToken)
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_request' })
  })
  it('filters appointments inclusively/exclusively and paginates their full snapshot', async () => {
    const filtered = await json<Appointment>('/v1/appointments?from=2026-10-02T08:00:00Z&to=2026-10-02T09:00:00Z&patientId=mock-patient-001')
    expect(filtered.data.map(a => a.id)).toEqual(['mock-appointment-001'])
    const first = await json<Appointment>('/v1/appointments')
    expect(first.data).toHaveLength(25)
    const second = await json<Appointment>('/v1/appointments?cursor=' + encodeURIComponent(first.nextCursor!))
    expect(second.data).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
  })
  it('returns the baseline change envelope', async () => {
    expect(await json('/v1/changes')).toEqual({ data: [], nextCursor: null })
  })
})

describe('fixed local test control', () => {
  it.each(['missing', 'wrong', 'read'])('rejects %s scope before changing state', async kind => {
    const token = kind === 'read' ? readToken : kind === 'wrong' ? 'wrong' : undefined
    const response = await request('/__test/scenarios/changes', token, { method: 'POST' })
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
    expect((await json('/v1/changes')).data).toEqual([])
  })
  it('keeps regular reads inaccessible to the test token', async () => {
    expect((await request('/v1/changes', testToken)).status).toBe(401)
  })
  it('activates repeatable changes with complete resources and resets exactly', async () => {
    const baseline = await json<Patient>('/v1/patients?limit=100')
    expect((await request('/__test/scenarios/changes', testToken, { method: 'POST' })).status).toBe(204)
    const changes = await json<ChangeEvent>('/v1/changes?limit=100')
    expect(changes.data.every(e => e.operation === 'upsert' && e.version === 2 && e.resource.id === e.entityId)).toBe(true)
    expect(changes.data).toHaveLength(2)
    expect(await json<ChangeEvent>('/v1/changes?limit=100')).toEqual(changes)
    const first = await json<ChangeEvent>('/v1/changes?limit=1')
    const nextPath = '/v1/changes?cursor=' + encodeURIComponent(first.nextCursor!)
    expect((await json<ChangeEvent>(nextPath)).data).toEqual(changes.data.slice(1))
    expect((await request('/__test/reset', testToken, { method: 'POST' })).status).toBe(204)
    expect(await json<Patient>('/v1/patients?limit=100')).toEqual(baseline)
    expect((await request(nextPath, readToken)).status).toBe(422)
  })
  it('returns tombstones without resources and excludes deleted sources', async () => {
    await request('/__test/scenarios/deletions', testToken, { method: 'POST' })
    const events = await json<ChangeEvent>('/v1/changes')
    expect(events.data).toHaveLength(2)
    expect(events.data.every(e => e.operation === 'delete' && !('resource' in e))).toBe(true)
    expect((await request('/v1/patients/mock-patient-026', readToken)).status).toBe(404)
    expect((await json<Appointment>('/v1/appointments?patientId=mock-patient-026')).data).toEqual([])
  })
  it.each([['rate-limited', 429, 'rate_limited'], ['temporarily-unavailable', 503, 'temporarily_unavailable']] as const)('applies %s to all data routes while keeping health and reset available', async (scenario, status, error) => {
    expect((await request('/__test/scenarios/' + scenario, testToken, { method: 'POST' })).status).toBe(204)
    for (const path of ['/v1/patients', '/v1/patients/mock-patient-001', '/v1/appointments', '/v1/changes']) {
      const response = await request(path, readToken)
      expect(response.status).toBe(status)
      expect(response.headers.get('retry-after')).toBe('1')
      await expect(response.json()).resolves.toEqual({ error })
      expect((await request(path)).status).toBe(401)
    }
    expect((await request('/v1/health', readToken)).status).toBe(200)
    expect((await request('/__test/reset', testToken, { method: 'POST' })).status).toBe(204)
    expect((await request('/v1/patients', readToken)).status).toBe(200)
  })
  it('delivers malformed source data only in the declared scenario', async () => {
    await request('/__test/scenarios/invalid-source-data', testToken, { method: 'POST' })
    const patients = await json<Patient>('/v1/patients?limit=100')
    const appointments = await json<Appointment>('/v1/appointments?limit=100')
    expect(patients.data.filter(p => !patientSchema.safeParse(p).success)).toHaveLength(1)
    expect(appointments.data.filter(a => !appointmentSchema.safeParse(a).success)).toHaveLength(1)
    const response = await request('/v1/patients/mock-patient-001', readToken)
    expect(response.status).toBe(200)
    expect(patientSchema.safeParse((await response.json()).data).success).toBe(false)
    await request('/__test/reset', testToken, { method: 'POST' })
    expect((await json<Patient>('/v1/patients?limit=100')).data.every(p => patientSchema.safeParse(p).success)).toBe(true)
  })
  it.each([['/__test/scenarios/unknown', 'POST'], ['/__test/patients', 'POST'], ['/__test/reset', 'GET'], ['/__test/scenarios/changes', 'PUT']])('rejects unsupported test route (case %#)', async (path, method) => {
    const response = await request(path, testToken, { method })
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'not_found' })
  })
  it('rejects payloads instead of accepting free-form data', async () => {
    const response = await request('/__test/scenarios/changes', testToken, { method: 'POST', body: JSON.stringify({ patients: [] }) })
    expect(response.status).toBe(422)
    expect((await json('/v1/changes')).data).toEqual([])
  })
  it('neutralizes unexpected state failures and validates normal output', async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
    const state = createScenarioState()
    state.listPatients = () => { throw new Error('private internal details') }
    server = createMockPvsServer(config, state)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server unavailable')
    baseUrl = 'http://127.0.0.1:' + address.port
    const response = await request('/v1/patients', readToken)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'internal_error' })
    const invalid = createScenarioState()
    invalid.activate('invalid-source-data')
    state.listPatients = invalid.listPatients
    const invalidResponse = await request('/v1/patients', readToken)
    expect(invalidResponse.status).toBe(500)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'internal_error' })
  })
})
