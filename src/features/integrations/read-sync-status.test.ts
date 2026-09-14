import { expect, it, vi } from 'vitest'
import type { ActorContext } from '../authorization/policy'
import { readIntegrationSyncStatus } from './read-sync-status'

const actor: ActorContext = { kind: 'practice_member', userId: 'synthetic-admin', practiceId: 'synthetic-practice', role: 'praxisadmin' }
const row = { integration_id: '33000000-0000-4000-8000-000000000001', provider: 'mock_pvs', status: 'idle', last_attempt_at: null, last_success_at: null, next_attempt_at: null, last_error_code: null }
it('maps exactly one cursor-free row through an argument-free RPC', async () => {
  const client = { rpc: vi.fn().mockResolvedValue({ data: [row], error: null }) }
  expect(await readIntegrationSyncStatus(client, actor)).toEqual({ integrationId: row.integration_id, provider: row.provider, status: row.status, lastAttemptAt: null, lastSuccessAt: null, nextAttemptAt: null, lastErrorCode: null })
  expect(client.rpc).toHaveBeenCalledWith('read_integration_sync_status', {})
})
it.each<ActorContext>([{ ...actor, role: 'rezeption' }, { ...actor, role: 'behandler' }, { kind: 'portal_admin', userId: 'synthetic-portal' }])('skips the RPC for disallowed actors', async disallowed => {
  const client = { rpc: vi.fn() }
  expect(await readIntegrationSyncStatus(client, disallowed)).toBeNull()
  expect(client.rpc).not.toHaveBeenCalled()
})
it.each([[], [row, row], [{ ...row, provider: 'unknown' }], [{ ...row, last_error_code: 'raw error' }], [{ ...row, confirmed_change_cursor: 'excluded' }], [{ ...row, practice_id: 'excluded' }], [{ ...row, last_attempt_at: 'yesterday' }], [{ ...row, integration_id: 'bad' }]].map(data => ({ data })))('rejects malformed or excessive RPC rows', async ({ data }) => {
  expect(await readIntegrationSyncStatus({ rpc: vi.fn().mockResolvedValue({ data, error: null }) }, actor)).toBeNull()
})
it('handles database errors and rejected promises neutrally', async () => {
  expect(await readIntegrationSyncStatus({ rpc: vi.fn().mockResolvedValue({ data: [row], error: { message: 'excluded' } }) }, actor)).toBeNull()
  expect(await readIntegrationSyncStatus({ rpc: vi.fn().mockRejectedValue(new Error('excluded')) }, actor)).toBeNull()
})
