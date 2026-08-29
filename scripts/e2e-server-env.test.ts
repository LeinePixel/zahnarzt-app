import { describe, expect, it } from 'vitest'

import { withoutSeedSecrets } from './e2e-server-env'

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
