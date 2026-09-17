import type { IntegrationFailureCode } from '@/features/integrations/adapter'
import type { AppointmentMutation, AppointmentProjection } from './source-projection'

export type AppointmentCheckpoint = {
  integrationId: string
  initialImportCompleted: boolean
  confirmedChangeCursor: string | null
}

export type AppointmentSyncFailure = IntegrationFailureCode | 'execution_denied' | 'persistence_unavailable'
export type AppointmentSyncResult =
  | { ok: true }
  | { ok: false; code: AppointmentSyncFailure | 'sync_busy' | 'retry_not_due' }
export type AppointmentSyncAcquisition =
  | { ok: true; checkpoint: AppointmentCheckpoint }
  | { ok: false; code: 'sync_busy' | 'retry_not_due' | 'execution_denied' | 'persistence_unavailable' }
export type AppointmentSyncCommit = {
  expected: AppointmentCheckpoint
  snapshot: AppointmentProjection[]
  mutations: AppointmentMutation[]
  candidateCursor: string | null
}

export interface AppointmentSyncRepository {
  acquire(signal: AbortSignal): Promise<AppointmentSyncAcquisition>
  commit(input: AppointmentSyncCommit, signal: AbortSignal): Promise<AppointmentSyncResult>
  recordFailure(
    input: { code: IntegrationFailureCode; retryAt: Date | null },
    signal: AbortSignal,
  ): Promise<boolean>
  close(): Promise<void>
}
