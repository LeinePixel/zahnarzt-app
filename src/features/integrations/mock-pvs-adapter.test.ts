// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMockPvsServer } from '../../../services/mock-pvs/router'
import { loadMockPvsConfig as loadServiceConfig } from '../../../services/mock-pvs/config'
import { MockPvsAdapter } from './mock-pvs-adapter'

const readToken = randomBytes(32).toString('hex')
const testToken = randomBytes(32).toString('hex')
const now = new Date('2026-09-13T12:00:00Z')
let server: Server
let baseUrl: URL
async function listen(instance: Server) {
  server = instance
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Synthetic test server unavailable')
  baseUrl = new URL('http://127.0.0.1:' + address.port)
}
beforeEach(async () => listen(createMockPvsServer(loadServiceConfig({ MOCK_PVS_PORT: '3181', MOCK_PVS_READ_TOKEN: readToken, MOCK_PVS_TEST_TOKEN: testToken }))))
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) })
function adapter() { return new MockPvsAdapter({ baseUrl, readToken }, { now: () => now }) }
async function scenario(name: string) {
  expect((await fetch(new URL('/__test/scenarios/' + name, baseUrl), { method: 'POST', headers: { Authorization: 'Bearer ' + testToken } })).status).toBe(204)
}
it('reads health and round-trips opaque patient pages', async () => {
  const source = adapter()
  expect(await source.checkHealth()).toEqual({ ok: true, value: undefined })
  const first = await source.listPatients({ limit: 25 })
  expect(first.ok).toBe(true)
  if (!first.ok || !first.value.nextCursor) throw new Error('Expected synthetic page')
  expect(first.value.data).toHaveLength(25)
  const second = await source.listPatients({ cursor: first.value.nextCursor })
  expect(second).toMatchObject({ ok: true, value: { data: expect.any(Array), nextCursor: null } })
  if (second.ok) expect(second.value.data).toHaveLength(1)
})
it('reads appointments and deterministic upserts and resource-free deletes', async () => {
  expect(await adapter().listAppointments({ limit: 25 })).toMatchObject({ ok: true })
  await scenario('changes')
  const changes = await adapter().listChanges({ limit: 100 })
  expect(changes).toEqual(await adapter().listChanges({ limit: 100 }))
  expect(changes.ok && changes.value.data.some(event => event.operation === 'upsert')).toBe(true)
  await scenario('deletions')
  const deleted = await adapter().listChanges({ limit: 100 })
  expect(deleted.ok && deleted.value.data.some(event => event.operation === 'delete' && !('resource' in event))).toBe(true)
})
it.each([['invalid-source-data', 'source_contract_invalid', null], ['rate-limited', 'rate_limited', new Date(now.getTime() + 1000)], ['temporarily-unavailable', 'temporarily_unavailable', new Date(now.getTime() + 1000)]])('maps %s neutrally', async (name, code, retryAt) => {
  await scenario(String(name))
  expect(await adapter().listPatients({})).toEqual({ ok: false, error: { code, retryAt } })
})
it('uses fixed paths, encoded queries, only the read token and bounded fetch options', async () => {
  let requested: URL | undefined
  let options: RequestInit | undefined
  const source = new MockPvsAdapter({ baseUrl, readToken }, { fetch: async (input, init) => {
    requested = new URL(String(input)); options = init
    return new Response(JSON.stringify({ data: [], nextCursor: null }), { headers: { 'content-type': 'application/json' } })
  } })
  expect((await source.listAppointments({ patientId: 'synthetic +&id', cursor: 'opaque+/=', limit: 1 })).ok).toBe(true)
  expect(requested?.pathname).toBe('/v1/appointments')
  expect(requested?.searchParams.get('patientId')).toBe('synthetic +&id')
  expect(requested?.searchParams.get('cursor')).toBe('opaque+/=')
  expect(new Headers(options?.headers).get('Authorization') === 'Bearer ' + readToken).toBe(true)
  expect(JSON.stringify(options).includes(testToken)).toBe(false)
  expect(options?.redirect).toBe('error')
  expect(options?.cache).toBe('no-store')
  expect(options?.signal).toBeInstanceOf(AbortSignal)
})
it.each([{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { patientId: '' }, { from: 'yesterday' }, { from: '2026-01-02T00:00:00Z', to: '2026-01-01T00:00:00Z' }])('rejects invalid outgoing inputs before fetch', async input => {
  const fetcher = vi.fn()
  const source = new MockPvsAdapter({ baseUrl, readToken }, { fetch: fetcher })
  expect(await source.listAppointments(input)).toEqual({ ok: false, error: { code: 'configuration_invalid', retryAt: null } })
  expect(fetcher).not.toHaveBeenCalled()
})
it.each(['redirect', 'text', 'large', 'stream-large'])('rejects %s responses without forwarding bodies', async kind => {
  await new Promise<void>(resolve => server.close(() => resolve()))
  await listen(createServer((request, response) => {
    if (kind === 'redirect') { response.writeHead(302, { location: '/v1/patients' }); response.end(); return }
    response.setHeader('content-type', kind === 'text' ? 'text/plain' : 'application/json')
    if (kind === 'large') response.setHeader('content-length', '1048577')
    response.end(kind.includes('large') ? 'x'.repeat(1048577) : 'excluded source text')
  }))
  expect(await adapter().listPatients({})).toEqual({ ok: false, error: { code: 'source_protocol_invalid', retryAt: null } })
})
it.each(['0', '301', '-1', '1.5', 'Wed, 01 Jan 2026 00:00:00 GMT', null])('defaults invalid Retry-After %s to one minute', async header => {
  const source = new MockPvsAdapter({ baseUrl, readToken }, { now: () => now, fetch: async () => new Response(null, { status: 429, headers: header === null ? {} : { 'retry-after': header } }) })
  expect(await source.listChanges({})).toEqual({ ok: false, error: { code: 'rate_limited', retryAt: new Date(now.getTime() + 60000) } })
})
it('maps transport failures and invalid constructor configuration neutrally', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('excluded transport details'))
  expect(await new MockPvsAdapter({ baseUrl, readToken }, { fetch: fetcher }).checkHealth()).toEqual({ ok: false, error: { code: 'network_unavailable', retryAt: null } })
  fetcher.mockClear()
  expect(await new MockPvsAdapter({ baseUrl: new URL('https://example.invalid'), readToken }, { fetch: fetcher }).checkHealth()).toEqual({ ok: false, error: { code: 'configuration_invalid', retryAt: null } })
  expect(fetcher).not.toHaveBeenCalled()
})
