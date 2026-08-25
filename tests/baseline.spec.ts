import { expect, test } from '@playwright/test'

test('serves the application shell with a main landmark', async ({ page }) => {
  const response = await page.goto('/')

  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('main')).toBeVisible()
})
