// @vitest-environment node
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import { spawn } from 'node:child_process'
import { afterEach, expect, it } from 'vitest'
import { createMockPvsServer } from '../services/mock-pvs/router'
import { loadMockPvsConfig } from '../services/mock-pvs/config'
import { createLocalDatabaseFixture } from '../src/features/patients/test/local-database'

let server: Server | undefined
let fixture: Awaited<ReturnType<typeof createLocalDatabaseFixture>> | undefined
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
  await fixture?.close()
  server = undefined; fixture = undefined
})

it('imports 26 synthetic patients through the real restricted CLI process', async () => {
  const readToken = randomBytes(32).toString('hex')
  const testToken = randomBytes(32).toString('hex')
  server = createMockPvsServer(loadMockPvsConfig({ MOCK_PVS_PORT: '3181', MOCK_PVS_READ_TOKEN: readToken, MOCK_PVS_TEST_TOKEN: testToken }))
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Synthetic server unavailable')
  fixture = await createLocalDatabaseFixture()
  const childEnvironment: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    PATIENT_SYNC_SYNTHETIC_ONLY: '1',
    PATIENT_SYNC_DATABASE_URL: fixture.runtimeUrl,
    MOCK_PVS_BASE_URL: `http://127.0.0.1:${address.port}`,
    MOCK_PVS_READ_TOKEN: readToken,
  }
  for (const name of ['SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP']) if (process.env[name]) childEnvironment[name] = process.env[name]
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--conditions=react-server', '--import=tsx', 'scripts/run-patient-sync.ts'], { cwd: process.cwd(), env: childEnvironment })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
  expect(result).toEqual({ code: 0, stdout: 'Patientensync abgeschlossen.\n', stderr: '' })
  const observed = await fixture.admin.query('select count(*)::int as count from public.patient where integration_id=$1', [fixture.integrationId])
  expect(observed.rows[0].count).toBe(26)
})
