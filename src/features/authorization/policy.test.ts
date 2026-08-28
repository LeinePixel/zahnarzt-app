import { describe, expect, it } from 'vitest'

import {
  AuthorizationError,
  mayUseCapability,
  type ActorContext,
} from './policy'

const rezeption: ActorContext = {
  kind: 'practice_member',
  userId: 'user-rezeption',
  practiceId: 'practice-a',
  role: 'rezeption',
}

const behandler: ActorContext = {
  kind: 'practice_member',
  userId: 'user-behandler',
  practiceId: 'practice-a',
  role: 'behandler',
}

const praxisadmin: ActorContext = {
  kind: 'practice_member',
  userId: 'user-praxisadmin',
  practiceId: 'practice-a',
  role: 'praxisadmin',
}

const portalAdmin: ActorContext = {
  kind: 'portal_admin',
  userId: 'user-portaladmin',
}

describe('mayUseCapability', () => {
  it('allows only practice admins to request and revoke support access', () => {
    expect(mayUseCapability(praxisadmin, 'support_access.request')).toBe(true)
    expect(mayUseCapability(praxisadmin, 'support_access.revoke')).toBe(true)

    for (const actor of [rezeption, behandler, portalAdmin]) {
      expect(mayUseCapability(actor, 'support_access.request')).toBe(false)
      expect(mayUseCapability(actor, 'support_access.revoke')).toBe(false)
    }
  })

  it('allows only portal admins to read audits', () => {
    expect(mayUseCapability(portalAdmin, 'audit.read')).toBe(true)

    for (const actor of [rezeption, behandler, praxisadmin]) {
      expect(mayUseCapability(actor, 'audit.read')).toBe(false)
    }
  })

  it('rejects an unknown practice role instead of falling back to an allowance', () => {
    const malformedActor = {
      ...praxisadmin,
      role: 'portaladmin',
    } as unknown as ActorContext

    expect(() =>
      mayUseCapability(malformedActor, 'support_access.request'),
    ).toThrow(AuthorizationError)
  })

  it('rejects malformed or mixed actor contexts', () => {
    const missingPractice = {
      kind: 'practice_member',
      userId: 'user-missing-practice',
      role: 'praxisadmin',
    } as unknown as ActorContext
    const portalAdminWithPracticeRole = {
      kind: 'portal_admin',
      userId: 'user-portaladmin',
      role: 'praxisadmin',
    } as unknown as ActorContext

    expect(() => mayUseCapability(missingPractice, 'audit.read')).toThrow(
      AuthorizationError,
    )
    expect(() => mayUseCapability(portalAdminWithPracticeRole, 'audit.read')).toThrow(
      AuthorizationError,
    )
  })
})
