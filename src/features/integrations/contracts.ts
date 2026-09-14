import { z } from 'zod'

export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100
export const timestampSchema = z.string().datetime({ offset: true })
const identity = { id: z.string().min(1), version: z.number().int().positive() }
const sourceTimes = { sourceCreatedAt: timestampSchema, sourceUpdatedAt: timestampSchema }

export const patientSchema = z.strictObject({
  ...identity,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.iso.date(),
  email: z.string().email().nullable(),
  phoneE164: z.string().regex(/^\+[1-9]\d{1,14}$/),
  ...sourceTimes,
})

export const appointmentSchema = z.strictObject({
  ...identity,
  patientId: z.string().min(1),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  status: z.enum(['confirmed', 'cancelled', 'no_show', 'rescheduled', 'completed']),
  practitionerId: z.string().min(1),
  ...sourceTimes,
}).refine(a => Date.parse(a.startsAt) < Date.parse(a.endsAt))

const eventFields = {
  eventId: z.string().min(1), cursor: z.string().min(1), occurredAt: timestampSchema,
  entityId: z.string().min(1), version: z.number().int().positive(),
}
export const changeEventSchema = z.union([
  z.strictObject({ ...eventFields, entityType: z.literal('patient'), operation: z.literal('upsert'), resource: patientSchema }),
  z.strictObject({ ...eventFields, entityType: z.literal('appointment'), operation: z.literal('upsert'), resource: appointmentSchema }),
  z.strictObject({ ...eventFields, entityType: z.enum(['patient', 'appointment']), operation: z.literal('delete') }),
]).refine(e => e.operation === 'delete' || (e.resource.id === e.entityId && e.resource.version === e.version))

export const patientPageSchema = z.strictObject({ data: z.array(patientSchema).max(100), nextCursor: z.string().min(1).max(128).nullable() })
export const appointmentPageSchema = z.strictObject({ data: z.array(appointmentSchema).max(100), nextCursor: z.string().min(1).max(128).nullable() })
export const changePageSchema = z.strictObject({ data: z.array(changeEventSchema).max(100), nextCursor: z.string().min(1).max(128).nullable() })
export const healthSchema = z.strictObject({ data: z.strictObject({ apiVersion: z.literal('v1') }) })
export type SourcePatient = z.infer<typeof patientSchema>
export type SourceAppointment = z.infer<typeof appointmentSchema>
export type SourceChangeEvent = z.infer<typeof changeEventSchema>
