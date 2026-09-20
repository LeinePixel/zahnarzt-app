// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { IntegrationAdapter, Page, SourceAppointment, SourceChangeEvent } from '@/features/integrations/adapter'
import type { AppointmentSyncCommit, AppointmentSyncRepository } from './sync-repository'
import { runAppointmentSync } from './sync-appointments'

const appointment: SourceAppointment = {
  id: 'appointment-1', version: 1, patientId: 'patient-1',
  startsAt: '2026-10-02T08:00:00Z', endsAt: '2026-10-02T08:30:00Z',
  status: 'confirmed', practitionerId: 'practitioner-1',
  sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
}
const appointmentEvent: SourceChangeEvent = {
  eventId: 'event-1', cursor: 'appointment-cursor', occurredAt: appointment.sourceUpdatedAt,
  entityType: 'appointment', operation: 'upsert', entityId: appointment.id, version: 1,
  resource: appointment,
}
const patientDelete: SourceChangeEvent = {
  eventId: 'event-2', cursor: 'patient-cursor', occurredAt: appointment.sourceUpdatedAt,
  entityType: 'patient', operation: 'delete', entityId: appointment.patientId, version: 2,
}

function repository(initialImportCompleted = false, cursor: string | null = null) {
  const commits: AppointmentSyncCommit[] = []
  const failures: string[] = []
  const value: AppointmentSyncRepository & { commits: AppointmentSyncCommit[]; failures: string[] } = {
    commits, failures,
    acquire: vi.fn(async () => ({ ok: true as const, checkpoint: {
      integrationId: '33000000-0000-4000-8000-000000000001',
      initialImportCompleted, confirmedChangeCursor: cursor,
    } })),
    commit: vi.fn(async input => { commits.push(input); return { ok: true as const } }),
    recordFailure: vi.fn(async input => { failures.push(input.code); return true }),
    close: vi.fn(async () => undefined),
  }
  return value
}

function adapter(appointmentPages: Page<SourceAppointment>[], changePages: Page<SourceChangeEvent>[]): IntegrationAdapter {
  let appointmentIndex = 0
  let changeIndex = 0
  return {
    checkHealth: vi.fn(async () => ({ ok: true as const, value: undefined })),
    listPatients: vi.fn(async () => ({ ok: true as const, value: { data: [], nextCursor: null } })),
    listAppointments: vi.fn(async () => ({ ok: true as const, value: appointmentPages[appointmentIndex++] })),
    listChanges: vi.fn(async () => ({ ok: true as const, value: changePages[changeIndex++] })),
  }
}

describe('bounded appointment synchronization', () => {
  it('collects initial appointments and advances through the last patient event', async () => {
    const repo = repository()
    const source = adapter(
      [{ data: [appointment], nextCursor: null }],
      [{ data: [appointmentEvent, patientDelete], nextCursor: null }],
    )
    expect(await runAppointmentSync(source, repo)).toEqual({ ok: true })
    expect(repo.commits).toHaveLength(1)
    expect(repo.commits[0].candidateCursor).toBe('patient-cursor')
    expect(repo.commits[0].snapshot[0]).toEqual(expect.objectContaining({ patientSourceId: 'patient-1' }))
    expect(repo.commits[0].mutations).toHaveLength(1)
  })

  it('uses only changes after initial import and preserves an empty-feed cursor', async () => {
    const repo = repository(true, 'previous')
    const source = adapter([], [{ data: [], nextCursor: null }])
    expect(await runAppointmentSync(source, repo)).toEqual({ ok: true })
    expect(source.listAppointments).not.toHaveBeenCalled()
    expect(source.listChanges).toHaveBeenCalledWith({ cursor: 'previous', limit: 100 })
    expect(repo.commits[0].candidateCursor).toBe('previous')
  })

  it('stops before source access when acquisition is refused and still closes', async () => {
    const repo = repository()
    vi.mocked(repo.acquire).mockResolvedValue({ ok: false, code: 'sync_busy' })
    const source = adapter([], [])
    expect(await runAppointmentSync(source, repo)).toEqual({ ok: false, code: 'sync_busy' })
    expect(source.checkHealth).not.toHaveBeenCalled()
    expect(source.listAppointments).not.toHaveBeenCalled()
    expect(repo.close).toHaveBeenCalledOnce()
  })

  it('records a later-page provider failure without committing', async () => {
    const repo = repository()
    const source = adapter([{ data: [appointment], nextCursor: 'next' }], [])
    vi.mocked(source.listAppointments)
      .mockResolvedValueOnce({ ok: true, value: { data: [appointment], nextCursor: 'next' } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'rate_limited', retryAt: null } })
    expect(await runAppointmentSync(source, repo)).toEqual({ ok: false, code: 'rate_limited' })
    expect(repo.failures).toEqual(['rate_limited'])
    expect(repo.commits).toHaveLength(0)
  })

  it('stops after a failing health check', async () => {
    const repo = repository()
    const source = adapter([], [])
    vi.mocked(source.checkHealth).mockResolvedValue({
      ok: false, error: { code: 'temporarily_unavailable', retryAt: null },
    })
    expect(await runAppointmentSync(source, repo)).toEqual({ ok: false, code: 'temporarily_unavailable' })
    expect(source.listAppointments).not.toHaveBeenCalled()
    expect(repo.failures).toEqual(['temporarily_unavailable'])
  })

  it('rejects an empty page with a continuation cursor', async () => {
    const repo = repository()
    const source = adapter([{ data: [], nextCursor: 'unexpected-next' }], [])
    expect(await runAppointmentSync(source, repo)).toEqual({ ok: false, code: 'source_protocol_invalid' })
    expect(source.listAppointments).toHaveBeenCalledOnce()
  })

  it('rejects a repeated continuation cursor before another request', async () => {
    const repo = repository()
    const source = adapter([
      { data: [appointment], nextCursor: 'same' },
      { data: [appointment], nextCursor: 'same' },
    ], [])
    expect(await runAppointmentSync(source, repo)).toEqual({ ok: false, code: 'source_protocol_invalid' })
    expect(source.listAppointments).toHaveBeenCalledTimes(2)
    expect(repo.commits).toHaveLength(0)
  })

  it('maps invalid projected source data to a closed failure', async () => {
    const repo = repository()
    const invalid = { ...appointment, practitionerId: 'x'.repeat(101) }
    const source = adapter([{ data: [invalid], nextCursor: null }], [])
    expect(await runAppointmentSync(source, repo)).toEqual({ ok: false, code: 'source_contract_invalid' })
    expect(repo.failures).toEqual(['source_contract_invalid'])
  })

  it('refuses commit when fewer than five seconds remain', async () => {
    const repo = repository(true)
    const source = adapter([], [{ data: [], nextCursor: null }])
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValue(55_001)
    expect(await runAppointmentSync(source, repo, { now })).toEqual({ ok: false, code: 'network_unavailable' })
    expect(repo.commits).toHaveLength(0)
  })

  it('returns persistence failure when commit refuses the batch', async () => {
    const repo = repository(true)
    vi.mocked(repo.commit).mockResolvedValue({ ok: false, code: 'persistence_unavailable' })
    expect(await runAppointmentSync(adapter([], [{ data: [], nextCursor: null }]), repo))
      .toEqual({ ok: false, code: 'persistence_unavailable' })
  })

  it('allows exactly 100 combined pages and never requests page 101', async () => {
    const pages = (count: number) => Array.from({ length: count }, (_, index) => ({
      data: [appointment], nextCursor: index === count - 1 ? null : `appointment-page-${index + 1}`,
    }))
    const allowedRepo = repository()
    expect(await runAppointmentSync(adapter(pages(99), [{ data: [], nextCursor: null }]), allowedRepo))
      .toEqual({ ok: true })

    const refusedRepo = repository()
    const refusedSource = adapter(pages(100), [{ data: [], nextCursor: null }])
    expect(await runAppointmentSync(refusedSource, refusedRepo))
      .toEqual({ ok: false, code: 'source_protocol_invalid' })
    expect(refusedSource.listAppointments).toHaveBeenCalledTimes(100)
    expect(refusedSource.listChanges).not.toHaveBeenCalled()
  })
})
