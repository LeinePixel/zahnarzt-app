import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from 'pg'

function adminUrl(): string {
  const text = readFileSync(resolve('.env.patient-sync-admin.local'), 'utf8')
  const line = text.split(/\r?\n/).find(value => value.startsWith('PATIENT_SYNC_ADMIN_DATABASE_URL='))
  const value = line?.slice('PATIENT_SYNC_ADMIN_DATABASE_URL='.length)
  if (!value) throw new Error('Lokale Patientensync-Testdatenbank fehlt.')
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) || !url.port) throw new Error('Lokale Patientensync-Testdatenbank ist ungültig.')
  return value
}

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`

export async function createLocalDatabaseFixture() {
  const admin = new Client({ connectionString: adminUrl() })
  await admin.connect()
  const suffix = randomBytes(8).toString('hex')
  const role = `dentpilot_sync_test_${suffix}`
  const password = randomBytes(24).toString('hex')
  const practiceId = randomUUID()
  const integrationId = randomUUID()
  const escapedPassword = password.replaceAll("'", "''")
  await admin.query('insert into public.practice(id,name) values($1,$2)', [practiceId, `Synthetic sync ${suffix}`])
  await admin.query("insert into public.integration(id,practice_id,provider) values($1,$2,'mock_pvs')", [integrationId, practiceId])
  await admin.query(`create role ${quoteIdentifier(role)} login password '${escapedPassword}' nosuperuser nobypassrls nocreatedb nocreaterole noreplication`)
  await admin.query(`grant dentpilot_patient_sync_executor to ${quoteIdentifier(role)}`)
  await admin.query(`alter role ${quoteIdentifier(role)} set log_statement = 'none'`)
  await admin.query(`alter role ${quoteIdentifier(role)} set log_min_error_statement = 'panic'`)
  await admin.query(`alter role ${quoteIdentifier(role)} set log_parameter_max_length = 0`)
  await admin.query(`alter role ${quoteIdentifier(role)} set log_parameter_max_length_on_error = 0`)
  await admin.query('insert into private.patient_sync_executor(database_role,integration_id,practice_id) values($1,$2,$3)', [role, integrationId, practiceId])
  const url = new URL(adminUrl())
  url.username = role; url.password = password
  return {
    admin,
    integrationId,
    practiceId,
    runtimeUrl: url.toString(),
    async close() {
      await admin.query('delete from private.patient_sync_executor where database_role=$1', [role])
      await admin.query('delete from public.integration where id=$1', [integrationId])
      await admin.query('delete from public.practice where id=$1', [practiceId])
      await admin.query(`drop role if exists ${quoteIdentifier(role)}`)
      await admin.end()
    },
  }
}
