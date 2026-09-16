import { z } from 'zod'
import { changeEventSchema, patientSchema } from '@/features/integrations/contracts'

export const patientProjectionSchema = z.strictObject({
  sourceId: z.string().min(1).max(100),
  sourceVersion: z.number().int().positive(),
  firstName: z.string().min(1).max(200),
  lastName: z.string().min(1).max(200),
  birthDate: z.iso.date(),
  phoneE164: z.string().regex(/^\+[1-9]\d{1,14}$/),
  sourceCreatedAt: z.string().datetime({ offset: true }),
  sourceUpdatedAt: z.string().datetime({ offset: true }),
})

export const patientMutationSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('upsert'), patient: patientProjectionSchema }),
  z.strictObject({
    operation: z.literal('delete'),
    sourceId: z.string().min(1).max(100),
    sourceVersion: z.number().int().positive(),
  }),
])

export type PatientProjection = z.infer<typeof patientProjectionSchema>
export type PatientMutation = z.infer<typeof patientMutationSchema>

export class PatientProjectionError extends Error {
  override name = 'PatientProjectionError'
}

export function projectPatient(input: unknown): PatientProjection {
  try {
    const source = patientSchema.parse(input)
    return patientProjectionSchema.parse({
      sourceId: source.id,
      sourceVersion: source.version,
      firstName: source.firstName,
      lastName: source.lastName,
      birthDate: source.birthDate,
      phoneE164: source.phoneE164,
      sourceCreatedAt: source.sourceCreatedAt,
      sourceUpdatedAt: source.sourceUpdatedAt,
    })
  } catch {
    throw new PatientProjectionError('Patientenquelle ist ungültig.')
  }
}

export function projectPatientChange(input: unknown): PatientMutation | null {
  try {
    const event = changeEventSchema.parse(input)
    if (event.entityType === 'appointment') return null
    if (event.operation === 'delete') {
      return patientMutationSchema.parse({
        operation: 'delete',
        sourceId: event.entityId,
        sourceVersion: event.version,
      })
    }
    return patientMutationSchema.parse({ operation: 'upsert', patient: projectPatient(event.resource) })
  } catch {
    throw new PatientProjectionError('Patientenquelle ist ungültig.')
  }
}
