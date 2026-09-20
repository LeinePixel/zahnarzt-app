// @vitest-environment node
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockPvsServer } from '../../../services/mock-pvs/router'
import { loadMockPvsConfig as loadServiceConfig } from '../../../services/mock-pvs/config'
import { MockPvsAdapter } from '@/features/integrations/mock-pvs-adapter'
import type { AppointmentSyncCommit, AppointmentSyncRepository } from './sync-repository'
import { runAppointmentSync } from './sync-appointments'

const readToken = randomBytes(32).toString('hex')
const testToken = randomBytes(32).toString('hex')
let server: Server
let baseUrl: URL

beforeEach(async () => {
  server = createMockPvsServer(loadServiceConfig({
    MOCK_PVS_PORT: '3181', MOCK_PVS_READ_TOKEN: readToken, MOCK_PVS_TEST_TOKEN: testToken,
  }))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Synthetic server unavailable')
  baseUrl = new URL(`http://127.0.0.1:${address.port}`)
})
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})

async function activate(name: string) {
  const response = await fetch(new URL(`/__test/scenarios/${name}`, baseUrl), {
    method: 'POST', headers: { Authorization: `Bearer ${testToken}` },
  })
  expect(response.status).toBe(204)
}

function captureRepository(
  initialImportCompleted = false,
  confirmedChangeCursor: string | null = null,
): AppointmentSyncRepository & { committed?: AppointmentSyncCommit } {
  const repository: AppointmentSyncRepository & { committed?: AppointmentSyncCommit } = {
    acquire: vi.fn(async () => ({ ok: true as const, checkpoint: {
      integrationId: crypto.randomUUID(), initialImportCompleted, confirmedChangeCursor,
    } })),
    commit: vi.fn(async input => { repository.committed = input; return { ok: true as const } }),
    recordFailure: vi.fn(async () => true),
    close: vi.fn(async () => undefined),
  }
  return repository
}

describe('appointment synchronization over the real Mock-PVS HTTP contract', () => {
  it('imports the complete paged baseline with only approved fields', async () => {
    const repository = captureRepository()
    expect(await runAppointmentSync(new MockPvsAdapter({ baseUrl, readToken }), repository))
      .toEqual({ ok: true })
    expect(repository.committed?.snapshot.length).toBeGreaterThan(1)
    expect(repository.committed?.snapshot.every(item => item.patientSourceId.startsWith('mock-patient-')))
      .toBe(true)
    expect(repository.committed?.snapshot.every(item => Object.keys(item).length === 9)).toBe(true)
  })

  it('projects appointment changes while consuming patient positions', async () => {
    await activate('changes')
    const repository = captureRepository()
    expect(await runAppointmentSync(new MockPvsAdapter({ baseUrl, readToken }), repository))
      .toEqual({ ok: true })
    expect(repository.committed?.mutations.some(item =>
      item.operation === 'upsert' && item.appointment.sourceVersion === 2)).toBe(true)
    expect(repository.committed?.candidateCursor).toBeTruthy()
  })

  it('returns a neutral failure for invalid source data without a commit', async () => {
    await activate('invalid-source-data')
    const repository = captureRepository()
    expect(await runAppointmentSync(new MockPvsAdapter({ baseUrl, readToken }), repository))
      .toEqual({ ok: false, code: 'source_contract_invalid' })
    expect(repository.committed).toBeUndefined()
  })

  it('projects resource-free appointment deletions', async () => {
    await activate('deletions')
    const repository = captureRepository()
    expect(await runAppointmentSync(new MockPvsAdapter({ baseUrl, readToken }), repository))
      .toEqual({ ok: true })
    expect(repository.committed?.mutations.some(item => item.operation === 'delete')).toBe(true)
  })

  it.each([
    ['rate-limited', 'rate_limited'],
    ['temporarily-unavailable', 'temporarily_unavailable'],
  ])('maps %s without a commit', async (scenario, code) => {
    await activate(scenario)
    const repository = captureRepository()
    expect(await runAppointmentSync(new MockPvsAdapter({ baseUrl, readToken }), repository))
      .toEqual({ ok: false, code })
    expect(repository.committed).toBeUndefined()
  })

  it('rejects an opaque cursor invalidated by a scenario reset', async () => {
    await activate('changes')
    const first = captureRepository()
    expect(await runAppointmentSync(new MockPvsAdapter({ baseUrl, readToken }), first))
      .toEqual({ ok: true })
    const confirmed = first.committed?.candidateCursor
    expect(confirmed).toBeTruthy()
    await activate('baseline')
    const resumed = captureRepository(true, confirmed ?? null)
    expect(await runAppointmentSync(new MockPvsAdapter({ baseUrl, readToken }), resumed))
      .toEqual({ ok: false, code: 'source_protocol_invalid' })
    expect(resumed.committed).toBeUndefined()
  })
})
