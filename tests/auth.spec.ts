import { expect, test, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'

if (existsSync('.env.seed.local')) {
  process.loadEnvFile('.env.seed.local')
}

const accounts = [
  {
    email: 'seed-rezeption@dentpilot.example',
    name: 'Test Rezeption',
    passwordVariable: 'SEED_REZEPTION_PASSWORD',
    role: 'Rezeption',
  },
  {
    email: 'seed-behandler@dentpilot.example',
    name: 'Dr. Test Behandler',
    passwordVariable: 'SEED_BEHANDLER_PASSWORD',
    role: 'Behandler',
  },
  {
    email: 'seed-praxisadmin@dentpilot.example',
    name: 'Test Praxisadministration',
    passwordVariable: 'SEED_PRAXISADMIN_PASSWORD',
    role: 'Praxisadministration',
  },
] as const

function requiredPassword(variable: (typeof accounts)[number]['passwordVariable']) {
  const password = process.env[variable]

  if (!password) {
    throw new Error(`Fehlende E2E-Umgebungsvariable: ${variable}`)
  }

  return password
}

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
}

async function loginSuccessfully(page: Page, email: string, password: string) {
  await submitLogin(page, email, password)
  await expect.poll(() => new URL(page.url()).pathname).toBe('/status')
}

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies()
  await page.goto('/login')
})

test('zeigt die deutsche Anmeldung und validiert leere sowie ungültige Eingaben', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Bei DentPilot anmelden' })).toBeVisible()

  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await expect(page.getByText('E-Mail-Adresse ist erforderlich.')).toBeVisible()
  await expect(page.getByText('Passwort ist erforderlich.')).toBeVisible()

  await page.getByLabel('E-Mail-Adresse').fill('keine-adresse')
  await page.getByLabel('Passwort').fill('Irrelevant1!')
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await expect(page.getByText('Bitte geben Sie eine gültige E-Mail-Adresse ein.')).toBeVisible()
})

test('offenbart nicht, ob eine E-Mail-Adresse existiert', async ({ page }) => {
  const account = accounts[0]
  await submitLogin(page, account.email, 'AbsichtlichFalsch1!')
  const credentialAlert = page.getByRole('alert').filter({
    hasText: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  })
  const existingAccountMessage = await credentialAlert.innerText()
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(account.email)
  await expect(page.getByLabel('Passwort')).toHaveValue('')

  await page.getByLabel('E-Mail-Adresse').fill('nicht-vorhanden@dentpilot.example')
  await page.getByLabel('Passwort').fill('AbsichtlichFalsch1!')
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await expect(credentialAlert).toHaveText(existingAccountMessage)
})

test('unterbindet eine zweite Formularübermittlung während der Anmeldung', async ({ page }) => {
  const account = accounts[0]
  let loginPosts = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/login') {
      loginPosts += 1
    }
  })

  await page.getByLabel('E-Mail-Adresse').fill(account.email)
  await page.getByLabel('Passwort').fill(requiredPassword(account.passwordVariable))
  const submit = page.getByRole('button', { name: 'Sicher anmelden' })
  await submit.dblclick()

  await expect.poll(() => new URL(page.url()).pathname).toBe('/status')
  expect(loginPosts).toBe(1)
})

for (const account of accounts) {
  test(`meldet ${account.role} an und zeigt nur den erwarteten Kontokontext`, async ({ page }) => {
    await loginSuccessfully(page, account.email, requiredPassword(account.passwordVariable))

    await expect.poll(() => new URL(page.url()).pathname).toBe('/status')
    await expect(page.getByRole('heading', { name: `Willkommen, ${account.name}` })).toBeVisible()
    await expect(page.getByText(account.role, { exact: true })).toBeVisible()
    await expect(page.getByText('DentPilot Testpraxis', { exact: true })).toBeVisible()
    expect(new URL(page.url()).search).toBe('')

    await page.getByRole('button', { name: 'Abmelden' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
}

test('schützt direkte Aufrufe, Login-Redirect, Logout und Zurück-Navigation', async ({ page }) => {
  const account = accounts[0]

  await page.goto('/status?patient=verboten')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
  expect(new URL(page.url()).search).toBe('')

  await loginSuccessfully(page, account.email, requiredPassword(account.passwordVariable))
  await page.goto('/login?next=/status')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/status')
  expect(new URL(page.url()).search).toBe('')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Bei DentPilot anmelden' })).toBeVisible()
  await expect(page.getByText('DentPilot Testpraxis', { exact: true })).toHaveCount(0)
})
