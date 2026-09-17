// @vitest-environment node
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import type { Server } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { createMockPvsServer } from '../services/mock-pvs/router'
import { loadMockPvsConfig } from '../services/mock-pvs/config'
import { PostgresPatientSyncRepository } from '../src/features/patients/postgres-sync-repository'
import { createLocalAppointmentDatabaseFixture } from '../src/features/appointments/test/local-database'

let server: Server | undefined
let fixture: Awaited<ReturnType<typeof createLocalAppointmentDatabaseFixture>> | undefined

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server!.close(error => error ? reject(error) : resolve()))
  }
  await fixture?.close()
  server = undefined
  fixture = undefined
})

async function startMock() {
  const readToken = randomBytes(32).toString('hex')
  const testToken = randomBytes(32).toString('hex')
  server = createMockPvsServer(loadMockPvsConfig({
    MOCK_PVS_PORT: '3181', MOCK_PVS_READ_TOKEN: readToken, MOCK_PVS_TEST_TOKEN: testToken,
  }))
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Synthetic server unavailable')
  return { readToken, baseUrl: `http://127.0.0.1:${address.port}` }
}

async function seedMockPatients() {
  if (!fixture) throw new Error('Fixture unavailable')
  for (let index = 1; index <= 26; index += 1) {
    const sourceId = `mock-patient-${String(index).padStart(3, '0')}`
    await fixture.admin.query(`insert into public.patient(
      practice_id,integration_id,source_id,source_version,first_name,last_name,birth_date,
      phone_e164,source_created_at,source_updated_at
    ) values($1,$2,$3,1,'Synthetic','Mock','2000-01-01','+491234567','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`, [fixture.practiceId, fixture.integrationId, sourceId])
  }
}

async function runProcess(mock: { readToken: string; baseUrl: string }) {
  if (!fixture) throw new Error('Fixture unavailable')
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    APPOINTMENT_SYNC_SYNTHETIC_ONLY: '1',
    APPOINTMENT_SYNC_DATABASE_URL: fixture.appointmentRuntimeUrl,
    MOCK_PVS_BASE_URL: mock.baseUrl,
    MOCK_PVS_READ_TOKEN: mock.readToken,
  }
  for (const name of ['SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP']) {
    if (process.env[name]) environment[name] = process.env[name]
  }
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--conditions=react-server', '--import=tsx', 'scripts/run-appointment-sync.ts',
    ], { cwd: process.cwd(), env: environment, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
}

it('imports synthetic appointments idempotently through the restricted CLI process', async () => {
  const mock = await startMock()
  fixture = await createLocalAppointmentDatabaseFixture()
  await seedMockPatients()
  expect(await runProcess(mock)).toEqual({ code: 0, stdout: 'Terminsync abgeschlossen.\n', stderr: '' })
  expect(await runProcess(mock)).toEqual({ code: 0, stdout: 'Terminsync abgeschlossen.\n', stderr: '' })
  const observed = await fixture.admin.query(
    'select count(*)::int as count,count(distinct patient_id)::int as patients from public.appointment where integration_id=$1',
    [fixture.integrationId],
  )
  expect(observed.rows[0]).toEqual({ count: 26, patients: 26 })
})

it('rolls back and keeps the checkpoint when a source patient is missing', async () => {
  const mock = await startMock()
  fixture = await createLocalAppointmentDatabaseFixture()
  expect(await runProcess(mock)).toEqual({ code: 1, stdout: 'Terminsync fehlgeschlagen.\n', stderr: '' })
  expect((await fixture.admin.query(
    'select count(*)::int as count from public.appointment where integration_id=$1',
    [fixture.integrationId],
  )).rows[0].count).toBe(0)
  expect((await fixture.admin.query(
    'select initial_import_completed,confirmed_change_cursor from private.appointment_sync_checkpoint where integration_id=$1',
    [fixture.integrationId],
  )).rows[0]).toEqual({ initial_import_completed: false, confirmed_change_cursor: null })
})

it('returns exit 2 before source work while patient sync owns the shared lock', async () => {
  const mock = await startMock()
  fixture = await createLocalAppointmentDatabaseFixture()
  const patientRepository = new PostgresPatientSyncRepository(fixture.patientRuntimeUrl)
  expect((await patientRepository.acquire(new AbortController().signal)).ok).toBe(true)
  expect(await runProcess(mock)).toEqual({
    code: 2, stdout: 'Terminsync derzeit nicht möglich.\n', stderr: '',
  })
  await patientRepository.close()
})
