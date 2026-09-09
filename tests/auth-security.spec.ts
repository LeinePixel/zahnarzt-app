import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import {
  createMfaTestAccount,
  currentTotpCode,
  deleteMfaTestAccount,
  type MfaTestAccount,
} from './support/mfa-test-accounts'

let account: MfaTestAccount

async function login(page: Page, target = account) {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(target.email)
  await page.getByLabel('Passwort').fill(target.password)
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await expect(
    page.getByRole('heading', { name: 'Sicherheitsprüfung' }),
  ).toBeVisible()
  await page.getByLabel('Code aus der Authenticator-App').fill(currentTotpCode(target.totpSecret))
  await page.getByRole('button', { name: 'Sicherheitsprüfung bestätigen' }).click()
  await expect(page).toHaveURL(/\/status$/)

  if (target === account) {
    await expect(
      page.getByRole('heading', { name: 'Willkommen, Test Rezeption' }),
    ).toBeVisible()
  }
}

async function logoutEverywhere(context: BrowserContext) {
  await context.clearCookies()
  for (const page of context.pages()) {
    await page.evaluate(() => localStorage.clear()).catch(() => undefined)
  }
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  account = await createMfaTestAccount({
    displayName: 'Test Rezeption',
    kind: 'practice',
    role: 'rezeption',
  })
})

test.afterAll(async () => {
  await deleteMfaTestAccount(account)
})

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
  await expect(
    secondTab.getByRole('heading', { name: 'Willkommen, Test Rezeption' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
  await secondTab.reload()
  await expect(secondTab.getByText('DentPilot Testpraxis', { exact: true })).toHaveCount(0)
})

test('zeigt für ein synthetisches Auth-Konto ohne Profil einen sicheren Einrichtungszustand', async ({ page }) => {
  const incompleteAccount = await createMfaTestAccount({ kind: 'unassigned' })

  try {
    await login(page, incompleteAccount)
    await expect(page.getByText('Konto unvollständig eingerichtet')).toBeVisible()
    await expect(page.getByText('Es wurden keine Praxis- oder Patientendaten geladen.')).toBeVisible()
  } finally {
    await deleteMfaTestAccount(incompleteAccount)
  }
})
