import { expect, test, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'

if (existsSync('.env.seed.local')) {
  process.loadEnvFile('.env.seed.local')
}

const practiceAdmin = {
  email: 'seed-praxisadmin@dentpilot.example',
  passwordVariable: 'SEED_PRAXISADMIN_PASSWORD',
}

const portalAdmin = {
  email: 'seed-portaladmin@dentpilot.example',
  passwordVariable: 'SEED_PORTALADMIN_PASSWORD',
}

const foreignPracticeId = '4c25a8d1-3b5f-4f1d-a5a6-8027c7c2e002'

function requiredSeedCredential(
  variable:
    | typeof practiceAdmin.passwordVariable
    | typeof portalAdmin.passwordVariable,
) {
  const credential = process.env[variable]

  if (!credential) {
    throw new Error('Die lokale E2E-Seed-Konfiguration ist nicht vollständig.')
  }

  return credential
}

async function login(page: Page, email: string, credential: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(credential)
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await expect(page).toHaveURL(/\/status$/)
}

test.describe.configure({ mode: 'serial' })

test('schützt eine praxisfreigegebene Audit-Einsicht vollständig', async ({
  browser,
}) => {
  const practiceContext = await browser.newContext()
  const portalContext = await browser.newContext()
  const practicePage = await practiceContext.newPage()
  const portalPage = await portalContext.newPage()

  try {
    await login(
      practicePage,
      practiceAdmin.email,
      requiredSeedCredential(practiceAdmin.passwordVariable),
    )
    await practicePage.getByRole('button', { name: 'Supportzugriff anfordern' }).click()

    const grantId = await practicePage.locator('output code').textContent()

    if (!grantId) {
      throw new Error('Die Freigabekennung wurde nicht angezeigt.')
    }

    await login(
      portalPage,
      portalAdmin.email,
      requiredSeedCredential(portalAdmin.passwordVariable),
    )
    await portalPage.goto(`/portal/audit?practiceId=${grantId}`)
    await expect(
      portalPage.getByText('Audit-Zugriff wurde verweigert.'),
    ).toBeVisible()
    await expect(portalPage.getByRole('table')).toHaveCount(0)

    await portalPage.goto('/portal/audit')
    await portalPage.getByLabel('Freigabekennung').fill(grantId)
    await portalPage.getByRole('button', { name: 'Supportzugriff aktivieren' }).click()
    await expect(portalPage).toHaveURL(/\/portal\/audit\?practiceId=/)

    const allowedPracticeId = new URL(portalPage.url()).searchParams.get(
      'practiceId',
    )

    if (!allowedPracticeId) {
      throw new Error('Die aktivierte Praxis wurde nicht angezeigt.')
    }

    await expect(portalPage.getByRole('table')).toBeVisible()
    await expect(portalPage.getByText(/export/i)).toHaveCount(0)

    await portalPage.goto(`/portal/audit?practiceId=${foreignPracticeId}`)
    await expect(
      portalPage.getByText('Audit-Zugriff wurde verweigert.'),
    ).toBeVisible()
    await expect(portalPage.getByRole('table')).toHaveCount(0)

    await practicePage.getByLabel('Freigabekennung widerrufen').fill(grantId)
    await practicePage.getByRole('button', { name: 'Supportzugriff widerrufen' }).click()
    await expect(
      practicePage.getByText('Supportzugriff wurde widerrufen.'),
    ).toBeVisible()

    await portalPage.goto(`/portal/audit?practiceId=${allowedPracticeId}`)
    await expect(
      portalPage.getByText('Audit-Zugriff wurde verweigert.'),
    ).toBeVisible()
    await expect(portalPage.getByRole('table')).toHaveCount(0)
  } finally {
    await practiceContext.close()
    await portalContext.close()
  }
})
