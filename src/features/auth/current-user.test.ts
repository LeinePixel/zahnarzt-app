import { describe, expect, it, vi } from 'vitest'

import {
  CurrentUserContextError,
  runGetCurrentUserContext,
  runLogout,
  type UserProfileRow,
  type UserRole,
} from './current-user'

const readyProfile: UserProfileRow = {
  display_name: 'Dr. Test Behandler',
  role: 'behandler',
  practice: { name: 'DentPilot Testpraxis' },
}

function claims(sub?: string, error: unknown = null) {
  return async () => ({
    data: sub ? { claims: { sub } } : { claims: {} },
    error,
  })
}

function profileResult(data: UserProfileRow | null, error: unknown = null) {
  return async () => ({ data, error })
}

function redirectRecorder() {
  const paths: string[] = []
  const redirectTo = (path: string): never => {
    paths.push(path)
    throw new Error(`redirect:${path}`)
  }

  return { paths, redirectTo }
}

describe('runGetCurrentUserContext', () => {
  it.each([
    ['missing subject', claims()],
    ['claims error', claims('user-123', new Error('expired token'))],
  ])('redirects invalid identity for %s before querying a profile', async (_, getClaims) => {
    const getProfile = vi.fn(profileResult(readyProfile))
    const redirect = redirectRecorder()

    await expect(
      runGetCurrentUserContext(getClaims, getProfile, redirect.redirectTo),
    ).rejects.toThrow('redirect:/login')

    expect(redirect.paths).toEqual(['/login'])
    expect(getProfile).not.toHaveBeenCalled()
  })

  it('loads only the claimed user profile and returns the practice context', async () => {
    const requestedUserIds: string[] = []
    const getProfile = async (userId: string) => {
      requestedUserIds.push(userId)
      return { data: readyProfile, error: null }
    }

    const result = await runGetCurrentUserContext(
      claims('user-123'),
      getProfile,
      redirectRecorder().redirectTo,
    )

    expect(requestedUserIds).toEqual(['user-123'])
    expect(result).toEqual({
      status: 'ready',
      displayName: 'Dr. Test Behandler',
      practiceName: 'DentPilot Testpraxis',
      role: 'behandler',
      roleLabel: 'Behandler',
    })
    expect(JSON.stringify(result)).not.toContain('user-123')
  })

  it.each([
    ['rezeption' as const, 'Rezeption'],
    ['behandler' as const, 'Behandler'],
    ['praxisadmin' as const, 'Praxisadministration'],
  ])('keeps role %s stable and provides its German label', async (role, roleLabel) => {
    const profile: UserProfileRow = { ...readyProfile, role }

    const result = await runGetCurrentUserContext(
      claims('user-123'),
      profileResult(profile),
      redirectRecorder().redirectTo,
    )

    expect(result).toMatchObject({ status: 'ready', role, roleLabel })
  })

  it('returns an incomplete state when the auth account has no profile', async () => {
    const result = await runGetCurrentUserContext(
      claims('user-without-profile'),
      profileResult(null),
      redirectRecorder().redirectTo,
    )

    expect(result).toEqual({ status: 'incomplete' })
  })

  it('does not disguise a provider query error as a missing profile', async () => {
    const providerMessage = 'relation details containing provider internals'

    await expect(
      runGetCurrentUserContext(
        claims('user-123'),
        profileResult(null, new Error(providerMessage)),
        redirectRecorder().redirectTo,
      ),
    ).rejects.toEqual(
      new CurrentUserContextError('Kontokontext konnte nicht geladen werden.'),
    )

    try {
      await runGetCurrentUserContext(
        claims('user-123'),
        profileResult(null, new Error(providerMessage)),
        redirectRecorder().redirectTo,
      )
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(providerMessage)
    }
  })

  it('rejects malformed profile data instead of rendering an unsafe state', async () => {
    const malformed = {
      ...readyProfile,
      role: 'unknown-role' as UserRole,
    }

    await expect(
      runGetCurrentUserContext(
        claims('user-123'),
        profileResult(malformed),
        redirectRecorder().redirectTo,
      ),
    ).rejects.toBeInstanceOf(CurrentUserContextError)
  })
})

describe('runLogout', () => {
  it('ends the session, invalidates the app layout and redirects to login', async () => {
    const events: string[] = []
    const signOut = async () => {
      events.push('signOut')
      return { error: null }
    }
    const revalidate = (path: string, type: 'layout') => {
      events.push(`revalidate:${path}:${type}`)
    }
    const redirectTo = (path: string): never => {
      events.push(`redirect:${path}`)
      throw new Error(`redirect:${path}`)
    }

    await expect(runLogout(signOut, revalidate, redirectTo)).rejects.toThrow(
      'redirect:/login',
    )
    expect(events).toEqual([
      'signOut',
      'revalidate:/:layout',
      'redirect:/login',
    ])
  })

  it('does not redirect or invalidate cached views when sign out fails', async () => {
    const revalidate = vi.fn()
    const redirectTo = vi.fn((): never => {
      throw new Error('unexpected redirect')
    })

    await expect(
      runLogout(
        async () => ({ error: new Error('provider detail') }),
        revalidate,
        redirectTo,
      ),
    ).rejects.toEqual(
      new CurrentUserContextError('Abmeldung konnte nicht abgeschlossen werden.'),
    )
    expect(revalidate).not.toHaveBeenCalled()
    expect(redirectTo).not.toHaveBeenCalled()
  })
})
