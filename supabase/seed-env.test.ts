import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { getSeedEnv } from './seed-env'

const testPasswordPart = randomBytes(16).toString('hex')

const validSeedEnv = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  SEED_BEHANDLER_PASSWORD: `B-${testPasswordPart}-aA1!`,
  SEED_PRAXISADMIN_PASSWORD: `P-${testPasswordPart}-aA1!`,
  SEED_REZEPTION_PASSWORD: `R-${testPasswordPart}-aA1!`,
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
}

describe('getSeedEnv', () => {
  it('requires the service-role key for the CLI seed process', () => {
    const withoutServiceRoleKey: Record<string, string | undefined> = {
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        validSeedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_URL: validSeedEnv.NEXT_PUBLIC_SUPABASE_URL,
      SEED_BEHANDLER_PASSWORD: validSeedEnv.SEED_BEHANDLER_PASSWORD,
      SEED_PRAXISADMIN_PASSWORD: validSeedEnv.SEED_PRAXISADMIN_PASSWORD,
      SEED_REZEPTION_PASSWORD: validSeedEnv.SEED_REZEPTION_PASSWORD,
    }

    expect(() => getSeedEnv(withoutServiceRoleKey)).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY',
    )
  })

  it('returns all configuration required by the seed process', () => {
    expect(getSeedEnv(validSeedEnv)).toEqual({
      serviceRoleKey: 'local-service-role-key',
      seedPasswords: {
        behandler: validSeedEnv.SEED_BEHANDLER_PASSWORD,
        praxisadmin: validSeedEnv.SEED_PRAXISADMIN_PASSWORD,
        rezeption: validSeedEnv.SEED_REZEPTION_PASSWORD,
      },
      supabaseAnonKey: 'public-anon-key',
      supabaseUrl: 'https://example.supabase.co',
    })
  })

  it.each([
    'SEED_REZEPTION_PASSWORD',
    'SEED_BEHANDLER_PASSWORD',
    'SEED_PRAXISADMIN_PASSWORD',
  ])('requires a strong local value for %s', (variable) => {
    expect(() =>
      getSeedEnv({
        ...validSeedEnv,
        [variable]: 'too-weak',
      }),
    ).toThrow(variable)
  })
})

describe('environment examples', () => {
  it('keeps app configuration separate from seed secrets', () => {
    const appExample = readFileSync(
      resolve(process.cwd(), '.env.local.example'),
      'utf8',
    )
    const seedExample = readFileSync(
      resolve(process.cwd(), '.env.seed.local.example'),
      'utf8',
    )

    expect(appExample).toContain('NEXT_PUBLIC_SUPABASE_URL=https://')
    expect(appExample).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY=')
    expect(appExample).not.toContain('SUPABASE_SERVICE_ROLE_KEY=')
    expect(appExample).not.toContain('SEED_REZEPTION_PASSWORD=')
    expect(seedExample).toContain('SUPABASE_SERVICE_ROLE_KEY=')
    expect(seedExample).toContain(
      'SEED_REZEPTION_PASSWORD=replace-with-a-local-password',
    )
    expect(seedExample).toContain(
      'SEED_BEHANDLER_PASSWORD=replace-with-a-local-password',
    )
    expect(seedExample).toContain(
      'SEED_PRAXISADMIN_PASSWORD=replace-with-a-local-password',
    )
    expect(`${appExample}\n${seedExample}`).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/)
    expect(`${appExample}\n${seedExample}`).not.toMatch(/sb_secret_[A-Za-z0-9_-]+/)
  })
})
