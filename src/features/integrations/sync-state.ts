import type { IntegrationFailureCode } from './adapter'

export type IntegrationSyncStatus = {
  integrationId: string
  provider: 'mock_pvs'
  status: 'idle' | 'healthy' | 'retry_scheduled' | 'failed'
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  nextAttemptAt: string | null
  lastErrorCode: IntegrationFailureCode | null
}
export type IntegrationSyncResult = { integrationId: string; outcome: 'succeeded' | 'failed'; errorCode: IntegrationFailureCode | null; retryAt: string | null }
export interface IntegrationSyncStateRepository {
  recordResult(input: IntegrationSyncResult): Promise<void>
  confirmChangeCursor(input: { integrationId: string; cursor: string }): Promise<void>
}
