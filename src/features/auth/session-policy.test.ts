import { describe, expect, it, vi } from 'vitest'

import { runRequireAal2Session } from './session-policy'

function redirectRecorder() {
  const paths: string[] = []
  const redirectTo = (path: string): never => {
    paths.push(path)
    throw new Error(`redirect:${path}`)
  }

  return { paths, redirectTo }
}

const aal2Claims = {
  sub: 'user-123',
  aal: 'aal2',
  session_id: '33000000-0000-0000-0000-000000000001',
}

describe('runRequireAal2Session', () => {
  it('routes AAL1 only to the MFA bootstrap before database access', async () => {
    const initialize = vi.fn()
    const redirect = redirectRecorder()

    await expect(
      runRequireAal2Session(
        { ...aal2Claims, aal: 'aal1' },
        initialize,
        redirect.redirectTo,
      ),
    ).rejects.toThrow('redirect:/auth/mfa')

    expect(initialize).not.toHaveBeenCalled()
  })

  it.each([
    ['missing subject', { ...aal2Claims, sub: undefined }],
    ['missing session id', { ...aal2Claims, session_id: undefined }],
    ['malformed session id', { ...aal2Claims, session_id: 'not-a-uuid' }],
  ])('fails closed for %s', async (_name, claims) => {
    const initialize = vi.fn()
    const redirect = redirectRecorder()

    await expect(
      runRequireAal2Session(claims, initialize, redirect.redirectTo),
    ).rejects.toThrow('redirect:/login')

    expect(initialize).not.toHaveBeenCalled()
  })

  it('returns the verified subject only after database initialization', async () => {
    const initialize = vi.fn(async () => ({ data: true, error: null }))

    await expect(
      runRequireAal2Session(
        aal2Claims,
        initialize,
        redirectRecorder().redirectTo,
      ),
    ).resolves.toBe('user-123')
    expect(initialize).toHaveBeenCalledOnce()
  })

  it.each([
    ['database denial', { data: false, error: null }],
    ['database error', { data: null, error: new Error('provider detail') }],
  ])('fails closed for %s without exposing details', async (_name, result) => {
    const redirect = redirectRecorder()

    await expect(
      runRequireAal2Session(
        aal2Claims,
        async () => result,
        redirect.redirectTo,
      ),
    ).rejects.toThrow('redirect:/login')
  })
})
