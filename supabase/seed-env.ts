import { z } from 'zod'

import { getPublicEnv } from '../src/lib/env'

type Environment = Record<string, string | undefined>

function strongSeedPassword(variable: string) {
  return z
    .string()
    .min(12, variable)
    .regex(/[a-z]/, variable)
    .regex(/[A-Z]/, variable)
    .regex(/[0-9]/, variable)
    .regex(/[^A-Za-z0-9]/, variable)
}

const seedEnvSchema = z.object({
  SEED_BEHANDLER_PASSWORD: strongSeedPassword('SEED_BEHANDLER_PASSWORD'),
  SEED_PORTALADMIN_PASSWORD: strongSeedPassword('SEED_PORTALADMIN_PASSWORD'),
  SEED_PRAXISADMIN_PASSWORD: strongSeedPassword(
    'SEED_PRAXISADMIN_PASSWORD',
  ),
  SEED_REZEPTION_PASSWORD: strongSeedPassword('SEED_REZEPTION_PASSWORD'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .trim()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY'),
})

export function getSeedEnv(input: Environment = process.env) {
  const publicEnv = getPublicEnv(input)
  const result = seedEnvSchema.safeParse(input)

  if (!result.success) {
    const variable = result.error.issues[0]?.path[0]

    throw new Error(
      `Ungültige oder fehlende Umgebungsvariable: ${String(variable)}`,
    )
  }

  return {
    ...publicEnv,
    seedPasswords: {
      behandler: result.data.SEED_BEHANDLER_PASSWORD,
      portaladmin: result.data.SEED_PORTALADMIN_PASSWORD,
      praxisadmin: result.data.SEED_PRAXISADMIN_PASSWORD,
      rezeption: result.data.SEED_REZEPTION_PASSWORD,
    },
    serviceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
  }
}
