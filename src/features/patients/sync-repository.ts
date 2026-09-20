import type { IntegrationFailureCode } from '@/features/integrations/adapter'
import type { PatientMutation, PatientProjection } from './source-projection'

export type PatientCheckpoint = {
  integrationId: string
  initialImportCompleted: boolean
  confirmedChangeCursor: string | null
}

export type PatientSyncFailure = IntegrationFailureCode | 'execution_denied' | 'persistence_unavailable'
export type PatientSyncResult =
  | { ok: true }
  | { ok: false; code: PatientSyncFailure | 'sync_busy' | 'retry_not_due' }
export type PatientSyncAcquisition =
  | { ok: true; checkpoint: PatientCheckpoint }
  | { ok: false; code: 'sync_busy' | 'retry_not_due' | 'execution_denied' | 'persistence_unavailable' }
export type PatientSyncCommit = {
  expected: PatientCheckpoint
  snapshot: PatientProjection[]
  mutations: PatientMutation[]
  candidateCursor: string | null
}

export interface PatientSyncRepository {
  acquire(signal: AbortSignal): Promise<PatientSyncAcquisition>
  commit(input: PatientSyncCommit, signal: AbortSignal): Promise<PatientSyncResult>
  recordFailure(
    input: { code: IntegrationFailureCode; retryAt: Date | null },
    signal: AbortSignal,
  ): Promise<boolean>
  close(): Promise<void>
}
