// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { IntegrationAdapter, Page, SourceChangeEvent, SourcePatient } from '@/features/integrations/adapter'
import type { PatientSyncCommit, PatientSyncRepository } from './sync-repository'
import { runPatientSync } from './sync-patients'

const patient: SourcePatient = {
  id: 'patient-1', version: 1, firstName: 'Synthetic', lastName: 'Fixture',
  birthDate: '2000-01-01', email: 'excluded@example.invalid', phoneE164: '+491234567',
  sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
}
const patientEvent: SourceChangeEvent = {
  eventId: 'event-1', cursor: 'event-cursor', occurredAt: patient.sourceUpdatedAt,
  entityType: 'patient', operation: 'upsert', entityId: patient.id, version: 1, resource: patient,
}
const appointmentDelete: SourceChangeEvent = {
  eventId: 'event-2', cursor: 'appointment-cursor', occurredAt: patient.sourceUpdatedAt,
  entityType: 'appointment', operation: 'delete', entityId: 'appointment-1', version: 1,
}

function repository(initialImportCompleted = false, cursor: string | null = null) {
  const commits: PatientSyncCommit[] = []
  const failures: string[] = []
  const value: PatientSyncRepository & { commits: PatientSyncCommit[]; failures: string[] } = {
    commits, failures,
    acquire: vi.fn(async () => ({ ok: true as const, checkpoint: { integrationId: '33000000-0000-4000-8000-000000000001', initialImportCompleted, confirmedChangeCursor: cursor } })),
    commit: vi.fn(async input => { commits.push(input); return { ok: true as const } }),
    recordFailure: vi.fn(async input => { failures.push(input.code); return true }),
    close: vi.fn(async () => undefined),
  }
  return value
}

function adapter(patientPages: Page<SourcePatient>[], changePages: Page<SourceChangeEvent>[]): IntegrationAdapter {
  let patientIndex = 0; let changeIndex = 0
  return {
    checkHealth: vi.fn(async () => ({ ok: true as const, value: undefined })),
    listPatients: vi.fn(async () => ({ ok: true as const, value: patientPages[patientIndex++] })),
    listChanges: vi.fn(async () => ({ ok: true as const, value: changePages[changeIndex++] })),
    listAppointments: vi.fn(async () => ({ ok: true as const, value: { data: [], nextCursor: null } })),
  }
}

describe('bounded patient synchronization', () => {
  it('collects initial patients and advances through the last appointment event', async () => {
    const repo = repository()
    const source = adapter([{ data: [patient], nextCursor: null }], [{ data: [patientEvent, appointmentDelete], nextCursor: null }])
    expect(await runPatientSync(source, repo)).toEqual({ ok: true })
    expect(repo.commits).toHaveLength(1)
    expect(repo.commits[0].candidateCursor).toBe('appointment-cursor')
    expect(repo.commits[0].snapshot[0]).not.toHaveProperty('email')
    expect(repo.commits[0].mutations).toHaveLength(1)
  })

  it('uses only changes after initial import', async () => {
    const repo = repository(true, 'previous')
    const source = adapter([], [{ data: [], nextCursor: null }])
    expect(await runPatientSync(source, repo)).toEqual({ ok: true })
    expect(source.listPatients).not.toHaveBeenCalled()
    expect(source.listChanges).toHaveBeenCalledWith({ cursor: 'previous', limit: 100 })
    expect(repo.commits[0].candidateCursor).toBe('previous')
  })

  it('stops before source access when acquisition is refused and still closes', async () => {
    const repo = repository()
    vi.mocked(repo.acquire).mockResolvedValue({ ok: false, code: 'sync_busy' })
    const source = adapter([], [])
    expect(await runPatientSync(source, repo)).toEqual({ ok: false, code: 'sync_busy' })
    expect(source.listPatients).not.toHaveBeenCalled()
    expect(repo.close).toHaveBeenCalledOnce()
  })

  it('records a later-page provider failure without committing', async () => {
    const repo = repository()
    const source = adapter([{ data: [patient], nextCursor: 'next' }], [])
    vi.mocked(source.listPatients).mockResolvedValueOnce({ ok: true, value: { data: [patient], nextCursor: 'next' } }).mockResolvedValueOnce({ ok: false, error: { code: 'rate_limited', retryAt: null } })
    expect(await runPatientSync(source, repo)).toEqual({ ok: false, code: 'rate_limited' })
    expect(repo.failures).toEqual(['rate_limited'])
    expect(repo.commits).toHaveLength(0)
  })

  it('stops after a failing health check', async () => {
    const repo = repository()
    const source = adapter([], [])
    vi.mocked(source.checkHealth).mockResolvedValue({ ok: false, error: { code: 'temporarily_unavailable', retryAt: null } })
    expect(await runPatientSync(source, repo)).toEqual({ ok: false, code: 'temporarily_unavailable' })
    expect(source.listPatients).not.toHaveBeenCalled()
    expect(repo.failures).toEqual(['temporarily_unavailable'])
  })

  it('rejects an empty page with a continuation cursor', async () => {
    const repo = repository()
    const source = adapter([{ data: [], nextCursor: 'unexpected-next' }], [])
    expect(await runPatientSync(source, repo)).toEqual({ ok: false, code: 'source_protocol_invalid' })
    expect(source.listPatients).toHaveBeenCalledOnce()
  })

  it('rejects a repeated continuation cursor before another request', async () => {
    const repo = repository()
    const source = adapter([{ data: [patient], nextCursor: 'same' }, { data: [patient], nextCursor: 'same' }], [])
    expect(await runPatientSync(source, repo)).toEqual({ ok: false, code: 'source_protocol_invalid' })
    expect(source.listPatients).toHaveBeenCalledTimes(2)
    expect(repo.commits).toHaveLength(0)
  })

  it('maps invalid projected source data to a closed failure', async () => {
    const repo = repository()
    const invalid = { ...patient, firstName: 'x'.repeat(201) }
    const source = adapter([{ data: [invalid], nextCursor: null }], [])
    expect(await runPatientSync(source, repo)).toEqual({ ok: false, code: 'source_contract_invalid' })
    expect(repo.failures).toEqual(['source_contract_invalid'])
  })

  it('refuses commit when fewer than five seconds remain', async () => {
    const repo = repository(true)
    const source = adapter([], [{ data: [], nextCursor: null }])
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValue(55_001)
    expect(await runPatientSync(source, repo, { now })).toEqual({ ok: false, code: 'network_unavailable' })
    expect(repo.commits).toHaveLength(0)
  })

  it('returns persistence failure when commit refuses the batch', async () => {
    const repo = repository(true)
    vi.mocked(repo.commit).mockResolvedValue({ ok: false, code: 'persistence_unavailable' })
    expect(await runPatientSync(adapter([], [{ data: [], nextCursor: null }]), repo)).toEqual({ ok: false, code: 'persistence_unavailable' })
  })

  it('allows exactly 100 combined pages and never requests page 101', async () => {
    const pages = (count: number) => Array.from({ length: count }, (_, index) => ({
      data: [patient], nextCursor: index === count - 1 ? null : `patient-page-${index + 1}`,
    }))
    const allowedRepo = repository()
    expect(await runPatientSync(adapter(pages(99), [{ data: [], nextCursor: null }]), allowedRepo)).toEqual({ ok: true })

    const refusedRepo = repository()
    const refusedSource = adapter(pages(100), [{ data: [], nextCursor: null }])
    expect(await runPatientSync(refusedSource, refusedRepo)).toEqual({ ok: false, code: 'source_protocol_invalid' })
    expect(refusedSource.listPatients).toHaveBeenCalledTimes(100)
    expect(refusedSource.listChanges).not.toHaveBeenCalled()
  })
})
