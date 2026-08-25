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
      practiceName: 'DentPilot Testpraxis',
      role: 'behandler',
      roleLabel: 'Behandler',
    })

    render(await StatusPage())

    expect(
      screen.getByRole('heading', { name: 'Willkommen, Dr. Test Behandler' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Behandler')).toBeInTheDocument()
    expect(screen.getByText('DentPilot Testpraxis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sicher abmelden' })).toBeEnabled()
  })

  it('shows a clear setup notice instead of profile fields for an incomplete account', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({ status: 'incomplete' })

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
