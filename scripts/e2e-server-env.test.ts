import { describe, expect, it } from 'vitest'

import { getE2ePort, withoutSeedSecrets } from './e2e-server-env'

describe('getE2ePort', () => {
  it('uses 3100 by default and propagates an explicit local E2E port', () => {
    expect(getE2ePort({})).toBe(3100)
    expect(getE2ePort({ E2E_PORT: '3101' })).toBe(3101)
  })
})

describe('withoutSeedSecrets', () => {
  it('removes every seed secret while preserving public app configuration', () => {
    const sanitized = withoutSeedSecrets({
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.example',
      SEED_BEHANDLER_PASSWORD: 'secret',
      SEED_PORTALADMIN_PASSWORD: 'secret',
      SEED_PRAXISADMIN_PASSWORD: 'secret',
      SEED_REZEPTION_PASSWORD: 'secret',
      SUPABASE_SERVICE_ROLE_KEY: 'secret',
    })

    expect(sanitized).toEqual({
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.example',
    })
  })
})
