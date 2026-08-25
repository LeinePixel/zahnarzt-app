import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { LoginState } from '@/features/auth/actions'

import { LoginForm, type LoginFormAction } from './login-form'

function deferredState() {
  let resolve!: (state: LoginState) => void
  const promise = new Promise<LoginState>((resolver) => {
    resolve = resolver
  })

  return { promise, resolve }
}

describe('LoginForm', () => {
  it('provides German accessible labels and the correct autofill contract', () => {
    render(<LoginForm action={vi.fn()} />)

    const email = screen.getByRole('textbox', { name: 'E-Mail-Adresse' })
    const password = screen.getByLabelText('Passwort')

    expect(email).toHaveAttribute('name', 'email')
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'username')
    expect(password).toHaveAttribute('name', 'password')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(
      screen.getByRole('button', { name: 'Sicher anmelden' }),
    ).toBeEnabled()
  })

  it('associates German field errors and retains only the submitted email', async () => {
    const action: LoginFormAction = vi.fn(async () => ({
      email: 'person@dentpilot.example',
      fieldErrors: {
        email: ['Bitte geben Sie eine gültige E-Mail-Adresse ein.'],
        password: ['Passwort ist erforderlich.'],
      },
    }))

    render(<LoginForm action={action} />)

    const email = screen.getByRole('textbox', { name: 'E-Mail-Adresse' })
    const password = screen.getByLabelText('Passwort')

    fireEvent.change(email, { target: { value: 'person@dentpilot.example' } })
    fireEvent.change(password, { target: { value: 'synthetic-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sicher anmelden' }))

    expect(
      await screen.findByText('Bitte geben Sie eine gültige E-Mail-Adresse ein.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Passwort ist erforderlich.')).toBeInTheDocument()
    expect(email).toHaveValue('person@dentpilot.example')
    expect(password).toHaveValue('')
    expect(email).toHaveAccessibleDescription(
      'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    )
    expect(password).toHaveAccessibleDescription('Passwort ist erforderlich.')
  })

  it.each([
    [
      'INVALID_CREDENTIALS' as const,
      'E-Mail-Adresse oder Passwort ist nicht korrekt.',
    ],
    [
      'RATE_LIMITED' as const,
      'Zu viele Anmeldeversuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
    ],
    [
      'SERVICE_UNAVAILABLE' as const,
      'Die Anmeldung ist derzeit nicht möglich. Bitte versuchen Sie es später erneut.',
    ],
  ])('announces the neutral %s error in German', async (error, message) => {
    const action: LoginFormAction = vi.fn(async () => ({
      email: 'person@dentpilot.example',
      error,
    }))

    render(<LoginForm action={action} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'E-Mail-Adresse' }), {
      target: { value: 'person@dentpilot.example' },
    })
    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'synthetic-secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sicher anmelden' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('disables submission while pending and ignores a second click', async () => {
    const pending = deferredState()
    const action: LoginFormAction = vi.fn(() => pending.promise)

    render(<LoginForm action={action} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'E-Mail-Adresse' }), {
      target: { value: 'person@dentpilot.example' },
    })
    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'synthetic-secret' },
    })

    const submit = screen.getByRole('button', { name: 'Sicher anmelden' })
    fireEvent.click(submit)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Anmeldung läuft' })).toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Anmeldung läuft' }))
    expect(action).toHaveBeenCalledTimes(1)

    pending.resolve({ email: 'person@dentpilot.example' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sicher anmelden' })).toBeEnabled()
    })
  })

})
