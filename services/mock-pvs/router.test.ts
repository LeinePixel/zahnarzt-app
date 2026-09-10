// @vitest-environment node
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Appointment, Patient } from './contracts'
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
