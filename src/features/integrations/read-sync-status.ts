import 'server-only'
import { z } from 'zod'
import { mayUseCapability, type ActorContext } from '../authorization/policy'
import { timestampSchema } from './contracts'
import type { IntegrationSyncStatus } from './sync-state'

const integrationSyncStatusSchema = z.array(z.strictObject({
  integration_id: z.uuid(),
  provider: z.literal('mock_pvs'),
  status: z.enum(['idle', 'healthy', 'retry_scheduled', 'failed']),
  last_attempt_at: timestampSchema.nullable(),
  last_success_at: timestampSchema.nullable(),
  next_attempt_at: timestampSchema.nullable(),
  last_error_code: z.enum(['configuration_invalid', 'network_unavailable', 'rate_limited', 'temporarily_unavailable', 'source_protocol_invalid', 'source_contract_invalid']).nullable(),
})).length(1)
export type IntegrationStatusRpcClient = {
  rpc(name: string, parameters: Record<string, never>): PromiseLike<{ data: unknown; error: unknown }>
}
export async function readIntegrationSyncStatus(client: IntegrationStatusRpcClient, actor: ActorContext): Promise<IntegrationSyncStatus | null> {
  try {
    if (!mayUseCapability(actor, 'integration.status.read')) return null
    const { data, error } = await client.rpc('read_integration_sync_status', {})
    const parsed = integrationSyncStatusSchema.safeParse(data)
    if (error || !parsed.success) return null
    const row = parsed.data[0]
    return { integrationId: row.integration_id, provider: row.provider, status: row.status, lastAttemptAt: row.last_attempt_at, lastSuccessAt: row.last_success_at, nextAttemptAt: row.next_attempt_at, lastErrorCode: row.last_error_code }
  } catch { return null }
}
