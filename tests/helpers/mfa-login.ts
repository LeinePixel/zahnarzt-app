import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Fehlende E2E-Umgebungsvariable: ${name}`)
  return value
}

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const character of value.replace(/=+$/u, '').toUpperCase()) {
    const index = alphabet.indexOf(character)
    if (index < 0) throw new Error('Synthetischer TOTP-Faktor ist ungültig.')
    bits += index.toString(2).padStart(5, '0')
  }
  return Buffer.from((bits.match(/.{8}/gu) ?? []).map(byte => Number.parseInt(byte, 2)))
}

function totp(secret: string) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return binary.toString().padStart(6, '0')
}

async function exactUserId(email: string) {
  const admin = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
  expect(listed.error).toBeNull()
  const users = listed.data.users.filter(user => user.email === email)
  expect(users).toHaveLength(1)
  return { admin, userId: users[0]!.id }
}

export async function resetSyntheticMfa(email: string) {
  const { admin, userId } = await exactUserId(email)
  const listed = await admin.auth.admin.mfa.listFactors({ userId })
  expect(listed.error).toBeNull()
  for (const factor of listed.data?.factors ?? []) {
    const deleted = await admin.auth.admin.mfa.deleteFactor({ userId, id: factor.id })
    expect(deleted.error).toBeNull()
  }
}

export function captureMfaEnrollment(page: Page) {
  let secret: string | undefined
  page.on('response', async response => {
    const path = new URL(response.url()).pathname
    if (response.request().method() !== 'POST' || !path.endsWith('/factors')) return
    const payload = await response.json().catch(() => null) as { totp?: { secret?: unknown } } | null
    if (typeof payload?.totp?.secret === 'string') secret = payload.totp.secret
  })
  return async () => {
    await expect(page).toHaveURL(/\/auth\/mfa$/)
    await expect.poll(() => secret).toBeTruthy()
    await page.getByLabel('Sicherheitscode').fill(totp(secret!))
    await page.getByRole('button', { name: 'Code bestätigen' }).click()
    await expect(page).toHaveURL(/\/status$/)
  }
}

export async function loginWithSyntheticMfa(page: Page, email: string, password: string) {
  await resetSyntheticMfa(email)
  const completeMfa = captureMfaEnrollment(page)
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await completeMfa()
}
