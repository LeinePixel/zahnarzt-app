import { redirect } from 'next/navigation'
import { describe, expect, it, vi } from 'vitest'

import {
  initialLoginState,
  runLogin,
  type LoginAuthFunction,
} from './actions'

function loginForm(email: string, password: string) {
  const formData = new FormData()
  formData.set('email', email)
  formData.set('password', password)
  return formData
}

function authError(message: string, status: number, code?: string) {
  return {
    data: { session: null, user: null },
    error: { code, message, name: 'AuthApiError', status },
  }
}

describe('runLogin', () => {
  it.each([
    ['', '', ['email', 'password']],
    ['keine-adresse', 'synthetic-password', ['email']],
  ])(
    'does not contact auth for invalid input %#',
    async (email, password, expectedFields) => {
      const authenticate = vi.fn<LoginAuthFunction>()

      const result = await runLogin(
        initialLoginState,
        loginForm(email, password),
        authenticate,
        redirect,
      )

      expect(authenticate).not.toHaveBeenCalled()
      expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(
        expectedFields,
      )
    },
  )

  it('returns the same state for an unknown email and a wrong password', async () => {
    const unknownEmail: LoginAuthFunction = async () =>
      authError('User not found', 400, 'invalid_credentials')
    const wrongPassword: LoginAuthFunction = async () =>
      authError('Invalid password', 400, 'invalid_credentials')

    const unknownResult = await runLogin(
      initialLoginState,
      loginForm('person@dentpilot.example', 'wrong-one'),
      unknownEmail,
      redirect,
    )
    const wrongPasswordResult = await runLogin(
      initialLoginState,
      loginForm('person@dentpilot.example', 'wrong-two'),
      wrongPassword,
      redirect,
    )

    expect(unknownResult).toEqual({
      email: 'person@dentpilot.example',
      error: 'INVALID_CREDENTIALS',
    })
    expect(wrongPasswordResult).toEqual(unknownResult)
  })

  it.each([
    ['a thrown network failure', async () => Promise.reject(new TypeError())],
    ['an upstream 5xx response', async () => authError('upstream', 503)],
    [
      'an auth request timeout',
      async () => authError('timeout', 0, 'request_timeout'),
    ],
  ])('classifies %s as unavailable', async (_case, authenticate) => {
    const result = await runLogin(
      initialLoginState,
      loginForm('person@dentpilot.example', 'synthetic-password'),
      authenticate,
      redirect,
    )

    expect(result).toEqual({
      email: 'person@dentpilot.example',
      error: 'SERVICE_UNAVAILABLE',
    })
  })

  it.each([
    ['HTTP 429', authError('too many requests', 429)],
    [
      'the Supabase rate-limit code',
      authError('too many requests', 400, 'over_request_rate_limit'),
    ],
  ])('returns a neutral rate-limit state for %s', async (_case, response) => {
    const result = await runLogin(
      initialLoginState,
      loginForm('person@dentpilot.example', 'synthetic-password'),
      async () => response,
      redirect,
    )

    expect(result).toEqual({
      email: 'person@dentpilot.example',
      error: 'RATE_LIMITED',
    })
  })

  it('retains only the email and never returns the submitted password', async () => {
    const submittedPassword = 'unique-synthetic-password-value'

    const result = await runLogin(
      initialLoginState,
      loginForm('person@dentpilot.example', submittedPassword),
      async () => authError('invalid', 400, 'invalid_credentials'),
      redirect,
    )

    expect(result.email).toBe('person@dentpilot.example')
    expect(JSON.stringify(result)).not.toContain(submittedPassword)
    expect(result).not.toHaveProperty('password')
  })

  it('passes normalized credentials to auth and redirects after success', async () => {
    let receivedCredentials: { email: string; password: string } | undefined
    const authenticate: LoginAuthFunction = async (credentials) => {
      receivedCredentials = credentials
      return {
        data: { session: null, user: null },
        error: null,
      }
    }

    const action = runLogin(
      initialLoginState,
      loginForm('  PERSON@DENTPILOT.EXAMPLE ', ' synthetic password '),
      authenticate,
      redirect,
    )

    await expect(action).rejects.toMatchObject({
      digest: expect.stringContaining('/status'),
    })
    expect(receivedCredentials).toEqual({
      email: 'person@dentpilot.example',
      password: ' synthetic password ',
    })
  })
})
