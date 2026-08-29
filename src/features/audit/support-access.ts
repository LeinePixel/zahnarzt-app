import 'server-only'

import { z } from 'zod'

import {
  mayUseCapability,
  type ActorContext,
} from '@/features/authorization/policy'

export type SupportAccessRpcClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

export type SupportReason =
  | 'technical_investigation'
  | 'account_support'

export type ActivatedSupportAccess = {
  expiresAt: string
  practiceId: string
}

type SupportAccessInput = {
  requestedDurationHours?: number
}

type GrantInput = {
  grantId: string
}

type ActivateSupportAccessInput = GrantInput & {
  reason: SupportReason
}

const durationSchema = z
  .number({ error: 'Die Supportdauer muss eine ganze Zahl sein.' })
  .int('Die Supportdauer muss eine ganze Zahl sein.')
  .min(1, 'Die Supportdauer muss mindestens eine Stunde betragen.')
  .max(24, 'Die Supportdauer beträgt maximal 24 Stunden.')

const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Ungültige Freigabekennung.',
  )
const grantIdSchema = uuidSchema
const reasonSchema = z.enum(['technical_investigation', 'account_support'], {
  error: 'Ungültiger Supportgrund.',
})
const activationResultSchema = z.object({
  expires_at: z.iso.datetime({ offset: true }),
  practice_id: uuidSchema,
})

export class SupportAccessError extends Error {
  override name = 'SupportAccessError'
}

function denied(): never {
  throw new SupportAccessError('Supportzugriff wurde verweigert.')
}

function assertCapability(actor: ActorContext, capability: 'support_access.request' | 'support_access.revoke' | 'audit.read') {
  if (!mayUseCapability(actor, capability)) {
    denied()
  }
}

function parseDuration(input: SupportAccessInput | undefined): number {
  const result = durationSchema.safeParse(input?.requestedDurationHours ?? 8)

  if (!result.success) {
    throw new SupportAccessError(result.error.issues[0]?.message ?? 'Ungültige Supportdauer.')
  }

  return result.data
}

function parseGrantId(input: GrantInput): string {
  const result = grantIdSchema.safeParse(input.grantId)

  if (!result.success) {
    throw new SupportAccessError('Ungültige Freigabekennung.')
  }

  return result.data
}

function parseReason(input: ActivateSupportAccessInput): SupportReason {
  const result = reasonSchema.safeParse(input.reason)

  if (!result.success) {
    throw new SupportAccessError('Ungültiger Supportgrund.')
  }

  return result.data
}

export async function requestSupportAccess(
  client: SupportAccessRpcClient,
  actor: ActorContext,
  input?: SupportAccessInput,
): Promise<string> {
  assertCapability(actor, 'support_access.request')
  const requestedDurationHours = parseDuration(input)

  const { data, error } = await client.rpc('request_support_access', {
    p_requested_duration: `${requestedDurationHours} hours`,
  })
  const parsedGrantId = grantIdSchema.safeParse(data)

  if (error || !parsedGrantId.success) {
    return denied()
  }

  return parsedGrantId.data
}

export async function activateSupportAccess(
  client: SupportAccessRpcClient,
  actor: ActorContext,
  input: ActivateSupportAccessInput,
): Promise<ActivatedSupportAccess> {
  assertCapability(actor, 'audit.read')
  const grantId = parseGrantId(input)
  const reason = parseReason(input)

  const { data, error } = await client.rpc('activate_support_access', {
    p_grant_id: grantId,
    p_reason: reason,
  })
  const parsedActivation = activationResultSchema.safeParse(data)

  if (error || !parsedActivation.success) {
    return denied()
  }

  return {
    expiresAt: parsedActivation.data.expires_at,
    practiceId: parsedActivation.data.practice_id,
  }
}

export async function revokeSupportAccess(
  client: SupportAccessRpcClient,
  actor: ActorContext,
  input: GrantInput,
): Promise<void> {
  assertCapability(actor, 'support_access.revoke')
  const grantId = parseGrantId(input)

  const { data, error } = await client.rpc('revoke_support_access', {
    p_grant_id: grantId,
  })

  if (error || data !== true) {
    return denied()
  }
}
