import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { captureMfaEnrollment, loginWithSyntheticMfa, resetSyntheticMfa } from './helpers/mfa-login'

if (existsSync('.env.seed.local')) {
  process.loadEnvFile('.env.seed.local')
}

const account = {
  email: 'seed-rezeption@dentpilot.example',
  passwordVariable: 'SEED_REZEPTION_PASSWORD',
}

function required(variable: string) {
  const value = process.env[variable]

  if (!value) {
    throw new Error(`Fehlende E2E-Umgebungsvariable: ${variable}`)
  }

  return value
}

async function login(page: Page, email = account.email, password = required(account.passwordVariable)) {
  await loginWithSyntheticMfa(page, email, password)
}

async function logoutEverywhere(context: BrowserContext) {
  await context.clearCookies()
  for (const page of context.pages()) {
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
  }
}

async function findExactUserIds(admin: SupabaseClient, email: string) {
  const ids: string[] = []
  const perPage = 100

  for (let page = 1; ; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage })
    expect(listed.error).toBeNull()

    ids.push(
      ...listed.data.users
        .filter((user) => user.email === email)
        .map((user) => user.id),
    )

    if (listed.data.users.length < perPage) {
      return ids
    }
  }
}

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ context }) => {
  await logoutEverywhere(context)
})

test('setzt query-freie Redirects und private no-store auf geschützten Antworten', async ({ page }) => {
  const redirectResponse = await page.request.get('/status?sensitive=never', {
    maxRedirects: 0,
  })
  expect(redirectResponse.status()).toBe(307)
  const redirectLocation = new URL(
    redirectResponse.headers()['location'],
    'http://localhost:3100',
  )
  expect(redirectLocation.pathname).toBe('/login')
  expect(redirectLocation.search).toBe('')
  expect(redirectResponse.headers()['cache-control']).toContain('private')
  expect(redirectResponse.headers()['cache-control']).toContain('no-store')

  await page.goto('/status?sensitive=never')
  await expect(page).toHaveURL(/\/login$/)
  expect(new URL(page.url()).search).toBe('')

  await login(page)
  const protectedResponse = await page.reload()
  expect(protectedResponse?.headers()['cache-control']).toContain('private')
  expect(protectedResponse?.headers()['cache-control']).toContain('no-store')
})

test('speichert die Supabase-Sitzung nicht in Local Storage', async ({ page }) => {
  await login(page)

  const localStorageKeys = await page.evaluate(() => Object.keys(localStorage))
  expect(localStorageKeys.filter((key) => key.includes('supabase') || key.startsWith('sb-'))).toEqual([])
})

test('weist einen falschen MFA-Code neutral zurück und lässt erst den gültigen Code weiter', async ({ page }) => {
  await resetSyntheticMfa(account.email)
  const completeMfa = captureMfaEnrollment(page)
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(account.email)
  await page.getByLabel('Passwort').fill(required(account.passwordVariable))
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await expect(page).toHaveURL(/\/auth\/mfa$/)
  await page.getByLabel('Sicherheitscode').fill(await completeMfa.invalidCode())
  const confirmCode = page.getByRole('button', { name: 'Code bestätigen' })
  await expect(confirmCode).toBeEnabled()
  await confirmCode.click()
  await expect(page.getByText('Der Sicherheitscode konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.')).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/mfa$/)
  await expect(page.getByText('DentPilot Testpraxis', { exact: true })).toHaveCount(0)

  await completeMfa()
  await expect(page.getByText('DentPilot Testpraxis', { exact: true })).toBeVisible()
})

test('erzeugt produktive Auth-Cookies mit Secure und SameSite=Lax', async ({ page, context }) => {
  await login(page)

  const authCookies = (await context.cookies()).filter(cookie => cookie.name.startsWith('sb-'))
  expect(authCookies.length).toBeGreaterThan(0)
  for (const cookie of authCookies) {
    expect(cookie.secure).toBe(true)
    expect(cookie.sameSite).toBe('Lax')
  }

  const response = await page.reload()
  const headers = response?.headers() ?? {}
  expect(headers['content-security-policy']).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/)
  expect(headers['content-security-policy']).not.toContain("'unsafe-inline'")
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toBe('same-origin')
  expect(headers['cache-control']).toContain('private')
  expect(headers['cache-control']).toContain('no-store')
})

test('entzieht einem zweiten Tab nach Logout beim nächsten Request den Zugriff', async ({ context, page }) => {
  await login(page)
  const secondTab = await context.newPage()
  await secondTab.goto('/status')
  await expect(secondTab.getByText('DentPilot Testpraxis', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
  await secondTab.reload()
  await expect(secondTab.getByText('DentPilot Testpraxis', { exact: true })).toHaveCount(0)
})

test('nimmt eine gültige Cookie-Sitzung nach einem Browserneustart wieder auf', async ({ browser, page }) => {
  await login(page)
  const storageState = await page.context().storageState()
  const restartedContext = await browser.newContext({ storageState })
  const restartedPage = await restartedContext.newPage()

  try {
    await restartedPage.goto('/status')
    await expect(restartedPage.getByText('DentPilot Testpraxis', { exact: true })).toBeVisible()
    await expect(restartedPage).toHaveURL(/\/status$/)
  } finally {
    await restartedContext.close()
  }
})

test('zeigt für ein synthetisches Auth-Konto ohne Profil einen sicheren Einrichtungszustand', async ({ page }) => {
  const email = `e2e-incomplete-${randomUUID()}@dentpilot.example`
  const password = `E2e!${randomUUID()}Aa1`
  const admin: SupabaseClient = createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  let userId: string | undefined

  try {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    })
    expect(created.error).toBeNull()
    userId = created.data.user?.id
    expect(userId).toBeTruthy()

    await login(page, email, password)
    await expect(page.getByText('Konto unvollständig eingerichtet')).toBeVisible()
    await expect(page.getByText('Es wurden keine Praxis- oder Patientendaten geladen.')).toBeVisible()
  } finally {
    if (!userId) {
      const exactIds = await findExactUserIds(admin, email)
      expect(exactIds).toHaveLength(1)
      userId = exactIds[0]
    }

    if (userId) {
      const existing = await admin.auth.admin.getUserById(userId)
      expect(existing.data.user?.email).toBe(email)
      const deleted = await admin.auth.admin.deleteUser(userId)
      expect(deleted.error).toBeNull()
    }
  }
})
