// @vitest-environment node
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockPvsServer } from '../../../services/mock-pvs/router'
import { loadMockPvsConfig as loadServiceConfig } from '../../../services/mock-pvs/config'
import { MockPvsAdapter } from '@/features/integrations/mock-pvs-adapter'
import type { PatientSyncCommit, PatientSyncRepository } from './sync-repository'
import { runPatientSync } from './sync-patients'

const readToken = randomBytes(32).toString('hex')
const testToken = randomBytes(32).toString('hex')
let server: Server
let baseUrl: URL

beforeEach(async () => {
  server = createMockPvsServer(loadServiceConfig({ MOCK_PVS_PORT: '3181', MOCK_PVS_READ_TOKEN: readToken, MOCK_PVS_TEST_TOKEN: testToken }))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Synthetic server unavailable')
  baseUrl = new URL(`http://127.0.0.1:${address.port}`)
})
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) })

async function activate(name: string) {
  const response = await fetch(new URL(`/__test/scenarios/${name}`, baseUrl), { method: 'POST', headers: { Authorization: `Bearer ${testToken}` } })
  expect(response.status).toBe(204)
}
function captureRepository(initialImportCompleted = false, confirmedChangeCursor: string | null = null): PatientSyncRepository & { committed?: PatientSyncCommit } {
  const repository: PatientSyncRepository & { committed?: PatientSyncCommit } = {
    acquire: vi.fn(async () => ({ ok: true as const, checkpoint: { integrationId: crypto.randomUUID(), initialImportCompleted, confirmedChangeCursor } })),
    commit: vi.fn(async input => { repository.committed = input; return { ok: true as const } }),
    recordFailure: vi.fn(async () => true),
    close: vi.fn(async () => undefined),
  }
  return repository
}

describe('patient synchronization over the real Mock-PVS HTTP contract', () => {
  it('imports the complete paged baseline without email', async () => {
    const repository = captureRepository()
    expect(await runPatientSync(new MockPvsAdapter({ baseUrl, readToken }), repository)).toEqual({ ok: true })
    expect(repository.committed?.snapshot).toHaveLength(26)
    expect(repository.committed?.snapshot.every(item => !('email' in item))).toBe(true)
  })

  it('projects patient changes while consuming appointment positions', async () => {
    await activate('changes')
    const repository = captureRepository()
    expect(await runPatientSync(new MockPvsAdapter({ baseUrl, readToken }), repository)).toEqual({ ok: true })
    expect(repository.committed?.mutations.some(item => item.operation === 'upsert' && item.patient.sourceVersion === 2)).toBe(true)
    expect(repository.committed?.candidateCursor).toBeTruthy()
    const independent = await new MockPvsAdapter({ baseUrl, readToken }).listChanges({ limit: 100 })
    expect(independent.ok && independent.value.data.some(event => event.entityType === 'appointment')).toBe(true)
  })

  it('returns a neutral failure for invalid source data without a commit', async () => {
    await activate('invalid-source-data')
    const repository = captureRepository()
    expect(await runPatientSync(new MockPvsAdapter({ baseUrl, readToken }), repository)).toEqual({ ok: false, code: 'source_contract_invalid' })
    expect(repository.committed).toBeUndefined()
  })

  it('projects resource-free deletions', async () => {
    await activate('deletions')
    const repository = captureRepository()
    expect(await runPatientSync(new MockPvsAdapter({ baseUrl, readToken }), repository)).toEqual({ ok: true })
    expect(repository.committed?.mutations.some(item => item.operation === 'delete')).toBe(true)
  })

  it('maps provider throttling without a commit', async () => {
    await activate('rate-limited')
    const repository = captureRepository()
    expect(await runPatientSync(new MockPvsAdapter({ baseUrl, readToken }), repository)).toEqual({ ok: false, code: 'rate_limited' })
    expect(repository.committed).toBeUndefined()
  })

  it('rejects an opaque cursor invalidated by a scenario reset', async () => {
    await activate('changes')
    const first = captureRepository()
    expect(await runPatientSync(new MockPvsAdapter({ baseUrl, readToken }), first)).toEqual({ ok: true })
    const confirmed = first.committed?.candidateCursor
    expect(confirmed).toBeTruthy()
    await activate('baseline')
    const resumed = captureRepository(true, confirmed ?? null)
    expect(await runPatientSync(new MockPvsAdapter({ baseUrl, readToken }), resumed)).toEqual({ ok: false, code: 'source_protocol_invalid' })
    expect(resumed.committed).toBeUndefined()
  })
})
