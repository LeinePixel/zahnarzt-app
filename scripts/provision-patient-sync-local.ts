import { randomBytes } from 'node:crypto'
import { writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from 'pg'
import { z } from 'zod'

const configSchema = z.strictObject({
  adminDatabaseUrl: z.string(),
  integrationId: z.uuid(),
})
export type ProvisioningConfig = z.infer<typeof configSchema>

export function validateProvisioningConfig(environment: Record<string, string | undefined>): ProvisioningConfig {
  try {
    if (environment.PATIENT_SYNC_SYNTHETIC_ONLY !== '1') throw new Error()
    const url = new URL(environment.PATIENT_SYNC_ADMIN_DATABASE_URL ?? '')
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost'].includes(url.hostname) || !url.port || !url.password) throw new Error()
    return configSchema.parse({ adminDatabaseUrl: url.toString(), integrationId: environment.PATIENT_SYNC_PROVISION_INTEGRATION_ID })
  } catch { throw new Error('Lokale Provisionierungskonfiguration ist ungültig.') }
}

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`

export async function provisionLocalPatientSync(environment: Record<string, string | undefined> = process.env): Promise<string> {
  const config = validateProvisioningConfig(environment)
  const admin = new Client({ connectionString: config.adminDatabaseUrl })
  const suffix = randomBytes(8).toString('hex')
  const role = `dentpilot_sync_${suffix}`
  const password = randomBytes(24).toString('hex')
  const output = resolve(`.env.patient-sync.${suffix}.local`)
  let wroteFile = false
  let commitAttempted = false
  await admin.connect()
  try {
    const integration = await admin.query("select id from public.integration where id=$1 and provider='mock_pvs'", [config.integrationId])
    if (integration.rowCount !== 1) throw new Error('unknown integration')
    await admin.query('begin')
    await admin.query(`create role ${quoteIdentifier(role)} login password '${password}' nosuperuser nobypassrls nocreatedb nocreaterole noreplication`)
    await admin.query(`grant dentpilot_patient_sync_executor to ${quoteIdentifier(role)}`)
    await admin.query(`alter role ${quoteIdentifier(role)} set log_statement = 'none'`)
    await admin.query(`alter role ${quoteIdentifier(role)} set log_min_error_statement = 'panic'`)
    await admin.query(`alter role ${quoteIdentifier(role)} set log_parameter_max_length = 0`)
    await admin.query(`alter role ${quoteIdentifier(role)} set log_parameter_max_length_on_error = 0`)
    await admin.query(`alter role ${quoteIdentifier(role)} set log_min_duration_statement = -1`)
    await admin.query(`alter role ${quoteIdentifier(role)} set log_min_duration_sample = -1`)
    await admin.query(`alter role ${quoteIdentifier(role)} set log_statement_sample_rate = 0`)
    await admin.query('insert into private.patient_sync_executor(database_role,integration_id,practice_id) select $1,id,practice_id from public.integration where id=$2', [role, config.integrationId])
    const runtimeUrl = new URL(config.adminDatabaseUrl); runtimeUrl.username = role; runtimeUrl.password = password
    await writeFile(output, `PATIENT_SYNC_SYNTHETIC_ONLY=1\nPATIENT_SYNC_DATABASE_URL=${runtimeUrl}\nMOCK_PVS_BASE_URL=\nMOCK_PVS_READ_TOKEN=\n`, { flag: 'wx', mode: 0o600 })
    wroteFile = true
    commitAttempted = true
    await admin.query('commit')
    return output
  } catch (error) {
    try { await admin.query('rollback') } catch { /* preserve original neutral failure */ }
    if (wroteFile && !commitAttempted) try { await unlink(output) } catch { /* private file cleanup best effort */ }
    throw new Error('Lokale Patientensync-Provisionierung fehlgeschlagen.', { cause: error })
  } finally { await admin.end() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void provisionLocalPatientSync().then(output => {
    process.stdout.write(`Private Laufzeitkonfiguration erstellt: ${output}\n`)
  }).catch(() => {
    process.stderr.write('Lokale Patientensync-Provisionierung fehlgeschlagen.\n')
    process.exitCode = 1
  })
}
