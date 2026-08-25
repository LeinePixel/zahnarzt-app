import { z } from 'zod'

type Environment = Record<string, string | undefined>

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .trim()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .url('NEXT_PUBLIC_SUPABASE_URL'),
})

function invalidEnvironmentError(error: z.ZodError) {
  const variableNames = [
    ...new Set(error.issues.map((issue) => String(issue.path[0]))),
  ]

  return new Error(
    `Ungültige oder fehlende Umgebungsvariable: ${variableNames.join(', ')}`,
  )
}

export function getPublicEnv(
  input: Environment = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
) {
  const result = publicEnvSchema.safeParse(input)

  if (!result.success) {
    throw invalidEnvironmentError(result.error)
  }

  return {
    supabaseAnonKey: result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
  }
}
