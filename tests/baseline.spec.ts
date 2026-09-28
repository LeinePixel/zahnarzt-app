import { expect, test } from '@playwright/test'

test('serves the application shell with a main landmark', async ({ page }) => {
  const response = await page.goto('/')

  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('main')).toBeVisible()
})

test('renders the optimized login logo without CSP violations', async ({ page }) => {
  await page.addInitScript(() => {
    const monitoredWindow = window as Window & { cspViolations?: string[] }
    monitoredWindow.cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.effectiveDirective === 'style-src' || event.effectiveDirective === 'script-src') {
        monitoredWindow.cspViolations?.push(`${event.effectiveDirective}:${event.blockedURI}`)
      }
    })
  })

  const response = await page.goto('/login', { waitUntil: 'networkidle' })
  expect(response?.headers()['content-security-policy']).toContain("script-src")
  const logo = page.getByRole('img', { name: 'DentPilot' })
  expect(await logo.getAttribute('style')).toBeNull()
  expect(await logo.getAttribute('srcset')).toContain('/_next/image?')
  const violations = await page.evaluate(() =>
    (window as Window & { cspViolations?: string[] }).cspViolations ?? [],
  )
  expect(violations).toEqual([])
})
