// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { PostgresPatientSyncRepository } from './postgres-sync-repository'

it('constructs a dedicated postgres repository without opening I/O', () => {
  const repository = new PostgresPatientSyncRepository('postgresql://dentpilot_sync_test:secret@127.0.0.1:54322/postgres')
  expect(repository).toBeInstanceOf(PostgresPatientSyncRepository)
})

function fakeClient(results: unknown[]) {
  return {
    connect: vi.fn(async () => undefined),
    query: vi.fn(async (_text: string, _values?: unknown[]) => {
      void _text; void _values
      return results.shift() as { rows: Record<string, unknown>[] } ?? { rows: [] }
    }),
    end: vi.fn(async () => undefined),
  }
}

describe('postgres patient sync transaction', () => {
  it('acquires, commits with bound JSON and unlocks the same integration', async () => {
    const checkpoint = { integrationId: '33000000-0000-4000-8000-000000000001', initialImportCompleted: true, confirmedChangeCursor: 'before' }
    const client = fakeClient([
      { rows: [{ result: { ok: true, checkpoint } }] },
      { rows: [] },
      { rows: [{ result: { ok: true } }] },
      { rows: [] },
      { rows: [] },
    ])
    const repository = new PostgresPatientSyncRepository('unused', { client })
    expect(await repository.acquire(new AbortController().signal)).toEqual({ ok: true, checkpoint })
    expect(await repository.commit({ expected: checkpoint, snapshot: [], mutations: [], candidateCursor: 'after' }, new AbortController().signal)).toEqual({ ok: true })
    const commitCall = client.query.mock.calls[2]
    expect(commitCall[0]).toContain('private.commit_patient_sync')
    expect(commitCall[1]).toEqual(['before', true, '[]', '[]', 'after'])
    await repository.close()
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('rolls back a neutral SQL refusal', async () => {
    const checkpoint = { integrationId: '33000000-0000-4000-8000-000000000001', initialImportCompleted: true, confirmedChangeCursor: null }
    const client = fakeClient([
      { rows: [{ result: { ok: true, checkpoint } }] },
      { rows: [] },
      { rows: [{ result: { ok: false, code: 'source_contract_invalid' } }] },
      { rows: [] },
    ])
    const repository = new PostgresPatientSyncRepository('unused', { client })
    await repository.acquire(new AbortController().signal)
    expect(await repository.commit({ expected: checkpoint, snapshot: [], mutations: [], candidateCursor: null }, new AbortController().signal)).toEqual({ ok: false, code: 'source_contract_invalid' })
    expect(client.query.mock.calls[3][0]).toBe('rollback')
  })

  it('rejects a commit for a different acquired integration before SQL', async () => {
    const checkpoint = { integrationId: '33000000-0000-4000-8000-000000000001', initialImportCompleted: true, confirmedChangeCursor: null }
    const client = fakeClient([{ rows: [{ result: { ok: true, checkpoint } }] }])
    const repository = new PostgresPatientSyncRepository('unused', { client })
    await repository.acquire(new AbortController().signal)
    expect(await repository.commit({ expected: { ...checkpoint, integrationId: crypto.randomUUID() }, snapshot: [], mutations: [], candidateCursor: null }, new AbortController().signal)).toEqual({ ok: false, code: 'execution_denied' })
    expect(client.query).toHaveBeenCalledTimes(1)
  })
})
