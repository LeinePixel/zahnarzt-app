import { expect, test, type Page } from '@playwright/test'

import { E2E_FOREIGN_PRACTICE_ID } from '../supabase/seed-fixtures'
import {
  createMfaTestAccount,
  currentTotpCode,
  deleteMfaTestAccount,
  type MfaTestAccount,
} from './support/mfa-test-accounts'

async function login(
  page: Page,
  account: MfaTestAccount,
  expectedHeading: string,
) {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(account.email)
  await page.getByLabel('Passwort').fill(account.password)
  await page.getByRole('button', { name: 'Sicher anmelden' }).click()
  await expect(
    page.getByRole('heading', { name: 'Sicherheitsprüfung' }),
  ).toBeVisible()
  await page
    .getByLabel('Code aus der Authenticator-App')
    .fill(currentTotpCode(account.totpSecret))
  await page.getByRole('button', { name: 'Sicherheitsprüfung bestätigen' }).click()
  await expect(page).toHaveURL(/\/status$/)
  await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible()
}

test.describe.configure({ mode: 'serial' })

test('schützt eine praxisfreigegebene Audit-Einsicht vollständig', async ({
  browser,
}) => {
  let practiceAdmin: MfaTestAccount | undefined
  let portalAdmin: MfaTestAccount | undefined
  const practiceContext = await browser.newContext()
  const portalContext = await browser.newContext()
  const practicePage = await practiceContext.newPage()
  const portalPage = await portalContext.newPage()

  try {
    practiceAdmin = await createMfaTestAccount({
      displayName: 'Test Praxisadministration',
      kind: 'practice',
      role: 'praxisadmin',
    })
    portalAdmin = await createMfaTestAccount({ kind: 'portal' })
    await login(
      practicePage,
      practiceAdmin,
      'Willkommen, Test Praxisadministration',
    )
    await practicePage.getByRole('button', { name: 'Supportzugriff anfordern' }).click()

    const grantId = await practicePage.locator('output code').textContent()

    if (!grantId) {
      throw new Error('Die Freigabekennung wurde nicht angezeigt.')
    }

    await login(
      portalPage,
      portalAdmin,
      'Anbieter-Supportportal',
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
    for (const role of ['button', 'link', 'menuitem'] as const) {
      await expect(
        portalPage.getByRole(role, { name: /export/i }),
      ).toHaveCount(0)
    }

    await portalPage.goto(
      `/portal/audit?practiceId=${E2E_FOREIGN_PRACTICE_ID}`,
    )
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
    if (practiceAdmin) await deleteMfaTestAccount(practiceAdmin)
    if (portalAdmin) await deleteMfaTestAccount(portalAdmin)
  }
})
