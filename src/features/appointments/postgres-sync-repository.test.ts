// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { PostgresAppointmentSyncRepository } from './postgres-sync-repository'

it('constructs a dedicated postgres repository without opening I/O', () => {
  const repository = new PostgresAppointmentSyncRepository(
    'postgresql://dentpilot_appointment_sync_test:secret@127.0.0.1:54322/postgres',
  )
  expect(repository).toBeInstanceOf(PostgresAppointmentSyncRepository)
})

function fakeClient(results: unknown[]) {
  return {
    connect: vi.fn(async () => undefined),
    query: vi.fn(async (_text: string, _values?: unknown[]) => {
      void _text
      void _values
      return results.shift() as { rows: Record<string, unknown>[] } ?? { rows: [] }
    }),
    end: vi.fn(async () => undefined),
  }
}

const checkpoint = {
  integrationId: '33000000-0000-4000-8000-000000000001',
  initialImportCompleted: true,
  confirmedChangeCursor: 'before',
}

describe('postgres appointment sync transaction', () => {
  it('acquires, commits with bound JSON and unlocks the same integration', async () => {
    const client = fakeClient([
      { rows: [{ result: { ok: true, checkpoint } }] },
      { rows: [] },
      { rows: [{ result: { ok: true } }] },
      { rows: [] },
      { rows: [] },
    ])
    const repository = new PostgresAppointmentSyncRepository('unused', { client })
    expect(await repository.acquire(new AbortController().signal)).toEqual({ ok: true, checkpoint })
    expect(await repository.commit({
      expected: checkpoint, snapshot: [], mutations: [], candidateCursor: 'after',
    }, new AbortController().signal)).toEqual({ ok: true })
    expect(client.query.mock.calls[2]).toEqual([
      'select private.commit_appointment_sync($1::text,$2::boolean,$3::jsonb,$4::jsonb,$5::text) as result',
      ['before', true, '[]', '[]', 'after'],
    ])
    await repository.close()
    expect(client.query.mock.calls[4]).toEqual([
      'select pg_catalog.pg_advisory_unlock(20260914,pg_catalog.hashtext($1::text))',
      [checkpoint.integrationId],
    ])
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('rolls back a neutral SQL refusal', async () => {
    const client = fakeClient([
      { rows: [{ result: { ok: true, checkpoint } }] },
      { rows: [] },
      { rows: [{ result: { ok: false, code: 'source_contract_invalid' } }] },
      { rows: [] },
    ])
    const repository = new PostgresAppointmentSyncRepository('unused', { client })
    await repository.acquire(new AbortController().signal)
    expect(await repository.commit({
      expected: checkpoint, snapshot: [], mutations: [], candidateCursor: null,
    }, new AbortController().signal)).toEqual({ ok: false, code: 'source_contract_invalid' })
    expect(client.query.mock.calls[3][0]).toBe('rollback')
  })

  it('rolls back when the SQL call throws', async () => {
    const client = fakeClient([{ rows: [{ result: { ok: true, checkpoint } }] }])
    const repository = new PostgresAppointmentSyncRepository('unused', { client })
    await repository.acquire(new AbortController().signal)
    client.query.mockResolvedValueOnce({ rows: [] })
    client.query.mockRejectedValueOnce(new Error('sensitive SQL detail'))
    client.query.mockResolvedValueOnce({ rows: [] })
    expect(await repository.commit({
      expected: checkpoint, snapshot: [], mutations: [], candidateCursor: null,
    }, new AbortController().signal)).toEqual({ ok: false, code: 'persistence_unavailable' })
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('rollback')
  })

  it('rejects a commit for a different acquired integration before SQL', async () => {
    const client = fakeClient([{ rows: [{ result: { ok: true, checkpoint } }] }])
    const repository = new PostgresAppointmentSyncRepository('unused', { client })
    await repository.acquire(new AbortController().signal)
    expect(await repository.commit({
      expected: { ...checkpoint, integrationId: crypto.randomUUID() },
      snapshot: [], mutations: [], candidateCursor: null,
    }, new AbortController().signal)).toEqual({ ok: false, code: 'execution_denied' })
    expect(client.query).toHaveBeenCalledTimes(1)
  })

  it('records a provider failure through only the appointment entry point', async () => {
    const client = fakeClient([
      { rows: [{ result: { ok: true, checkpoint } }] },
      { rows: [{ recorded: true }] },
    ])
    const repository = new PostgresAppointmentSyncRepository('unused', { client })
    await repository.acquire(new AbortController().signal)
    expect(await repository.recordFailure({
      code: 'rate_limited', retryAt: new Date('2026-10-02T08:00:00Z'),
    }, new AbortController().signal)).toBe(true)
    expect(client.query.mock.calls[1][0]).toContain('private.record_appointment_sync_failure')
  })

  it('physically ends a connection when acquisition is aborted', async () => {
    const client = fakeClient([])
    client.connect.mockImplementation(async () => await new Promise<never>(() => undefined))
    const repository = new PostgresAppointmentSyncRepository('unused', { client })
    const controller = new AbortController()
    const acquisition = repository.acquire(controller.signal)
    controller.abort()
    await expect(acquisition).resolves.toEqual({ ok: false, code: 'persistence_unavailable' })
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('closes without opening or unlocking when it was never connected', async () => {
    const client = fakeClient([])
    const repository = new PostgresAppointmentSyncRepository('unused', { client })
    await repository.close()
    expect(client.connect).not.toHaveBeenCalled()
    expect(client.query).not.toHaveBeenCalled()
    expect(client.end).not.toHaveBeenCalled()
  })
})
