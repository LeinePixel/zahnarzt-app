import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

if (existsSync('.env.local')) {
  const appEnvironment = readFileSync('.env.local', 'utf8')
  const forbiddenServerSecrets = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SEED_REZEPTION_PASSWORD',
    'SEED_BEHANDLER_PASSWORD',
    'SEED_PRAXISADMIN_PASSWORD',
  ].filter((name) => new RegExp(`^\\s*${name}\\s*=`, 'm').test(appEnvironment))

  if (forbiddenServerSecrets.length > 0) {
    throw new Error(
      `Seed-Geheimnisse müssen aus .env.local nach .env.seed.local verschoben werden: ${forbiddenServerSecrets.join(', ')}`,
    )
  }

  process.loadEnvFile('.env.local')
}

const edgeExecutable = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync)
const edgeRequired = process.env.E2E_REQUIRE_EDGE === '1'

if (edgeRequired && !edgeExecutable) {
  throw new Error('Microsoft Edge ist für diesen Abnahmelauf erforderlich, wurde aber nicht gefunden.')
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      testMatch: /baseline\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /baseline\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    ...(edgeExecutable
      ? [
          {
            name: 'edge',
            testMatch: /baseline\.spec\.ts/,
            use: { ...devices['Desktop Edge'], channel: 'msedge' as const },
          },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run start:e2e',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
  },
})
