import { createHmac, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import { expect } from '@playwright/test'

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
}

if (existsSync('.env.seed.local')) {
  process.loadEnvFile('.env.seed.local')
}

export type MfaTestAccount = {
  email: string
  password: string
  totpSecret: string
  userId: string
}

type AccountIdentity =
  | { displayName: string; kind: 'practice'; role: 'rezeption' | 'behandler' | 'praxisadmin' }
  | { kind: 'portal' }
  | { kind: 'unassigned' }

const testPracticeName = 'DentPilot Testpraxis'

function required(variable: string) {
  const value = process.env[variable]

  if (!value) {
    throw new Error(`Fehlende lokale E2E-Umgebungsvariable: ${variable}`)
  }

  return value
}

function base32Decode(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const character of secret.replace(/\s/g, '').replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(character)

    if (index < 0) {
      throw new Error('Ungültiges lokales TOTP-Testgeheimnis.')
    }

    value = (value << 5) | index
    bits += 5

    while (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 0xff)
    }
  }

  return Buffer.from(bytes)
}

export function currentTotpCode(secret: string, now = Date.now()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)))

  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const value =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3]

  return String(value % 1_000_000).padStart(6, '0')
}

function serviceAdmin() {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function createMfaTestAccount(identity: AccountIdentity): Promise<MfaTestAccount> {
  const admin = serviceAdmin()
  const email = `e2e-mfa-${randomUUID()}@dentpilot.example`
  const password = `E2e!${randomUUID()}Aa1`
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  })

  expect(created.error).toBeNull()
  const userId = created.data.user?.id

  if (!userId) {
    throw new Error('Lokales MFA-Testkonto konnte nicht angelegt werden.')
  }

  if (identity.kind === 'practice') {
    const practice = await admin
      .from('practice')
      .select('id')
      .eq('name', testPracticeName)
      .single()

    expect(practice.error).toBeNull()
    expect(practice.data?.id).toBeTruthy()
    const profile = await admin.from('user_profile').upsert({
      display_name: identity.displayName,
      practice_id: practice.data!.id,
      role: identity.role,
      user_id: userId,
    })
    expect(profile.error).toBeNull()
  } else if (identity.kind === 'portal') {
    const portalAdmin = await admin.from('portal_admin').upsert({ user_id: userId })
    expect(portalAdmin.error).toBeNull()
  }

  const auth = createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const signedIn = await auth.auth.signInWithPassword({ email, password })
  expect(signedIn.error).toBeNull()
  const enrolled = await auth.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'DentPilot E2E',
  })

  expect(enrolled.error).toBeNull()
  if (!enrolled.data || enrolled.data.type !== 'totp') {
    throw new Error('Lokaler TOTP-Faktor konnte nicht eingeschrieben werden.')
  }

  const verified = await auth.auth.mfa.challengeAndVerify({
    code: currentTotpCode(enrolled.data.totp.secret),
    factorId: enrolled.data.id,
  })
  expect(verified.error).toBeNull()

  return { email, password, totpSecret: enrolled.data.totp.secret, userId }
}

export async function deleteMfaTestAccount(account: MfaTestAccount) {
  const admin = serviceAdmin()
  // Dynamic accounts exist only in the local E2E stack. Audit rows deliberately
  // restrict Auth-user deletion, so remove this account's synthetic evidence
  // before tearing down its related support grant and identity.
  const auditEvents = await admin
    .from('audit_event')
    .delete()
    .eq('actor_id', account.userId)
  expect(auditEvents.error).toBeNull()

  const requestedGrants = await admin
    .from('support_access_grant')
    .delete()
    .eq('requested_by', account.userId)
  expect(requestedGrants.error).toBeNull()

  const activatedGrants = await admin
    .from('support_access_grant')
    .delete()
    .eq('activated_by', account.userId)
  expect(activatedGrants.error).toBeNull()

  const deleted = await admin.auth.admin.deleteUser(account.userId)
  expect(deleted.error).toBeNull()
}
