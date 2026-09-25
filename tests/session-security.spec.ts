import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { Client } from 'pg'
import { loginWithSyntheticMfa } from './helpers/mfa-login'

if (existsSync('.env.seed.local')) process.loadEnvFile('.env.seed.local')

const email = 'seed-rezeption@dentpilot.example'
test.describe.configure({ mode: 'serial' })

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Fehlende E2E-Umgebungsvariable: ${name}`)
  return value
}

test('verweigert einem vor Logout abgegriffenen synthetischen Token den direkten Datenzugriff', async ({ page, request }) => {
  let stolenToken: string | undefined
  page.on('response', async response => {
    if (response.request().method() !== 'POST' || !new URL(response.url()).pathname.endsWith('/verify')) return
    const payload = await response.json().catch(() => null) as { access_token?: unknown } | null
    if (typeof payload?.access_token === 'string') stolenToken = payload.access_token
  })

  await loginWithSyntheticMfa(page, email, required('SEED_REZEPTION_PASSWORD'))
  await expect.poll(() => stolenToken).toBeTruthy()

  const readPractice = async () => {
    const response = await request.get(`${required('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/practice?select=id`, {
      headers: {
        apikey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        Authorization: `Bearer ${stolenToken}`,
      },
    })
    return response.ok() ? response.json() as Promise<unknown> : null
  }
  const readSessionRemaining = async () => {
    const response = await request.post(`${required('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/rpc/current_session_remaining_ms`, {
      headers: {
        apikey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        Authorization: `Bearer ${stolenToken}`,
      },
      data: {},
    })
    return response.ok() ? Number(await response.json()) : 0
  }

  await expect(readPractice()).resolves.toHaveLength(1)
  expect(await readSessionRemaining()).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(async () => {
    const result = await readPractice()
    return result === null || (Array.isArray(result) && result.length === 0)
  }).toBe(true)
  await expect.poll(readSessionRemaining).toBe(0)
})

test('verweigert eine nach fünf Minuten abgelaufene Sitzung auch nach Browserneustart', async ({ browser, page, request }) => {
  const expiredSessionEmail = 'seed-behandler@dentpilot.example'
  let accessToken: string | undefined
  page.on('response', async response => {
    if (response.request().method() !== 'POST' || !new URL(response.url()).pathname.endsWith('/verify')) return
    const payload = await response.json().catch(() => null) as { access_token?: unknown } | null
    if (typeof payload?.access_token === 'string') accessToken = payload.access_token
  })
  await loginWithSyntheticMfa(page, expiredSessionEmail, required('SEED_BEHANDLER_PASSWORD'))
  await expect.poll(() => accessToken).toBeTruthy()
  const storageState = await page.context().storageState()

  const status = JSON.parse(execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })) as { DB_URL?: string }
  const databaseUrl = new URL(status.DB_URL ?? '')
  if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) || databaseUrl.port !== '55422') {
    throw new Error('Der Browser-Sicherheitstest benötigt ausschließlich die lokale synthetische Datenbank.')
  }
  const claims = JSON.parse(Buffer.from(accessToken!.split('.')[1]!, 'base64url').toString('utf8')) as { session_id?: string }
  expect(claims.session_id).toBeTruthy()
  const database = new Client({ connectionString: databaseUrl.toString() })
  await database.connect()
  try {
    const changed = await database.query(
      `update private.session_security_state
       set started_at = least(started_at, now() - interval '6 minutes'),
           last_human_activity_at = now() - interval '5 minutes'
       where session_id = $1`,
      [claims.session_id],
    )
    expect(changed.rowCount).toBe(1)
  } finally {
    await database.end()
  }

  const restartedContext = await browser.newContext({ storageState })
  try {
    const restartedPage = await restartedContext.newPage()
    await restartedPage.goto('/status')
    await expect(restartedPage.getByRole('heading', { name: 'Bei DentPilot anmelden' })).toBeVisible()
    await expect(restartedPage.getByText('DentPilot Testpraxis', { exact: true })).toHaveCount(0)
    const response = await request.get(`${required('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/practice?select=id`, {
      headers: {
        apikey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (response.ok()) await expect(response.json()).resolves.toHaveLength(0)
    const rpcResponse = await request.post(`${required('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/rpc/current_session_remaining_ms`, {
      headers: {
        apikey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        Authorization: `Bearer ${accessToken}`,
      },
      data: {},
    })
    if (rpcResponse.ok()) expect(Number(await rpcResponse.json())).toBe(0)
  } finally {
    await restartedContext.close()
  }
})
