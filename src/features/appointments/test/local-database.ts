import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from 'pg'

function adminUrl(): string {
  const text = readFileSync(resolve('.env.patient-sync-admin.local'), 'utf8')
  const line = text.split(/\r?\n/).find(value => value.startsWith('PATIENT_SYNC_ADMIN_DATABASE_URL='))
  const value = line?.slice('PATIENT_SYNC_ADMIN_DATABASE_URL='.length)
  if (!value) throw new Error('Lokale Terminsync-Testdatenbank fehlt.')
  const url = new URL(value)
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || !url.port
  ) throw new Error('Lokale Terminsync-Testdatenbank ist ungültig.')
  return value
}

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`

async function createRuntimeRole(
  admin: Client,
  prefix: string,
  group: 'dentpilot_appointment_sync_executor' | 'dentpilot_patient_sync_executor',
  mappingTable: 'appointment_sync_executor' | 'patient_sync_executor',
  integrationId: string,
  practiceId: string,
) {
  const suffix = randomBytes(8).toString('hex')
  const role = `${prefix}_${suffix}`
  const password = randomBytes(24).toString('hex')
  const escapedPassword = password.replaceAll("'", "''")
  await admin.query(`create role ${quoteIdentifier(role)} login password '${escapedPassword}' nosuperuser nobypassrls nocreatedb nocreaterole noreplication`)
  await admin.query(`grant ${group} to ${quoteIdentifier(role)}`)
  await admin.query(`alter role ${quoteIdentifier(role)} set log_statement = 'none'`)
  await admin.query(`alter role ${quoteIdentifier(role)} set log_min_error_statement = 'panic'`)
  await admin.query(`alter role ${quoteIdentifier(role)} set log_parameter_max_length = 0`)
  await admin.query(`alter role ${quoteIdentifier(role)} set log_parameter_max_length_on_error = 0`)
  await admin.query(
    `insert into private.${mappingTable}(database_role,integration_id,practice_id) values($1,$2,$3)`,
    [role, integrationId, practiceId],
  )
  const url = new URL(adminUrl())
  url.username = role
  url.password = password
  return { role, runtimeUrl: url.toString(), mappingTable }
}

export async function createLocalAppointmentDatabaseFixture() {
  const admin = new Client({ connectionString: adminUrl() })
  await admin.connect()
  const suffix = randomBytes(8).toString('hex')
  const practiceId = randomUUID()
  const integrationId = randomUUID()
  const patientId = randomUUID()
  await admin.query('insert into public.practice(id,name) values($1,$2)', [practiceId, `Synthetic appointments ${suffix}`])
  await admin.query("insert into public.integration(id,practice_id,provider) values($1,$2,'mock_pvs')", [integrationId, practiceId])
  await admin.query(`insert into public.patient(
    id,practice_id,integration_id,source_id,source_version,first_name,last_name,birth_date,
    phone_e164,source_created_at,source_updated_at
  ) values($1,$2,$3,'synthetic-patient',1,'Synthetic','Patient','2000-01-01','+491234567','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')`, [patientId, practiceId, integrationId])
  const appointment = await createRuntimeRole(
    admin, 'dentpilot_appointment_sync_test', 'dentpilot_appointment_sync_executor',
    'appointment_sync_executor', integrationId, practiceId,
  )
  const patient = await createRuntimeRole(
    admin, 'dentpilot_sync_test', 'dentpilot_patient_sync_executor',
    'patient_sync_executor', integrationId, practiceId,
  )
  return {
    admin,
    integrationId,
    practiceId,
    patientId,
    appointmentRole: appointment.role,
    appointmentRuntimeUrl: appointment.runtimeUrl,
    patientRuntimeUrl: patient.runtimeUrl,
    async close() {
      await admin.query('delete from private.appointment_sync_executor where database_role=$1', [appointment.role])
      await admin.query('delete from private.patient_sync_executor where database_role=$1', [patient.role])
      await admin.query('delete from public.integration where id=$1', [integrationId])
      await admin.query('delete from public.practice where id=$1', [practiceId])
      await admin.query(`drop role if exists ${quoteIdentifier(appointment.role)}`)
      await admin.query(`drop role if exists ${quoteIdentifier(patient.role)}`)
      await admin.end()
    },
  }
}
