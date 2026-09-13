const seedSecretNames = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEED_REZEPTION_PASSWORD',
  'SEED_BEHANDLER_PASSWORD',
  'SEED_PORTALADMIN_PASSWORD',
  'SEED_PRAXISADMIN_PASSWORD',
] as const

const defaultE2ePort = 3100
type E2ePortEnvironment = { E2E_PORT?: string }

export function getE2ePort(input: E2ePortEnvironment) {
  const port = Number(input.E2E_PORT ?? defaultE2ePort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('E2E_PORT muss eine gültige lokale Portnummer sein.')
  }

  return port
}

export function getConfiguredE2ePort() {
  return getE2ePort(process.env as unknown as E2ePortEnvironment)
}

export function withoutSeedSecrets(
  input: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const sanitized = { ...input }

  for (const name of seedSecretNames) {
    delete sanitized[name]
  }

  return sanitized
}
