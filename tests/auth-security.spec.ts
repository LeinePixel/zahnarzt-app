import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

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
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await expect(page).toHaveURL(/\/status$/)
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
