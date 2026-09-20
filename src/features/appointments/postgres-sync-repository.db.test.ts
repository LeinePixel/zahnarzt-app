// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { readFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PostgresPatientSyncRepository } from '@/features/patients/postgres-sync-repository'
import { provisionLocalAppointmentSync } from '../../../scripts/provision-appointment-sync-local'
import { createLocalAppointmentDatabaseFixture } from './test/local-database'
import { PostgresAppointmentSyncRepository } from './postgres-sync-repository'

const fixtures: Awaited<ReturnType<typeof createLocalAppointmentDatabaseFixture>>[] = []
afterEach(async () => { while (fixtures.length) await fixtures.pop()?.close() })

const appointment = {
  sourceId: 'synthetic-appointment', sourceVersion: 1,
  patientSourceId: 'synthetic-patient',
  startsAt: '2026-10-02T08:00:00Z', endsAt: '2026-10-02T08:30:00Z',
  status: 'confirmed' as const, practitionerSourceId: 'synthetic-practitioner',
  sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
}

describe('restricted appointment postgres LOGIN repository', () => {
  it('resolves the patient and atomically commits through private entrypoints', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const repository = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const acquired = await repository.acquire(new AbortController().signal)
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    expect(await repository.commit({
      expected: acquired.checkpoint, snapshot: [appointment], mutations: [], candidateCursor: 'cursor-1',
    }, new AbortController().signal)).toEqual({ ok: true })
    await repository.close()
    const observed = await fixture.admin.query(
      'select source_id,patient_id from public.appointment where integration_id=$1',
      [fixture.integrationId],
    )
    expect(observed.rows).toEqual([{ source_id: appointment.sourceId, patient_id: fixture.patientId }])
  })

  it('denies direct appointment access and patient-sync entrypoints', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const client = new Client({ connectionString: fixture.appointmentRuntimeUrl })
    await client.connect()
    await expect(client.query('select * from public.appointment')).rejects.toMatchObject({ code: '42501' })
    await expect(client.query('select private.acquire_patient_sync()')).rejects.toMatchObject({ code: '42501' })
    await client.end()
  })

  it('rolls back every appointment and the checkpoint when a patient is missing', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const repository = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const acquired = await repository.acquire(new AbortController().signal)
    if (!acquired.ok) throw new Error('Expected acquisition')
    const result = await repository.commit({
      expected: acquired.checkpoint,
      snapshot: [appointment, { ...appointment, sourceId: 'missing-patient-appointment', patientSourceId: 'missing' }],
      mutations: [], candidateCursor: 'must-not-advance',
    }, new AbortController().signal)
    expect(result).toEqual({ ok: false, code: 'source_contract_invalid' })
    await repository.close()
    expect((await fixture.admin.query(
      'select count(*)::int as count from public.appointment where integration_id=$1',
      [fixture.integrationId],
    )).rows[0].count).toBe(0)
    expect((await fixture.admin.query(
      'select initial_import_completed,confirmed_change_cursor from private.appointment_sync_checkpoint where integration_id=$1',
      [fixture.integrationId],
    )).rows[0]).toEqual({ initial_import_completed: false, confirmed_change_cursor: null })
  })

  it('denies commit after executor mapping revocation', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const repository = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const acquired = await repository.acquire(new AbortController().signal)
    if (!acquired.ok) throw new Error('Expected acquisition')
    await fixture.admin.query(
      'delete from private.appointment_sync_executor where database_role=$1',
      [fixture.appointmentRole],
    )
    expect(await repository.commit({
      expected: acquired.checkpoint, snapshot: [appointment], mutations: [], candidateCursor: 'cursor',
    }, new AbortController().signal)).toEqual({ ok: false, code: 'execution_denied' })
    await repository.close()
  })

  it('patient and appointment sync exclude one another in both directions', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const patientFirst = new PostgresPatientSyncRepository(fixture.patientRuntimeUrl)
    expect((await patientFirst.acquire(new AbortController().signal)).ok).toBe(true)
    const blockedAppointment = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    expect(await blockedAppointment.acquire(new AbortController().signal))
      .toEqual({ ok: false, code: 'sync_busy' })
    await blockedAppointment.close()
    await patientFirst.close()

    const appointmentFirst = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    expect((await appointmentFirst.acquire(new AbortController().signal)).ok).toBe(true)
    const blockedPatient = new PostgresPatientSyncRepository(fixture.patientRuntimeUrl)
    expect(await blockedPatient.acquire(new AbortController().signal))
      .toEqual({ ok: false, code: 'sync_busy' })
    await blockedPatient.close()
    await appointmentFirst.close()
  })

  it('retains delete versions and ignores an older restoring upsert', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const initial = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const acquired = await initial.acquire(new AbortController().signal)
    if (!acquired.ok) throw new Error('Expected acquisition')
    expect(await initial.commit({
      expected: acquired.checkpoint, snapshot: [{ ...appointment, sourceVersion: 2 }],
      mutations: [], candidateCursor: 'one',
    }, new AbortController().signal)).toEqual({ ok: true })
    await initial.close()

    const deletion = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const next = await deletion.acquire(new AbortController().signal)
    if (!next.ok) throw new Error('Expected acquisition')
    expect(await deletion.commit({
      expected: next.checkpoint, snapshot: [],
      mutations: [{ operation: 'delete', sourceId: appointment.sourceId, sourceVersion: 3 }],
      candidateCursor: 'two',
    }, new AbortController().signal)).toEqual({ ok: true })
    await deletion.close()

    const old = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const afterDelete = await old.acquire(new AbortController().signal)
    if (!afterDelete.ok) throw new Error('Expected acquisition')
    expect(await old.commit({
      expected: afterDelete.checkpoint, snapshot: [],
      mutations: [{ operation: 'upsert', appointment: { ...appointment, sourceVersion: 2 } }],
      candidateCursor: 'three',
    }, new AbortController().signal)).toEqual({ ok: true })
    await old.close()
    expect((await fixture.admin.query(
      'select count(*)::int as count from public.appointment where integration_id=$1',
      [fixture.integrationId],
    )).rows[0].count).toBe(0)
  })

  it('rejects an equal-version conflict without advancing either checkpoint', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const repository = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const acquired = await repository.acquire(new AbortController().signal)
    if (!acquired.ok) throw new Error('Expected acquisition')
    expect(await repository.commit({
      expected: acquired.checkpoint, snapshot: [appointment], mutations: [], candidateCursor: 'first',
    }, new AbortController().signal)).toEqual({ ok: true })
    await repository.close()

    const conflict = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const next = await conflict.acquire(new AbortController().signal)
    if (!next.ok) throw new Error('Expected acquisition')
    expect(await conflict.commit({
      expected: next.checkpoint, snapshot: [],
      mutations: [{ operation: 'upsert', appointment: { ...appointment, status: 'cancelled' as const } }],
      candidateCursor: 'must-not-advance',
    }, new AbortController().signal)).toEqual({ ok: false, code: 'source_contract_invalid' })
    await conflict.close()
    expect((await fixture.admin.query(
      'select confirmed_change_cursor from private.appointment_sync_checkpoint where integration_id=$1',
      [fixture.integrationId],
    )).rows[0].confirmed_change_cursor).toBe('first')
    expect((await fixture.admin.query(
      'select confirmed_change_cursor from private.patient_sync_checkpoint where integration_id=$1',
      [fixture.integrationId],
    )).rows[0].confirmed_change_cursor).toBeNull()
  })

  it('allows a higher-version resurrection and rejects stale checkpoint CAS', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const repository = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const acquired = await repository.acquire(new AbortController().signal)
    if (!acquired.ok) throw new Error('Expected acquisition')
    expect(await repository.commit({
      expected: acquired.checkpoint, snapshot: [],
      mutations: [{ operation: 'delete', sourceId: appointment.sourceId, sourceVersion: 2 }], candidateCursor: 'deleted',
    }, new AbortController().signal)).toEqual({ ok: true })
    await repository.close()
    const resurrection = new PostgresAppointmentSyncRepository(fixture.appointmentRuntimeUrl)
    const next = await resurrection.acquire(new AbortController().signal)
    if (!next.ok) throw new Error('Expected acquisition')
    expect(await resurrection.commit({
      expected: { ...next.checkpoint, confirmedChangeCursor: 'stale' }, snapshot: [],
      mutations: [{ operation: 'upsert', appointment: { ...appointment, sourceVersion: 3 } }], candidateCursor: 'resurrected',
    }, new AbortController().signal)).toEqual({ ok: false, code: 'execution_denied' })
    expect(await resurrection.commit({
      expected: next.checkpoint, snapshot: [],
      mutations: [{ operation: 'upsert', appointment: { ...appointment, sourceVersion: 3 } }], candidateCursor: 'resurrected',
    }, new AbortController().signal)).toEqual({ ok: true })
    await resurrection.close()
    expect((await fixture.admin.query(
      'select source_version from public.appointment where integration_id=$1 and source_id=$2',
      [fixture.integrationId, appointment.sourceId],
    )).rows[0].source_version).toBe(3)
  })

  it('provisions a repeatable runtime identity into the CLI default env file', async () => {
    const fixture = await createLocalAppointmentDatabaseFixture()
    fixtures.push(fixture)
    const adminText = await readFile(resolve('.env.patient-sync-admin.local'), 'utf8')
    const adminDatabaseUrl = adminText.split(/\r?\n/)
      .find(line => line.startsWith('PATIENT_SYNC_ADMIN_DATABASE_URL='))
      ?.slice('PATIENT_SYNC_ADMIN_DATABASE_URL='.length)
    if (!adminDatabaseUrl) throw new Error('Missing local admin URL')
    const environment = {
      APPOINTMENT_SYNC_SYNTHETIC_ONLY: '1',
      APPOINTMENT_SYNC_ADMIN_DATABASE_URL: adminDatabaseUrl,
      APPOINTMENT_SYNC_PROVISION_INTEGRATION_ID: fixture.integrationId,
    }
    const output = await provisionLocalAppointmentSync(environment)
    expect(output).toBe(resolve('.env.appointment-sync.local'))
    await provisionLocalAppointmentSync(environment)
    const runtimeText = await readFile(output, 'utf8')
    expect(runtimeText).toContain('APPOINTMENT_SYNC_DATABASE_URL=postgresql://dentpilot_appointment_sync_')
    const role = `dentpilot_appointment_sync_${fixture.integrationId.replaceAll('-', '')}`
    expect((await fixture.admin.query(
      'select count(*)::int as count from private.appointment_sync_executor where database_role=$1', [role],
    )).rows[0].count).toBe(1)
    await unlink(output)
    await fixture.admin.query('delete from private.appointment_sync_executor where database_role=$1', [role])
    await fixture.admin.query(`drop role if exists "${role}"`)
  })
})
