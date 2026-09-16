// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createLocalDatabaseFixture } from './test/local-database'
import { PostgresPatientSyncRepository } from './postgres-sync-repository'

const fixtures: Awaited<ReturnType<typeof createLocalDatabaseFixture>>[] = []
afterEach(async () => { while (fixtures.length) await fixtures.pop()?.close() })

describe('restricted postgres LOGIN repository', () => {
  it('acquires and atomically commits through only the private entrypoints', async () => {
    const fixture = await createLocalDatabaseFixture(); fixtures.push(fixture)
    const repository = new PostgresPatientSyncRepository(fixture.runtimeUrl)
    const acquired = await repository.acquire(new AbortController().signal)
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    expect(await repository.commit({
      expected: acquired.checkpoint,
      snapshot: [{ sourceId: 'synthetic-1', sourceVersion: 1, firstName: 'Synthetic', lastName: 'Patient', birthDate: '2000-01-01', phoneE164: '+491234567', sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z' }],
      mutations: [], candidateCursor: 'cursor-1',
    }, new AbortController().signal)).toEqual({ ok: true })
    await repository.close()
    const observed = await fixture.admin.query('select source_id from public.patient where integration_id=$1', [fixture.integrationId])
    expect(observed.rows.map(row => row.source_id)).toEqual(['synthetic-1'])
  })

  it('cannot directly select the patient table', async () => {
    const fixture = await createLocalDatabaseFixture(); fixtures.push(fixture)
    const client = new (await import('pg')).Client({ connectionString: fixture.runtimeUrl })
    await client.connect()
    await expect(client.query('select * from public.patient')).rejects.toMatchObject({ code: '42501' })
    await client.end()
  })
})
