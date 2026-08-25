const seedSecretNames = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEED_REZEPTION_PASSWORD',
  'SEED_BEHANDLER_PASSWORD',
  'SEED_PRAXISADMIN_PASSWORD',
] as const

export function withoutSeedSecrets(
  input: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const sanitized = { ...input }

  for (const name of seedSecretNames) {
    delete sanitized[name]
  }

  return sanitized
}
