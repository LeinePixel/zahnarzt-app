import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentUserContext } from '@/features/auth/current-user'

import StatusPage from './page'

vi.mock('@/features/auth/current-user', () => ({
  getCurrentUserContext: vi.fn(),
  logout: vi.fn(),
}))

describe('StatusPage', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserContext).mockReset()
  })

  it('shows the current display name, German role and practice name', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'ready',
      displayName: 'Dr. Test Behandler',
      practiceId: '21000000-0000-0000-0000-000000000001',
      practiceName: 'DentPilot Testpraxis',
      role: 'behandler',
      roleLabel: 'Behandler',
      userId: '11000000-0000-0000-0000-000000000002',
    })

    render(await StatusPage())

    expect(
      screen.getByRole('heading', { name: 'Willkommen, Dr. Test Behandler' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Behandler')).toBeInTheDocument()
    expect(screen.getByText('DentPilot Testpraxis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sicher abmelden' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Supportzugriff anfordern' }),
    ).not.toBeInTheDocument()
  })

  it('renders the default support-access action only for a praxisadmin', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'ready',
      displayName: 'PROJ-19 Praxisadmin',
      practiceId: '21000000-0000-0000-0000-000000000001',
      practiceName: 'PROJ-19 Testpraxis',
      role: 'praxisadmin',
      roleLabel: 'Praxisadministration',
      userId: '11000000-0000-0000-0000-000000000001',
    })

    render(await StatusPage())

    expect(
      screen.getByRole('button', { name: 'Supportzugriff anfordern' }),
    ).toBeEnabled()
    expect(screen.getByLabelText('Freigabekennung widerrufen')).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Supportzugriff widerrufen' }),
    ).toBeEnabled()
    expect(screen.getByText(/standardmäßig acht Stunden/i)).toBeInTheDocument()
  })

  it('shows a portal entry for a verified portaladmin instead of the incomplete-account notice', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'portal_admin',
      userId: '11000000-0000-0000-0000-000000000003',
    })

    render(await StatusPage())

    expect(screen.getByRole('link', { name: 'Zum Supportportal' })).toHaveAttribute(
      'href',
      '/portal/audit',
    )
    expect(
      screen.queryByRole('heading', { name: 'Konto unvollständig eingerichtet' }),
    ).not.toBeInTheDocument()
  })

  it('shows a clear setup notice instead of profile fields for an incomplete account', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'incomplete',
      userId: '11000000-0000-0000-0000-000000000005',
    })

    render(await StatusPage())

    expect(
      screen.getByRole('heading', { name: 'Konto unvollständig eingerichtet' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Für dieses Anmeldekonto fehlt noch die Zuordnung zu einer Praxis. Bitte wenden Sie sich an Ihre Praxisadministration.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sicher abmelden' })).toBeEnabled()
    expect(screen.queryByText('Unbekannte Praxis')).not.toBeInTheDocument()
  })
})
