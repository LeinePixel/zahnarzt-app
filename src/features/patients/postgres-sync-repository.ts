import 'server-only'

import { Client } from 'pg'
import { z } from 'zod'
import type { IntegrationFailureCode } from '@/features/integrations/adapter'
import type {
  PatientCheckpoint,
  PatientSyncAcquisition,
  PatientSyncCommit,
  PatientSyncRepository,
  PatientSyncResult,
} from './sync-repository'

const checkpointSchema = z.strictObject({
  integrationId: z.uuid(),
  initialImportCompleted: z.boolean(),
  confirmedChangeCursor: z.string().min(1).max(128).nullable(),
})
const acquisitionSchema = z.union([
  z.strictObject({ ok: z.literal(true), checkpoint: checkpointSchema }),
  z.strictObject({ ok: z.literal(false), code: z.enum(['sync_busy', 'retry_not_due', 'execution_denied', 'persistence_unavailable']) }),
])
const resultSchema = z.union([
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), code: z.enum([
    'configuration_invalid', 'network_unavailable', 'rate_limited', 'temporarily_unavailable',
    'source_protocol_invalid', 'source_contract_invalid', 'execution_denied', 'persistence_unavailable',
    'sync_busy', 'retry_not_due',
  ]) }),
])

type QueryClient = {
  connect(): Promise<unknown>
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  end(): Promise<unknown>
}

export class PostgresPatientSyncRepository implements PatientSyncRepository {
  private readonly client: QueryClient
  private connected = false
  private closed = false
  private acquired?: PatientCheckpoint

  constructor(databaseUrl: string, dependencies: { client?: QueryClient } = {}) {
    this.client = dependencies.client ?? new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    }) as unknown as QueryClient
  }

  private async ensureConnected(signal: AbortSignal): Promise<void> {
    if (this.closed) throw new Error('closed')
    if (!this.connected) {
      if (signal.aborted) throw new Error('aborted')
      await this.client.connect()
      this.connected = true
    }
  }

  async acquire(signal: AbortSignal): Promise<PatientSyncAcquisition> {
    try {
      await this.ensureConnected(signal)
      const response = await this.client.query('select private.acquire_patient_sync() as result')
      const result = acquisitionSchema.parse(response.rows[0]?.result)
      if (result.ok) this.acquired = result.checkpoint
      return result
    } catch {
      return { ok: false, code: 'persistence_unavailable' }
    }
  }

  async commit(input: PatientSyncCommit, signal: AbortSignal): Promise<PatientSyncResult> {
    if (!this.acquired || input.expected.integrationId !== this.acquired.integrationId) {
      return { ok: false, code: 'execution_denied' }
    }
    let transactionStarted = false
    try {
      await this.ensureConnected(signal)
      await this.client.query('begin')
      transactionStarted = true
      const response = await this.client.query(
        'select private.commit_patient_sync($1::text,$2::boolean,$3::jsonb,$4::jsonb,$5::text) as result',
        [input.expected.confirmedChangeCursor, input.expected.initialImportCompleted,
          JSON.stringify(input.snapshot), JSON.stringify(input.mutations), input.candidateCursor],
      )
      const result = resultSchema.parse(response.rows[0]?.result)
      if (!result.ok) {
        await this.client.query('rollback')
        return result
      }
      await this.client.query('commit')
      return result
    } catch {
      if (transactionStarted) {
        try { await this.client.query('rollback') } catch { /* outcome may be uncertain after COMMIT I/O failure */ }
      }
      return { ok: false, code: 'persistence_unavailable' }
    }
  }

  async recordFailure(
    input: { code: IntegrationFailureCode; retryAt: Date | null },
    signal: AbortSignal,
  ): Promise<boolean> {
    try {
      await this.ensureConnected(signal)
      const response = await this.client.query(
        'select private.record_patient_sync_failure($1::public.integration_sync_error_code,$2::timestamptz) as recorded',
        [input.code, input.retryAt],
      )
      return response.rows[0]?.recorded === true
    } catch { return false }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    if (!this.connected) return
    try {
      if (this.acquired) {
        await this.client.query(
          'select pg_catalog.pg_advisory_unlock(20260914,pg_catalog.hashtext($1::text))',
          [this.acquired.integrationId],
        )
      }
    } finally {
      await this.client.end()
      this.connected = false
    }
  }
}
