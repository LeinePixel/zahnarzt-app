import { z } from 'zod'
import { appointmentSchema, changeEventSchema } from '@/features/integrations/contracts'

export const appointmentProjectionSchema = z.strictObject({
  sourceId: z.string().min(1).max(100),
  sourceVersion: z.number().int().positive(),
  patientSourceId: z.string().min(1).max(100),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  status: z.enum(['confirmed', 'cancelled', 'no_show', 'rescheduled', 'completed']),
  practitionerSourceId: z.string().min(1).max(100),
  sourceCreatedAt: z.string().datetime({ offset: true }),
  sourceUpdatedAt: z.string().datetime({ offset: true }),
}).refine(appointment => Date.parse(appointment.startsAt) < Date.parse(appointment.endsAt))

export const appointmentMutationSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('upsert'), appointment: appointmentProjectionSchema }),
  z.strictObject({
    operation: z.literal('delete'),
    sourceId: z.string().min(1).max(100),
    sourceVersion: z.number().int().positive(),
  }),
])

export type AppointmentProjection = z.infer<typeof appointmentProjectionSchema>
export type AppointmentMutation = z.infer<typeof appointmentMutationSchema>

export class AppointmentProjectionError extends Error {
  override name = 'AppointmentProjectionError'
}

export function projectAppointment(input: unknown): AppointmentProjection {
  try {
    const source = appointmentSchema.parse(input)
    return appointmentProjectionSchema.parse({
      sourceId: source.id,
      sourceVersion: source.version,
      patientSourceId: source.patientId,
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      status: source.status,
      practitionerSourceId: source.practitionerId,
      sourceCreatedAt: source.sourceCreatedAt,
      sourceUpdatedAt: source.sourceUpdatedAt,
    })
  } catch {
    throw new AppointmentProjectionError('Terminquelle ist ungültig.')
  }
}

export function projectAppointmentChange(input: unknown): AppointmentMutation | null {
  try {
    const event = changeEventSchema.parse(input)
    if (event.entityType === 'patient') return null
    if (event.operation === 'delete') {
      return appointmentMutationSchema.parse({
        operation: 'delete',
        sourceId: event.entityId,
        sourceVersion: event.version,
      })
    }
    return appointmentMutationSchema.parse({
      operation: 'upsert',
      appointment: projectAppointment(event.resource),
    })
  } catch {
    throw new AppointmentProjectionError('Terminquelle ist ungültig.')
  }
}
