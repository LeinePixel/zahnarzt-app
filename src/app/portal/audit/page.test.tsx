import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUserContext } from '@/features/auth/current-user'
import { readAuditEvents } from '@/features/audit/read-events'

import PortalAuditPage from './page'

vi.mock('@/features/auth/current-user', () => ({
  getCurrentUserContext: vi.fn(),
}))
vi.mock('@/features/audit/read-events', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/features/audit/read-events')
  >()

  return {
    ...actual,
    readAuditEvents: vi.fn(),
  }
})

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ rpc }),
}))

describe('PortalAuditPage', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserContext).mockReset()
    vi.mocked(readAuditEvents).mockReset()
    rpc.mockReset()
  })

  it('renders only fixed audit metadata for an allowed provider result', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'portal_admin',
      userId: '11000000-0000-0000-0000-000000000003',
    })
    vi.mocked(readAuditEvents).mockResolvedValue([
      {
        action: 'audit_read',
        actorId: '11000000-0000-0000-0000-000000000003',
        actorType: 'portal_admin',
        correlationId: '41000000-0000-0000-0000-000000000001',
        id: '51000000-0000-0000-0000-000000000001',
        occurredAt: '2026-08-28T12:00:00.000Z',
        outcome: 'allowed',
        resourceId: '31000000-0000-0000-0000-000000000001',
        resourceType: 'support_access_grant',
      },
    ])

    render(
      await PortalAuditPage({
        searchParams: Promise.resolve({
          practiceId: '21000000-0000-0000-0000-000000000001',
        }),
      }),
    )

    for (const heading of ['Akteur', 'Zeit', 'Aktion', 'Ergebnis', 'Objekt']) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText('portal_admin')).toBeInTheDocument()
    expect(screen.getByText('allowed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(readAuditEvents).toHaveBeenCalledWith(
      expect.anything(),
      {
        kind: 'portal_admin',
        userId: '11000000-0000-0000-0000-000000000003',
      },
      { practiceId: '21000000-0000-0000-0000-000000000001' },
    )
  })

  it('shows a neutral denial after sending a practice-role attempt through the audited server path', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'ready',
      displayName: 'PROJ-19 Praxisadmin',
      practiceId: '21000000-0000-0000-0000-000000000001',
      practiceName: 'PROJ-19 Testpraxis',
      role: 'praxisadmin',
      roleLabel: 'Praxisadministration',
      userId: '11000000-0000-0000-0000-000000000001',
    })
    vi.mocked(readAuditEvents).mockRejectedValue(
      new Error('neutral audited denial'),
    )

    render(
      await PortalAuditPage({
        searchParams: Promise.resolve({
          practiceId: '21000000-0000-0000-0000-000000000002',
        }),
      }),
    )

    expect(
      screen.getByText('Audit-Zugriff wurde verweigert.'),
    ).toBeInTheDocument()
    expect(readAuditEvents).toHaveBeenCalledWith(
      expect.anything(),
      {
        kind: 'practice_member',
        practiceId: '21000000-0000-0000-0000-000000000001',
        role: 'praxisadmin',
        userId: '11000000-0000-0000-0000-000000000001',
      },
      { practiceId: '21000000-0000-0000-0000-000000000001' },
    )
  })

  it('routes an unassigned authenticated account through the guarded denial path without leaking a requested target', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'incomplete',
      userId: '11000000-0000-0000-0000-000000000004',
    })
    rpc.mockResolvedValue({ data: [], error: null })

    const requestedPracticeId = '21000000-0000-0000-0000-000000000001'
    const incompleteUserId = '11000000-0000-0000-0000-000000000004'

    render(
      await PortalAuditPage({
        searchParams: Promise.resolve({
          practiceId: requestedPracticeId,
        }),
      }),
    )

    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('read_audit_events', {
      p_before: expect.any(String),
      p_limit: 1,
      p_practice_id: null,
    })
    expect(
      screen.getByText('Audit-Zugriff wurde verweigert.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(requestedPracticeId)).not.toBeInTheDocument()
    expect(screen.queryByText(incompleteUserId)).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(readAuditEvents).not.toHaveBeenCalled()
  })

  it('shows only the controlled activation form for an empty portal state', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'portal_admin',
      userId: '11000000-0000-0000-0000-000000000003',
    })

    render(await PortalAuditPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByLabelText('Freigabekennung')).toBeEnabled()
    expect(screen.getByLabelText('Supportgrund')).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Supportzugriff aktivieren' }),
    ).toBeEnabled()
    expect(readAuditEvents).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: /suche/i })).not.toBeInTheDocument()
  })
})
