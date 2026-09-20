import type {
  IntegrationAdapter,
  IntegrationFailureCode,
  Page,
  SourceChangeEvent,
  SourcePatient,
} from '@/features/integrations/adapter'
import { PatientProjectionError, projectPatient, projectPatientChange } from './source-projection'
import type { PatientMutation, PatientProjection } from './source-projection'
import type { PatientSyncRepository, PatientSyncResult } from './sync-repository'

const PAGE_LIMIT = 100
const MAX_PAGES = 100
const MAX_BATCH_BYTES = 10 * 1024 * 1024
const RUN_DEADLINE_MS = 60_000
const COMMIT_RESERVE_MS = 5_000

class SourceProtocolError extends Error {}

function assertPage<T>(page: Page<T> | undefined): asserts page is Page<T> {
  if (!page || !Array.isArray(page.data)) throw new SourceProtocolError()
  if (page.nextCursor !== null && (
    typeof page.nextCursor !== 'string'
    || page.nextCursor.length < 1
    || page.nextCursor.length > 128
  )) throw new SourceProtocolError()
}

async function safelyRecordFailure(
  repository: PatientSyncRepository,
  code: IntegrationFailureCode,
  retryAt: Date | null,
  signal: AbortSignal,
): Promise<void> {
  try { await repository.recordFailure({ code, retryAt }, signal) } catch { /* neutral result remains authoritative */ }
}

export async function runPatientSync(
  adapter: IntegrationAdapter,
  repository: PatientSyncRepository,
  dependencies: { now?: () => number; signal?: AbortSignal } = {},
): Promise<PatientSyncResult> {
  const now = dependencies.now ?? Date.now
  const startedAt = now()
  const timeout = AbortSignal.timeout(RUN_DEADLINE_MS)
  const signal = dependencies.signal ? AbortSignal.any([timeout, dependencies.signal]) : timeout
  let result: PatientSyncResult = { ok: false, code: 'persistence_unavailable' }

  try {
    const acquired = await repository.acquire(signal)
    if (!acquired.ok) return acquired

    const health = await adapter.checkHealth()
    if (!health.ok) {
      await safelyRecordFailure(repository, health.error.code, health.error.retryAt, signal)
      return { ok: false, code: health.error.code }
    }

    const snapshot: PatientProjection[] = []
    const mutations: PatientMutation[] = []
    let candidateCursor = acquired.checkpoint.confirmedChangeCursor
    let pageCount = 0
    let projectedBytes = Buffer.byteLength(JSON.stringify({ expected: acquired.checkpoint, snapshot: [], mutations: [], candidateCursor }), 'utf8')
    const addProjectedBytes = (value: unknown) => {
      projectedBytes += Buffer.byteLength(JSON.stringify(value), 'utf8') + 1
      if (projectedBytes > MAX_BATCH_BYTES) throw new SourceProtocolError()
    }

    const requestPage = async <T>(request: () => Promise<{ ok: true; value: Page<T> } | { ok: false; error: { code: IntegrationFailureCode; retryAt: Date | null } }>) => {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (pageCount >= MAX_PAGES) throw new SourceProtocolError()
      pageCount += 1
      const response = await request()
      if (!response.ok) {
        await safelyRecordFailure(repository, response.error.code, response.error.retryAt, signal)
        result = { ok: false, code: response.error.code }
        return null
      }
      assertPage(response.value)
      if (response.value.data.length === 0 && response.value.nextCursor !== null) throw new SourceProtocolError()
      return response.value
    }

    if (!acquired.checkpoint.initialImportCompleted) {
      let cursor: string | undefined
      const visited = new Set<string>(['<start>'])
      do {
        const page = await requestPage<SourcePatient>(() => adapter.listPatients({ cursor, limit: PAGE_LIMIT }))
        if (!page) return result
        for (const source of page.data) {
          const projected = projectPatient(source)
          addProjectedBytes(projected)
          snapshot.push(projected)
        }
        if (page.nextCursor === null) break
        if (visited.has(page.nextCursor)) throw new SourceProtocolError()
        visited.add(page.nextCursor)
        cursor = page.nextCursor
      } while (true)
    }

    let changeCursor = acquired.checkpoint.confirmedChangeCursor ?? undefined
    const visitedChanges = new Set<string>([changeCursor ?? '<start>'])
    do {
      const page = await requestPage<SourceChangeEvent>(() => adapter.listChanges({ cursor: changeCursor, limit: PAGE_LIMIT }))
      if (!page) return result
      for (const event of page.data) {
        const mutation = projectPatientChange(event)
        if (mutation) { addProjectedBytes(mutation); mutations.push(mutation) }
        candidateCursor = event.cursor
      }
      if (page.nextCursor === null) break
      if (visitedChanges.has(page.nextCursor)) throw new SourceProtocolError()
      visitedChanges.add(page.nextCursor)
      changeCursor = page.nextCursor
    } while (true)

    const batchBytes = Buffer.byteLength(JSON.stringify({
      expected: acquired.checkpoint,
      snapshot,
      mutations,
      candidateCursor,
    }), 'utf8')
    if (batchBytes > MAX_BATCH_BYTES) throw new SourceProtocolError()
    if (signal.aborted || now() - startedAt > RUN_DEADLINE_MS - COMMIT_RESERVE_MS) {
      await safelyRecordFailure(repository, 'network_unavailable', null, signal)
      return { ok: false, code: 'network_unavailable' }
    }

    result = await repository.commit({
      expected: acquired.checkpoint,
      snapshot,
      mutations,
      candidateCursor,
    }, signal)
    return result
  } catch (error) {
    const code: IntegrationFailureCode = error instanceof PatientProjectionError
      ? 'source_contract_invalid'
      : error instanceof SourceProtocolError
        ? 'source_protocol_invalid'
        : 'network_unavailable'
    await safelyRecordFailure(repository, code, null, signal)
    return { ok: false, code }
  } finally {
    try { await repository.close() } catch { /* callers receive the closed operation result */ }
  }
}
