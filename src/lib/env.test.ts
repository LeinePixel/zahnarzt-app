import { describe, expect, it } from 'vitest'

import { getPublicEnv } from '@/lib/env'

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
}

describe('getPublicEnv', () => {
  it.each([
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ] as const)('names the missing variable %s', (variableName) => {
    const input = { ...validPublicEnv }
    delete input[variableName]

    expect(() => getPublicEnv(input)).toThrow(variableName)
  })

  it('rejects a malformed Supabase URL', () => {
    expect(() =>
      getPublicEnv({ ...validPublicEnv, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' }),
    ).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('returns only browser-safe Supabase configuration', () => {
    expect(getPublicEnv(validPublicEnv)).toEqual({
      supabaseAnonKey: 'public-anon-key',
      supabaseUrl: 'https://example.supabase.co',
    })
  })
})
