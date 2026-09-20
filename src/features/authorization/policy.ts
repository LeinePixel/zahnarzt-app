export type Capability =
  | 'support_access.request'
  | 'support_access.revoke'
  | 'audit.read'
  | 'integration.status.read'

export type ActorContext =
  | {
      kind: 'practice_member'
      userId: string
      practiceId: string
      role: 'rezeption' | 'behandler' | 'praxisadmin'
    }
  | { kind: 'portal_admin'; userId: string }

const capabilities: readonly Capability[] = [
  'support_access.request',
  'support_access.revoke',
  'audit.read',
  'integration.status.read',
]

const practiceRoles = ['rezeption', 'behandler', 'praxisadmin'] as const

export class AuthorizationError extends Error {
  override name = 'AuthorizationError'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()

  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPracticeRole(
  value: unknown,
): value is (typeof practiceRoles)[number] {
  return typeof value === 'string' && practiceRoles.includes(value as never)
}

function assertActorContext(actor: unknown): asserts actor is ActorContext {
  if (!isRecord(actor)) {
    throw new AuthorizationError('Ungültiger Autorisierungskontext.')
  }

  if (actor.kind === 'practice_member') {
    if (
      !hasExactKeys(actor, ['kind', 'userId', 'practiceId', 'role']) ||
      !isNonEmptyString(actor.userId) ||
      !isNonEmptyString(actor.practiceId) ||
      !isPracticeRole(actor.role)
    ) {
      throw new AuthorizationError('Ungültiger Autorisierungskontext.')
    }

    return
  }

  if (actor.kind === 'portal_admin') {
    if (
      !hasExactKeys(actor, ['kind', 'userId']) ||
      !isNonEmptyString(actor.userId)
    ) {
      throw new AuthorizationError('Ungültiger Autorisierungskontext.')
    }

    return
  }

  throw new AuthorizationError('Ungültiger Autorisierungskontext.')
}

function assertCapability(capability: unknown): asserts capability is Capability {
  if (
    typeof capability !== 'string' ||
    !capabilities.includes(capability as Capability)
  ) {
    throw new AuthorizationError('Unbekannte Fähigkeit.')
  }
}

/**
 * Applies the local UI/server precheck. Postgres remains the authoritative
 * authorization boundary for ownership, support-grant state, and expiry.
 */
export function mayUseCapability(
  actor: ActorContext,
  capability: Capability,
): boolean {
  assertActorContext(actor)
  assertCapability(capability)

  switch (capability) {
    case 'support_access.request':
    case 'support_access.revoke':
    case 'integration.status.read':
      return actor.kind === 'practice_member' && actor.role === 'praxisadmin'
    case 'audit.read':
      return actor.kind === 'portal_admin'
  }
}
