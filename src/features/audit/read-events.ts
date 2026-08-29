import 'server-only'

import { z } from 'zod'

import {
  mayUseCapability,
  type ActorContext,
} from '@/features/authorization/policy'

export type AuditReadRpcClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

export type AuditEvent = {
  action:
    | 'support_access_requested'
    | 'support_access_activated'
    | 'support_access_revoked'
    | 'audit_read'
  actorId: string
  actorType: 'practice_member' | 'portal_admin' | 'unknown_authenticated'
  correlationId: string
  occurredAt: string
  outcome: 'allowed' | 'denied' | 'failed'
  resourceId: string | null
  resourceType: 'support_access_grant' | 'audit_event'
}

type ReadAuditEventsInput = {
  before?: Date
  limit?: number
  practiceId: string
}

const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Ungültige Praxiskennung.',
  )
const practiceIdSchema = uuidSchema
const limitSchema = z
  .number({ error: 'Die Anzahl muss zwischen 1 und 100 liegen.' })
  .int('Die Anzahl muss zwischen 1 und 100 liegen.')
  .min(1, 'Die Anzahl muss zwischen 1 und 100 liegen.')
  .max(100, 'Die Anzahl muss zwischen 1 und 100 liegen.')
const eventSchema = z.object({
  action: z.enum([
    'support_access_requested',
    'support_access_activated',
    'support_access_revoked',
    'audit_read',
  ]),
  actor_id: uuidSchema,
  actor_type: z.enum(['practice_member', 'portal_admin', 'unknown_authenticated']),
  correlation_id: uuidSchema,
  occurred_at: z.iso.datetime({ offset: true }),
  outcome: z.enum(['allowed', 'denied', 'failed']),
  resource_id: uuidSchema.nullable(),
  resource_type: z.enum(['support_access_grant', 'audit_event']),
})
const eventsSchema = z.array(eventSchema).min(1)

export class AuditReadError extends Error {
  override name = 'AuditReadError'
}

function denied(): never {
  throw new AuditReadError('Audit-Zugriff wurde verweigert.')
}

function parseInput(input: ReadAuditEventsInput) {
  const parsedLimit = limitSchema.safeParse(input.limit ?? 100)

  if (!parsedLimit.success) {
    throw new AuditReadError('Die Anzahl muss zwischen 1 und 100 liegen.')
  }

  const parsedPracticeId = practiceIdSchema.safeParse(input.practiceId)

  if (!parsedPracticeId.success) {
    throw new AuditReadError('Ungültige Praxiskennung.')
  }

  const before = input.before ?? new Date()

  if (Number.isNaN(before.valueOf())) {
    throw new AuditReadError('Ungültiger Zeitpunkt.')
  }

  return {
    p_before: before.toISOString(),
    p_limit: parsedLimit.data,
    p_practice_id: parsedPracticeId.data,
  }
}

export async function readAuditEvents(
  client: AuditReadRpcClient,
  actor: ActorContext,
  input: ReadAuditEventsInput,
): Promise<AuditEvent[]> {
  if (!mayUseCapability(actor, 'audit.read')) {
    return denied()
  }

  const parameters = parseInput(input)
  const { data, error } = await client.rpc('read_audit_events', parameters)
  const parsedEvents = eventsSchema.safeParse(data)

  if (error || !parsedEvents.success) {
    return denied()
  }

  return parsedEvents.data.map((event) => ({
    action: event.action,
    actorId: event.actor_id,
    actorType: event.actor_type,
    correlationId: event.correlation_id,
    occurredAt: event.occurred_at,
    outcome: event.outcome,
    resourceId: event.resource_id,
    resourceType: event.resource_type,
  }))
}
