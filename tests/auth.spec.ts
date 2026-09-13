import { expect, test, type Page } from '@playwright/test'
import {
  createMfaTestAccount,
  currentTotpCode,
  deleteMfaTestAccount,
  type MfaTestAccount,
} from './support/mfa-test-accounts'

const accounts = [
  {
    name: 'Test Rezeption',
    role: 'Rezeption',
    userRole: 'rezeption',
  },
  {
    name: 'Dr. Test Behandler',
    role: 'Behandler',
    userRole: 'behandler',
  },
  {
    name: 'Test Praxisadministration',
    role: 'Praxisadministration',
    userRole: 'praxisadmin',
  },
] as const

const mfaAccounts: Partial<
  Record<(typeof accounts)[number]['userRole'], MfaTestAccount>
> = {}

function mfaAccount(role: (typeof accounts)[number]['userRole']) {
  const account = mfaAccounts[role]

  if (!account) {
    throw new Error('Das lokale MFA-Testkonto wurde nicht eingerichtet.')
  }

  return account
}

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
}

async function loginSuccessfully(page: Page, account: MfaTestAccount) {
  await submitLogin(page, account.email, account.password)
  await expect(
    page.getByRole('heading', { name: 'Sicherheitsprüfung' }),
  ).toBeVisible()
  await page.getByLabel('Code aus der Authenticator-App').fill(currentTotpCode(account.totpSecret))
  await page.getByRole('button', { name: 'Sicherheitsprüfung bestätigen' }).click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/status')
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  for (const account of accounts) {
    mfaAccounts[account.userRole] = await createMfaTestAccount({
      displayName: account.name,
      kind: 'practice',
      role: account.userRole,
    })
  }
})

test.afterAll(async () => {
  await Promise.all(
    Object.values(mfaAccounts)
      .filter((account): account is MfaTestAccount => Boolean(account))
      .map(deleteMfaTestAccount),
  )
})

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
  await submitLogin(page, mfaAccount(account.userRole).email, 'AbsichtlichFalsch1!')
  const credentialAlert = page.getByRole('alert').filter({
    hasText: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  })
  const existingAccountMessage = await credentialAlert.innerText()
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(mfaAccount(account.userRole).email)
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

  await page.getByLabel('E-Mail-Adresse').fill(mfaAccount(account.userRole).email)
  await page.getByLabel('Passwort').fill(mfaAccount(account.userRole).password)
  const submit = page.getByRole('button', { name: 'Sicher anmelden' })
  await submit.dblclick()

  await expect(
    page.getByRole('heading', { name: 'Sicherheitsprüfung' }),
  ).toBeVisible()
  expect(loginPosts).toBe(1)
})

for (const account of accounts) {
  test(`meldet ${account.role} an und zeigt nur den erwarteten Kontokontext`, async ({ page }) => {
    await loginSuccessfully(page, mfaAccount(account.userRole))

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

  await loginSuccessfully(page, mfaAccount(account.userRole))
  await page.goto('/login?next=/status')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/status')
  expect(new URL(page.url()).search).toBe('')

  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Bei DentPilot anmelden' })).toBeVisible()
  await expect(page.getByText('DentPilot Testpraxis', { exact: true })).toHaveCount(0)
})
