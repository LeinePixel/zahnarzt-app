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
    const competitor = new PostgresPatientSyncRepository(fixture.runtimeUrl)
    expect(await competitor.acquire(new AbortController().signal)).toEqual({ ok: false, code: 'sync_busy' })
    await competitor.close()
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

  it('rejects null batches and non-ISO source values without advancing state', async () => {
    const fixture = await createLocalDatabaseFixture(); fixtures.push(fixture)
    const client = new (await import('pg')).Client({ connectionString: fixture.runtimeUrl })
    await client.connect()
    const acquired = await client.query('select private.acquire_patient_sync() as result')
    expect(acquired.rows[0].result.ok).toBe(true)
    const nullBatch = await client.query('select private.commit_patient_sync(null,false,null,null,null) as result')
    expect(nullBatch.rows[0].result).toEqual({ ok: false, code: 'source_contract_invalid' })
    const invalidDate = await client.query(`select private.commit_patient_sync(null,false,'[]'::jsonb,$1::jsonb,null) as result`, [JSON.stringify([{
      operation: 'upsert', patient: { sourceId: 'synthetic-invalid', sourceVersion: 1, firstName: 'Synthetic', lastName: 'Invalid', birthDate: 'infinity', phoneE164: '+491234567', sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z' },
    }])])
    expect(invalidDate.rows[0].result).toEqual({ ok: false, code: 'source_contract_invalid' })
    const checkpoint = await fixture.admin.query('select initial_import_completed,confirmed_change_cursor from private.patient_sync_checkpoint where integration_id=$1', [fixture.integrationId])
    expect(checkpoint.rows[0]).toEqual({ initial_import_completed: false, confirmed_change_cursor: null })
    await client.end()
  })

  it('denies commit after the executor mapping is revoked during source I/O', async () => {
    const fixture = await createLocalDatabaseFixture(); fixtures.push(fixture)
    const client = new (await import('pg')).Client({ connectionString: fixture.runtimeUrl })
    await client.connect()
    expect((await client.query('select private.acquire_patient_sync() as result')).rows[0].result.ok).toBe(true)
    await fixture.admin.query('delete from private.patient_sync_executor where integration_id=$1', [fixture.integrationId])
    const committed = await client.query("select private.commit_patient_sync(null,false,'[]'::jsonb,'[]'::jsonb,null) as result")
    expect(committed.rows[0].result).toEqual({ ok: false, code: 'execution_denied' })
    await client.end()
  })

  it('retains delete versions and ignores an older restoring upsert', async () => {
    const fixture = await createLocalDatabaseFixture(); fixtures.push(fixture)
    const initial = new PostgresPatientSyncRepository(fixture.runtimeUrl)
    const acquired = await initial.acquire(new AbortController().signal)
    if (!acquired.ok) throw new Error('Expected acquisition')
    const patient = { sourceId: 'synthetic-delete', sourceVersion: 2, firstName: 'Synthetic', lastName: 'Delete', birthDate: '2000-01-01', phoneE164: '+491234567', sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z' }
    expect(await initial.commit({ expected: acquired.checkpoint, snapshot: [patient], mutations: [], candidateCursor: 'one' }, new AbortController().signal)).toEqual({ ok: true })
    await initial.close()
    const deletion = new PostgresPatientSyncRepository(fixture.runtimeUrl)
    const next = await deletion.acquire(new AbortController().signal)
    if (!next.ok) throw new Error('Expected acquisition')
    expect(await deletion.commit({ expected: next.checkpoint, snapshot: [], mutations: [{ operation: 'delete', sourceId: patient.sourceId, sourceVersion: 3 }], candidateCursor: 'two' }, new AbortController().signal)).toEqual({ ok: true })
    await deletion.close()
    const old = new PostgresPatientSyncRepository(fixture.runtimeUrl)
    const afterDelete = await old.acquire(new AbortController().signal)
    if (!afterDelete.ok) throw new Error('Expected acquisition')
    expect(await old.commit({ expected: afterDelete.checkpoint, snapshot: [], mutations: [{ operation: 'upsert', patient }], candidateCursor: 'three' }, new AbortController().signal)).toEqual({ ok: true })
    await old.close()
    expect((await fixture.admin.query('select count(*)::int as count from public.patient where integration_id=$1', [fixture.integrationId])).rows[0].count).toBe(0)
    expect((await fixture.admin.query('select source_version,is_deleted from private.patient_source_version where integration_id=$1 and source_id=$2', [fixture.integrationId, patient.sourceId])).rows[0]).toEqual({ source_version: 3, is_deleted: true })
  })
})
