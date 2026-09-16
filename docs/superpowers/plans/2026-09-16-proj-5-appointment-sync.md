# PROJ-5 Appointment Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import only synthetic appointments through an explicitly started local CLI, resolve every appointment to an existing patient, and commit appointment state and its independent checkpoint atomically.

**Architecture:** `src/features/appointments` mirrors the proven PROJ-4 boundary with appointment-specific projection, orchestration and PostgreSQL repository files. A separate restricted database login is mapped to one integration, while appointment and patient sync deliberately use the same advisory-lock key so their commits cannot overlap. Appointment projection, patient-reference resolution, version markers, appointment checkpoint and technical success share one database transaction.

**Tech Stack:** TypeScript, Zod 4, existing PROJ-3 `IntegrationAdapter`, Node fetch/runtime, node-postgres (`pg`), Vitest, Supabase PostgreSQL, pgTAP, existing Playwright/Edge workflow.

**Spec:** [PROJ-5 feature](../../../features/PROJ-5-appointment-synchronization.md) and [approved design](../specs/2026-09-16-proj-5-appointment-sync-design.md), approved by the user on 2026-09-16.

## Global Constraints

- Exclusively synthetic data. Real-Data-Gate, DSGVO, data-security and EU-AI-Act operational gates remain closed.
- Local CLI only: no scheduler, page, browser route, Server Action, UI, browser appointment capability, reminder or appointment mutation back to the source.
- No service-role key, Mock-PVS test token, seed password or administrator database URL enters the runtime CLI environment.
- Reuse the existing PROJ-3 `IntegrationAdapter`, its six `IntegrationFailureCode` values, Mock configuration and technical status writers internally; never import product contracts from `services/mock-pvs`.
- Runtime Mock and database origins require `127.0.0.1|localhost` with explicit ports and must be rejected before all I/O when hosted or privileged.
- Use `limit: 100`, at most 100 data pages combined, a 10 MiB projected batch/SQL input, a 60-second overall deadline and database statements no longer than five seconds.
- Preserve the adapter's three-second request timeout and one-MiB response bound by passing the overall abort signal through the existing adapter calls.
- One successful transaction includes appointment rows, version markers, patient-reference resolution, initial-completion flag, appointment checkpoint and technical success.
- Never change `private.patient_sync_checkpoint` or `integration_sync_state.confirmed_change_cursor`. Never persist event IDs, per-event cursors, source patient payloads or raw bodies.
- `practitionerId` is stored only as `practitioner_source_id`, an opaque 1–100 character value. Do not create a practitioner entity.
- Every appointment upsert resolves `patientId` through `(integration_id, source_id)` to a current `public.patient` row from that same integration. Missing/deleted/foreign references fail the whole commit as `source_contract_invalid`.
- Appointment and patient sync use exactly `(20260914, hashtext(integration_id::text))`; either held lock makes the other consumer return `sync_busy` before source I/O.
- Every new table uses RLS, consistent practice/integration foreign keys and revoked direct browser/runtime privileges.
- Runtime group/logins are `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`; the group is `NOLOGIN`. Grant only three appointment-specific private entry points.
- Every privileged entry point uses `SECURITY DEFINER SET search_path = ''`, derives scope from `session_user` and returns neutral closed results.
- No automatic cursor reset, rebootstrap, deletion on snapshot absence, retry loop, generic sync framework or source-contract extension.
- Initial bootstrap is accepted only against an unchanged deterministic Mock-PVS scenario; durable cursor/snapshot guarantees for real sources are not claimed.
- Minimal delete-version markers live until the synthetic integration is deleted. Technical events retain the existing 30-day boundary; no scheduler is commissioned.
- Work one task at a time with red-green-refactor. Local commits are allowed. Push, PR, merge, hosted changes, deployment and real data require separate user authorization.

## Execution entry and baseline

The isolated worktree is `C:/Users/Admin/.codex/worktrees/2c1a/zahnarzt-app`; the documentation commit is `531a78b` on `codex/proj-5-appointment-sync-design`, based on merged PROJ-4. At execution time verify the actual branch, clean status and base. Do not create a nested worktree or alter another checkout.

```powershell
git -c safe.directory=C:/Users/Admin/.codex/worktrees/2c1a/zahnarzt-app status --short --branch
git -c safe.directory=C:/Users/Admin/.codex/worktrees/2c1a/zahnarzt-app log -3 --oneline
npm test
npx supabase test db --local
```

Read the active AGENTS instructions, both approved PROJ-5 documents, PROJ-3 adapter contracts, the PROJ-4 implementation/migration/tests and current privacy/role documentation. The root `ARCHITECTURE.md`, `SECURITY.md` and `DECISIONS.md` files are absent on this checkout; use the corresponding files under `docs/architecture`. Any local database reset must target only the already-authorized synthetic stack and occur only when required to apply the planned migration.

## File map

| Path | Responsibility |
|---|---|
| `src/features/appointments/source-projection.ts`, `.test.ts` | Minimal appointment fields, mutation schema and deterministic source projection. |
| `src/features/appointments/sync-config.ts`, `.test.ts` | Local runtime configuration, secret exclusion and synthetic confirmation. |
| `src/features/appointments/sync-repository.ts` | Appointment checkpoint, commit and closed result ports. |
| `src/features/appointments/sync-appointments.ts`, `.test.ts`, `.http.test.ts` | Initial snapshot, mixed feed, limits, deadline, one commit and neutral failures. |
| `src/features/appointments/postgres-sync-repository.ts`, `.test.ts`, `.db.test.ts` | One DB session, private calls, transaction, cleanup, real logins and shared-lock evidence. |
| `src/features/appointments/test/local-database.ts` | Test-only restricted appointment-login provisioning and cleanup. |
| `scripts/run-appointment-sync.ts`, `.test.ts`, `.process.test.ts` | CLI composition, sanitized environment, neutral output and exit codes. |
| `scripts/provision-appointment-sync-local.ts`, `.test.ts` | Explicit local administrative role provisioning outside runtime. |
| `.env.appointment-sync.local.example`, `.env.appointment-sync-admin.local.example` | Value-free private runtime/admin templates. |
| `supabase/migrations/20260916170000_proj_5_appointment_sync.sql` | Projection, private state, group role, shared lock and private functions. |
| `supabase/tests/proj_5_appointment_sync.test.sql` | Functional SQL, atomicity, RLS, privilege and cross-consumer lock assertions. |
| `vitest.appointment-sync.config.mts`, `package.json` | Dedicated real DB/process suites and explicit commands; no new package dependency. |
| Feature/design/index, `README.md`, `docs/architecture/*`, `docs/delivery/*` | Implemented state, exact evidence and remaining operational gates. |

---

### Task 1: Appointment projection, configuration and runtime ports

**Files:**
- Create: `src/features/appointments/source-projection.ts`
- Create: `src/features/appointments/source-projection.test.ts`
- Create: `src/features/appointments/sync-config.ts`
- Create: `src/features/appointments/sync-config.test.ts`
- Create: `src/features/appointments/sync-repository.ts`
- Create: `.env.appointment-sync.local.example`

**Interfaces:**
- Consumes: `SourceAppointment`, `SourceChangeEvent`, `IntegrationFailureCode`, `MockPvsConfig` and `loadMockPvsConfig` from `src/features/integrations`.
- Produces: `AppointmentProjection`, `AppointmentMutation`, `projectAppointment`, `projectAppointmentChange`, `AppointmentSyncRepository`, `AppointmentSyncResult` and `loadAppointmentSyncConfig`.

- [ ] **Step 1: Write failing projection and configuration tests.**

```ts
const source = {
  id: 'synthetic-appointment', version: 1, patientId: 'synthetic-patient',
  startsAt: '2026-10-02T08:00:00Z', endsAt: '2026-10-02T08:30:00Z',
  status: 'confirmed' as const, practitionerId: 'synthetic-practitioner',
  sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
}
expect(projectAppointment(source)).toEqual({
  sourceId: source.id, sourceVersion: 1, patientSourceId: source.patientId,
  startsAt: source.startsAt, endsAt: source.endsAt, status: source.status,
  practitionerSourceId: source.practitionerId,
  sourceCreatedAt: source.sourceCreatedAt, sourceUpdatedAt: source.sourceUpdatedAt,
})
expect(() => projectAppointment({ ...source, patientId: 'x'.repeat(101) })).toThrow()
expect(() => projectAppointment({ ...source, endsAt: source.startsAt })).toThrow()
expect(() => loadAppointmentSyncConfig({ APPOINTMENT_SYNC_SYNTHETIC_ONLY: '0' })).toThrow()
```

Cover all five statuses; empty/overlong source, patient and practitioner IDs; invalid versions/timestamps; `endsAt <= startsAt`; unknown keys; exact projection keys; appointment upsert/delete; resource-free delete; and `null` for patient events. Configuration tests cover missing confirmation, token and URLs; hosted host; absent port; query/hash; empty DB/password; username outside `^dentpilot_appointment_sync_[a-z0-9_]+$`; and every forbidden service-role, seed-password, admin URL and Mock test-token variable. Assertions must never print complete secret values.

- [ ] **Step 2: Run the tests and confirm they fail because the new modules do not exist.**

```powershell
npx vitest run src/features/appointments/source-projection.test.ts src/features/appointments/sync-config.test.ts
```

Expected: FAIL with unresolved `source-projection` and `sync-config` modules.

- [ ] **Step 3: Implement strict projection schemas and closed repository types.**

```ts
export type AppointmentProjection = {
  sourceId: string; sourceVersion: number; patientSourceId: string
  startsAt: string; endsAt: string
  status: 'confirmed' | 'cancelled' | 'no_show' | 'rescheduled' | 'completed'
  practitionerSourceId: string; sourceCreatedAt: string; sourceUpdatedAt: string
}
export type AppointmentMutation =
  | { operation: 'upsert'; appointment: AppointmentProjection }
  | { operation: 'delete'; sourceId: string; sourceVersion: number }
export type AppointmentCheckpoint = {
  integrationId: string; initialImportCompleted: boolean; confirmedChangeCursor: string | null
}
export type AppointmentSyncResult =
  | { ok: true }
  | { ok: false; code: IntegrationFailureCode | 'sync_busy' | 'retry_not_due' | 'execution_denied' | 'persistence_unavailable' }
export type AppointmentSyncAcquisition =
  | { ok: true; checkpoint: AppointmentCheckpoint }
  | { ok: false; code: 'sync_busy' | 'retry_not_due' | 'execution_denied' | 'persistence_unavailable' }
export type AppointmentSyncCommit = {
  expected: AppointmentCheckpoint; snapshot: AppointmentProjection[]
  mutations: AppointmentMutation[]; candidateCursor: string | null
}
export interface AppointmentSyncRepository {
  acquire(signal: AbortSignal): Promise<AppointmentSyncAcquisition>
  commit(input: AppointmentSyncCommit, signal: AbortSignal): Promise<AppointmentSyncResult>
  recordFailure(input: { code: IntegrationFailureCode; retryAt: Date | null }, signal: AbortSignal): Promise<boolean>
  close(): Promise<void>
}
```

Use strict Zod objects and explicit field construction; never spread source data. Parse the existing PROJ-3 schemas first, then enforce 1–100 character source/patient/practitioner IDs. Export `appointmentProjectionSchema` and `appointmentMutationSchema`. Errors are exactly `AppointmentProjectionError('Terminquelle ist ungültig.')` and `AppointmentSyncConfigError('Terminsync-Konfiguration ist ungültig.')`.

- [ ] **Step 4: Implement the local configuration and value-free template.**

```ts
export type AppointmentSyncConfig = { databaseUrl: string; mockPvs: MockPvsConfig }
export function loadAppointmentSyncConfig(
  environment: Record<string, string | undefined> = process.env,
): AppointmentSyncConfig
```

Reuse `loadMockPvsConfig`. Accept only local PostgreSQL URLs with explicit port, one database path, nonempty password, no query/hash, no control characters and a username matching `dentpilot_appointment_sync_*`. Reject nonempty `SUPABASE_SERVICE_ROLE_KEY`, `APPOINTMENT_SYNC_ADMIN_DATABASE_URL`, `MOCK_PVS_TEST_TOKEN` and `/^SEED_.*PASSWORD$/i` before I/O. Template content is exactly:

```dotenv
APPOINTMENT_SYNC_SYNTHETIC_ONLY=1
APPOINTMENT_SYNC_DATABASE_URL=
MOCK_PVS_BASE_URL=http://127.0.0.1:
MOCK_PVS_READ_TOKEN=
```

- [ ] **Step 5: Run focused checks and commit.**

```powershell
npx vitest run src/features/appointments/source-projection.test.ts src/features/appointments/sync-config.test.ts
npm run typecheck
npm run lint
git add src/features/appointments/source-projection.ts src/features/appointments/source-projection.test.ts src/features/appointments/sync-config.ts src/features/appointments/sync-config.test.ts src/features/appointments/sync-repository.ts .env.appointment-sync.local.example
git commit -m "feat(proj-5): define appointment sync contract"
```

Expected: all commands exit 0; the diff contains only explicit appointment fields and no runtime client or route.

### Task 2: Restricted appointment schema and atomic SQL boundary

**Files:**
- Create: `supabase/migrations/20260916170000_proj_5_appointment_sync.sql`
- Create: `supabase/tests/proj_5_appointment_sync.test.sql`

**Interfaces:**
- Consumes: Task 1 JSON field names, existing `public.integration`, `public.patient`, PROJ-3 technical state writers and PROJ-4 lock namespace.
- Produces: `private.acquire_appointment_sync()`, `private.commit_appointment_sync(text,boolean,jsonb,jsonb,text)` and `private.record_appointment_sync_failure(public.integration_sync_error_code,timestamptz)`.

- [ ] **Step 1: Write red pgTAP assertions for schema, authorization and atomic behavior.**

```sql
begin;
select no_plan();
select has_table('public','appointment','appointment projection exists');
select has_table('private','appointment_source_version','delete versions are private');
select has_table('private','appointment_sync_checkpoint','appointment cursor is private');
select has_table('private','appointment_sync_executor','login mapping is private');
select ok(not has_table_privilege('authenticated','public.appointment','SELECT,INSERT,UPDATE,DELETE'),'browser has no appointment access');
select ok(not has_function_privilege('authenticated','private.commit_appointment_sync(text,boolean,jsonb,jsonb,text)','EXECUTE'),'browser cannot commit appointments');
select * from finish();
rollback;
```

Use `no_plan()` so pgTAP derives the exact assertion count from the completed file. Add named assertions for table columns/checks/indexes; RLS; role attributes; function `search_path`; own/unmapped/revoked identity; retry; first/reentrant/shared lock; snapshot commit; stable internal UUID; old/equal/new versions; known/unknown delete; resurrection only at higher version; late conflict rollback; checkpoint CAS; empty cursor behavior; unchanged patient/global checkpoints; direct privilege denial; and technical event field minimization. Create two practices/integrations and patients, including a same-source patient in another integration, to prove missing/deleted/foreign references roll back every earlier appointment mutation.

- [ ] **Step 2: Run the new SQL suite and confirm missing-object failures.**

```powershell
npx supabase test db --local supabase/tests/proj_5_appointment_sync.test.sql
```

Expected: FAIL because `public.appointment` and the three entry points do not exist.

- [ ] **Step 3: Create the four tables, role, RLS and private helpers.**

```sql
create type public.appointment_status as enum ('confirmed','cancelled','no_show','rescheduled','completed');
create table public.appointment (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null,
  integration_id uuid not null,
  source_id text not null check(length(source_id) between 1 and 100),
  source_version integer not null check(source_version > 0),
  patient_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at > starts_at),
  status public.appointment_status not null,
  practitioner_source_id text not null check(length(practitioner_source_id) between 1 and 100),
  source_created_at timestamptz not null,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(integration_id,source_id),
  foreign key(integration_id,practice_id) references public.integration(id,practice_id) on delete cascade
);
```

Add a unique patient key that permits a composite FK proving `patient_id`, `integration_id` and `practice_id` belong together, then add that FK to `appointment`. Create `private.appointment_source_version`, `private.appointment_sync_checkpoint` and `private.appointment_sync_executor` with the approved fields and composite integration FK. Initialize/backfill appointment checkpoints with an AFTER INSERT integration trigger using `ON CONFLICT DO NOTHING`.

Create or validate `dentpilot_appointment_sync_executor` with all restricted attributes. Enable RLS on all four tables; revoke direct rights from PUBLIC, `anon`, `authenticated`, appointment and patient executor groups; grant administrative table rights only to `service_role`. Define ungranted helpers:

```sql
private.appointment_sync_identity() returns table(integration_id uuid, practice_id uuid)
private.appointment_sync_has_lock(uuid) returns boolean
private.apply_appointment_sync_mutation(uuid, uuid, jsonb) returns void
```

The lock helper checks this session's exact PROJ-4 key `(20260914, hashtext(id::text))` in `pg_locks`. Identity requires mapped `session_user`, LOGIN membership and all restricted role attributes.

- [ ] **Step 4: Implement acquisition, version rules and patient resolution.**

```sql
-- acquire order: identity -> retry due -> own-lock check -> pg_try_advisory_lock
-- mutation order: strict JSON validation -> version row FOR UPDATE -> patient lookup -> write
select p.id into v_patient_id
from public.patient p
where p.integration_id = p_integration_id
  and p.practice_id = p_practice_id
  and p.source_id = v_patient_source_id;
if v_patient_id is null then
  raise sqlstate 'P4001';
end if;
```

Validate exact JSON keys and types before casts. Same delete repeats; older versions do nothing; same upsert compares every projected field including resolved patient, timestamps, status and practitioner; any same-version difference or delete/upsert contradiction raises internal SQLSTATE `P4001`; higher delete removes the appointment and writes a minimal deleted marker; higher upsert writes the appointment and a live marker. Never infer deletion from snapshot absence. Do not put source values in exception messages.

- [ ] **Step 5: Implement atomic commit, failure status and grants.**

```sql
create function private.commit_appointment_sync(
  p_expected_cursor text, p_expected_initial boolean,
  p_snapshot jsonb, p_mutations jsonb, p_candidate_cursor text
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  select integration_id, practice_id into v_integration_id, v_practice_id
    from private.appointment_sync_identity();
  if not private.appointment_sync_has_lock(v_integration_id) then
    return jsonb_build_object('ok',false,'code','execution_denied');
  end if;
  select * into v_checkpoint from private.appointment_sync_checkpoint
    where integration_id = v_integration_id for update;
  if v_checkpoint.confirmed_change_cursor is distinct from p_expected_cursor
     or v_checkpoint.initial_import_completed is distinct from p_expected_initial then
    return jsonb_build_object('ok',false,'code','execution_denied');
  end if;
  foreach v_item in array v_validated_items loop
    perform private.apply_appointment_sync_mutation(v_integration_id,v_practice_id,v_item);
  end loop;
  update private.appointment_sync_checkpoint set
    initial_import_completed=true, confirmed_change_cursor=p_candidate_cursor,
    updated_at=clock_timestamp() where integration_id=v_integration_id;
  return jsonb_build_object('ok',true);
exception
  when sqlstate 'P4001' then return jsonb_build_object('ok',false,'code','source_contract_invalid');
  when query_canceled then return jsonb_build_object('ok',false,'code','persistence_unavailable');
  when others then return jsonb_build_object('ok',false,'code','persistence_unavailable');
end;
$$;
```

The surrounding declarations and pre-loop validation construct `v_validated_items` only after enforcing strict arrays, a 10 MiB serialized input limit, at most 10,000 combined items, cursor bounds and the completed-snapshot rule. The checkpoint assignment uses the validated candidate and preserves the previous cursor when the feed was empty. After the update, call the existing private technical success writer before returning. Authorization, stale checkpoint or absent lock returns `execution_denied` before mutation. The failure writer accepts only the six PROJ-3 provider codes and valid retry timestamps, rechecks identity/lock, and calls the existing private technical writer without changing any checkpoint. Revoke all helper/entry-point defaults, then grant only the three publicized entry points and private-schema USAGE to the appointment group. Set five-second statement limit and disabled statement/parameter logging for runtime roles through permitted administrative settings.

- [ ] **Step 6: Run SQL verification and commit.**

```powershell
npx supabase test db --local supabase/tests/proj_5_appointment_sync.test.sql
npx supabase test db --local
git diff --check
git add supabase/migrations/20260916170000_proj_5_appointment_sync.sql supabase/tests/proj_5_appointment_sync.test.sql
git commit -m "feat(proj-5): add restricted appointment sync schema"
```

Expected: focused and full pgTAP suites pass; no patient/global checkpoint mutation and no browser/direct runtime privilege exists.

### Task 3: Bounded appointment orchestration over the mixed feed

**Files:**
- Create: `src/features/appointments/sync-appointments.ts`
- Create: `src/features/appointments/sync-appointments.test.ts`
- Create: `src/features/appointments/sync-appointments.http.test.ts`

**Interfaces:**
- Consumes: `IntegrationAdapter`, Task 1 projection functions and `AppointmentSyncRepository`.
- Produces: `runAppointmentSync(adapter, repository, dependencies?) => Promise<AppointmentSyncResult>`.

- [ ] **Step 1: Write failing orchestrator tests with a recording repository.**

```ts
const result = await runAppointmentSync(adapter, repository)
expect(result).toEqual({ ok: true })
expect(adapter.listAppointments).toHaveBeenCalledWith({ cursor: undefined, limit: 100 })
expect(repository.commits[0]).toMatchObject({
  snapshot: [projectAppointment(appointment)],
  mutations: [projectAppointmentChange(appointmentEvent)],
  candidateCursor: patientEvent.cursor,
})
```

Add cases for initial and subsequent runs, multi-page snapshot/feed, patient events ignored while advancing the candidate cursor, empty feed preserving the old cursor, snapshot skipped after completion, second-page provider failure without commit, projection failure, repeated cursor, empty page with continuation, 101st combined page, 10 MiB overflow, deadline/abort, five-second commit reserve, busy/retry before health/HTTP, record-failure behavior and `close()` on every exit.

- [ ] **Step 2: Run the unit test and verify missing orchestrator failure.**

```powershell
npx vitest run src/features/appointments/sync-appointments.test.ts
```

Expected: FAIL because `runAppointmentSync` is not implemented.

- [ ] **Step 3: Implement the bounded collection and one-commit flow.**

```ts
const PAGE_LIMIT = 100
const MAX_PAGES = 100
const MAX_BATCH_BYTES = 10 * 1024 * 1024
const RUN_DEADLINE_MS = 60_000
const COMMIT_RESERVE_MS = 5_000

export async function runAppointmentSync(
  adapter: IntegrationAdapter,
  repository: AppointmentSyncRepository,
  dependencies: { now?: () => number; signal?: AbortSignal } = {},
): Promise<AppointmentSyncResult>
```

Follow the established PROJ-4 ordering: acquire; health; optional complete `listAppointments` snapshot; complete `listChanges`; pre-commit size/deadline check; one repository commit; close in `finally`. Count snapshot and change pages together. Track visited continuation cursors independently for snapshot/feed. Set `candidateCursor` for every event, but append only appointment mutations. Map `AppointmentProjectionError` to `source_contract_invalid`, page/limit/cycle errors to `source_protocol_invalid`, and unexpected abort/network errors to `network_unavailable`. Failure recording is best-effort and never changes the returned code.

- [ ] **Step 4: Add real Mock-PVS HTTP coverage.**

```ts
expect(await runAppointmentSync(new MockPvsAdapter({ baseUrl, readToken }), repository))
  .toEqual({ ok: true })
expect(repository.commits[0].snapshot.length).toBeGreaterThan(1)
expect(repository.commits[0].snapshot.every(item => item.patientSourceId.startsWith('mock-patient-'))).toBe(true)
```

Use the existing Mock process helpers and test controls only in tests. Cover baseline pagination, changed appointment, tombstone, invalid appointment interval, 429, 503 and invalid cursor after scenario/reset restart. Use isolated recording repositories and verify no commit/checkpoint candidate is accepted on failure.

- [ ] **Step 5: Run focused checks and commit.**

```powershell
npx vitest run src/features/appointments/sync-appointments.test.ts src/features/appointments/sync-appointments.http.test.ts
npm run typecheck
npm run lint
git add src/features/appointments/sync-appointments.ts src/features/appointments/sync-appointments.test.ts src/features/appointments/sync-appointments.http.test.ts
git commit -m "feat(proj-5): orchestrate bounded appointment sync"
```

Expected: focused tests, types and lint pass; only one commit call occurs per successful run.

### Task 4: PostgreSQL repository, real identities and shared-lock concurrency

**Files:**
- Create: `src/features/appointments/postgres-sync-repository.ts`
- Create: `src/features/appointments/postgres-sync-repository.test.ts`
- Create: `src/features/appointments/postgres-sync-repository.db.test.ts`
- Create: `src/features/appointments/test/local-database.ts`
- Create: `vitest.appointment-sync.config.mts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 repository types and Task 2 SQL functions.
- Produces: `PostgresAppointmentSyncRepository` and `npm run test:appointment-sync:db`.

- [ ] **Step 1: Write red repository unit tests.**

```ts
const repository = new PostgresAppointmentSyncRepository(databaseUrl, { client })
expect(await repository.acquire(signal)).toEqual({ ok: true, checkpoint })
expect(client.query).toHaveBeenCalledWith('select private.acquire_appointment_sync() as result')
await repository.commit(batch, signal)
expect(client.query).toHaveBeenCalledWith(
  'select private.commit_appointment_sync($1::text,$2::boolean,$3::jsonb,$4::jsonb,$5::text) as result',
  [checkpoint.confirmedChangeCursor, checkpoint.initialImportCompleted,
    JSON.stringify(batch.snapshot), JSON.stringify(batch.mutations), batch.candidateCursor],
)
```

Cover connection timeout 3000 ms, statement timeout 5000 ms, strict response parsing, acquired integration mismatch, BEGIN/COMMIT, rollback on neutral SQL failure, rollback on query exception, abort closing the client, failure writer, close without connection, and shared advisory unlock using the acquired integration ID.

- [ ] **Step 2: Run the repository unit test and confirm missing implementation.**

```powershell
npx vitest run src/features/appointments/postgres-sync-repository.test.ts
```

Expected: FAIL because `PostgresAppointmentSyncRepository` does not exist.

- [ ] **Step 3: Implement the one-session repository.**

```ts
export class PostgresAppointmentSyncRepository implements AppointmentSyncRepository {
  constructor(databaseUrl: string, dependencies: { client?: QueryClient } = {})
  acquire(signal: AbortSignal): Promise<AppointmentSyncAcquisition>
  commit(input: AppointmentSyncCommit, signal: AbortSignal): Promise<AppointmentSyncResult>
  recordFailure(input: { code: IntegrationFailureCode; retryAt: Date | null }, signal: AbortSignal): Promise<boolean>
  close(): Promise<void>
}
```

Mirror the reviewed PROJ-4 transaction/session mechanics, but call only appointment functions. Validate every JSON result with strict Zod schemas. The constructor configures `connectionTimeoutMillis: 3000` and `statement_timeout: 5000`. `close()` unlocks `(20260914, hashtext(acquired.integrationId))` and ends the same client. Never expose SQL exceptions or bound values.

- [ ] **Step 4: Write real local LOGIN and concurrency tests.**

```ts
const appointmentLogin = await provisionAppointmentSyncLogin(admin, integration)
const patientLogin = await provisionPatientSyncLogin(admin, integration)
const appointmentRepo = new PostgresAppointmentSyncRepository(appointmentLogin.url)
const patientRepo = new PostgresPatientSyncRepository(patientLogin.url)
expect((await patientRepo.acquire(signal)).ok).toBe(true)
expect(await appointmentRepo.acquire(signal)).toEqual({ ok: false, code: 'sync_busy' })
```

The test helper uses a unique random `dentpilot_appointment_sync_*` LOGIN, restricted attributes, group grant and mapping row; cleanup removes mapping, membership and role in `finally`. Test real password sessions rather than only `SET ROLE`: own success, second integration isolation, direct table denial, denied patient functions, revoked mapping/membership, patient deletion before commit, executor remap during HTTP, late invalid appointment rollback, session crash releasing the lock, patient-lock blocks appointment, appointment-lock blocks patient, and successful restart after release. Assert patient/global checkpoints remain unchanged.

- [ ] **Step 5: Add the dedicated config and package command, then run checks.**

```json
{
  "scripts": {
    "test:appointment-sync:db": "vitest run --config vitest.appointment-sync.config.mts src/features/appointments/postgres-sync-repository.db.test.ts"
  }
}
```

Copy the established dedicated patient-sync Vitest environment/exclusions into `vitest.appointment-sync.config.mts`, changing only included appointment paths. Update the existing `verify:full` chain to run the appointment DB suite after patient DB tests.

```powershell
npx vitest run src/features/appointments/postgres-sync-repository.test.ts
npm run test:appointment-sync:db
npm run typecheck
npm run lint
git add src/features/appointments/postgres-sync-repository.ts src/features/appointments/postgres-sync-repository.test.ts src/features/appointments/postgres-sync-repository.db.test.ts src/features/appointments/test/local-database.ts vitest.appointment-sync.config.mts package.json package-lock.json
git commit -m "feat(proj-5): persist appointments with restricted identity"
```

Expected: unit and actual-login suites pass; both lock directions are observed before any source call.

### Task 5: Explicit local provisioning and process-tested CLI

**Files:**
- Create: `scripts/run-appointment-sync.ts`
- Create: `scripts/run-appointment-sync.test.ts`
- Create: `scripts/run-appointment-sync.process.test.ts`
- Create: `scripts/provision-appointment-sync-local.ts`
- Create: `scripts/provision-appointment-sync-local.test.ts`
- Create: `.env.appointment-sync-admin.local.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: `loadAppointmentSyncConfig`, `MockPvsAdapter`, `PostgresAppointmentSyncRepository`, `runAppointmentSync` and Task 2 role/mapping.
- Produces: `npm run appointment-sync`, `npm run appointment-sync:provision-local` and `npm run test:appointment-sync:process`.

- [ ] **Step 1: Write red composition and provisioning tests.**

```ts
expect(messageFor({ ok: true })).toEqual({ text: 'Terminsync abgeschlossen.', exitCode: 0 })
expect(messageFor({ ok: false, code: 'sync_busy' })).toEqual({ text: 'Terminsync derzeit nicht möglich.', exitCode: 2 })
expect(messageFor({ ok: false, code: 'source_contract_invalid' })).toEqual({ text: 'Terminsync fehlgeschlagen.', exitCode: 1 })
```

Assert every result maps to exactly one constant German line without counts, IDs, host, cursor, SQL or error text. Provisioning tests accept only local admin URLs and identifiers from explicit arguments/environment; generate a strong password when absent; quote identifiers safely; create restricted LOGIN, grant only the appointment group and insert one mapping. Repeated invocation for an already-mapped role must fail neutrally rather than change scope. Runtime code must never import provisioning code.

- [ ] **Step 2: Run red script tests.**

```powershell
npx vitest run scripts/run-appointment-sync.test.ts scripts/provision-appointment-sync-local.test.ts
```

Expected: FAIL because the scripts do not exist.

- [ ] **Step 3: Implement composition, neutral output and admin-only provisioning.**

```ts
export async function executeAppointmentSync(
  environment: Record<string, string | undefined> = process.env,
): Promise<AppointmentSyncResult> {
  const config = loadAppointmentSyncConfig(environment)
  const repository = new PostgresAppointmentSyncRepository(config.databaseUrl)
  return runAppointmentSync(new MockPvsAdapter(config.mockPvs), repository)
}
```

The top-level script catches configuration/unknown errors and writes one neutral line. Do not log caught objects. Provision through a separate `.env.appointment-sync-admin.local` process containing only local admin DB URL, target integration ID, target role and optional generated/output password handling described by its CLI help. The committed example has empty values and no password. Use bound values for mapping rows and validated/quoted role identifiers for DDL.

- [ ] **Step 4: Add real child-process acceptance.**

```ts
const child = spawn(process.execPath, [
  '--conditions=react-server', '--import=tsx', 'scripts/run-appointment-sync.ts',
], { env: sanitizedRuntimeEnvironment, stdio: ['ignore', 'pipe', 'pipe'] })
```

Start the existing synthetic Mock on an ephemeral loopback port, provision a fresh restricted appointment login through test-only admin code, and spawn the real CLI with a sanitized allowlist environment. Prove exit 0 and exact success line; database appointment count and patient links; second-run idempotence; changed appointment; tombstone; missing-patient rollback/checkpoint preservation; busy exit 2 while a patient session holds the shared lock; 429/503 failure; invalid cursor; and configuration rejection before network. Terminate helpers with `child.kill('SIGTERM')` and await `close`; do not use `taskkill`.

- [ ] **Step 5: Add commands, run checks and commit.**

```json
{
  "scripts": {
    "appointment-sync": "node --conditions=react-server --import=tsx --env-file=.env.appointment-sync.local scripts/run-appointment-sync.ts",
    "appointment-sync:provision-local": "node --import=tsx --env-file=.env.appointment-sync-admin.local scripts/provision-appointment-sync-local.ts",
    "test:appointment-sync:process": "vitest run --config vitest.appointment-sync.config.mts scripts/run-appointment-sync.process.test.ts"
  }
}
```

Append `test:appointment-sync:process` to `verify:full` after the appointment DB suite.

```powershell
npx vitest run scripts/run-appointment-sync.test.ts scripts/provision-appointment-sync-local.test.ts
npm run test:appointment-sync:process
npm run typecheck
npm run lint
git add scripts/run-appointment-sync.ts scripts/run-appointment-sync.test.ts scripts/run-appointment-sync.process.test.ts scripts/provision-appointment-sync-local.ts scripts/provision-appointment-sync-local.test.ts .env.appointment-sync-admin.local.example package.json package-lock.json
git commit -m "feat(proj-5): add restricted local appointment sync cli"
```

Expected: unit/process checks pass with exact neutral output and no privileged runtime variable.

### Task 6: Full verification, review and durable evidence

**Files:**
- Modify: `features/INDEX.md`
- Modify: `features/PROJ-5-appointment-synchronization.md`
- Modify: `docs/superpowers/specs/2026-09-16-proj-5-appointment-sync-design.md`
- Modify: `docs/superpowers/plans/2026-09-16-proj-5-appointment-sync.md`
- Modify: `README.md`
- Modify: `docs/architecture/api-contracts.md`
- Modify: `docs/architecture/data-model.md`
- Modify: `docs/architecture/decisions.md`
- Modify: `docs/delivery/acceptance-tests.md`
- Modify: `docs/delivery/known-issues.md`

**Interfaces:**
- Consumes: AC01–AC14 and the actual evidence from Tasks 1–5.
- Produces: a locally implemented `In Review` feature record with exact test evidence and unchanged operational gates.

- [ ] **Step 1: Map acceptance criteria to required evidence before changing status.**

| Criteria | Required evidence |
|---|---|
| AC01–AC02, AC08 | Orchestrator, real Mock and real CLI initial/restart/mixed-feed observations. |
| AC03–AC07 | Projection plus pgTAP/real DB patient resolution, version, delete and late rollback cases. |
| AC09–AC10 | Both lock directions, actual LOGIN sessions, RLS and denied cross-function/direct access. |
| AC11–AC13 | Exact limits/deadline, retry, cursor invalidation, sanitized process environment and output. |
| AC14 | Every focused suite, full workflow, scope/secret scan and independent review. |

Keep unchecked operational follow-ups for real provider snapshot/cursor guarantees, production retention, scheduler, UI, hosted provisioning, deployment and the Real-Data-Gate.

- [ ] **Step 2: Run all required verification commands.**

```powershell
npm run test:mock-pvs
npm run lint
npm run typecheck
npm test
npx supabase test db --local
npm run test:patient-sync:db
npm run test:appointment-sync:db
npm run test:patient-sync:process
npm run test:appointment-sync:process
npm run test:e2e:edge-required
npm run verify:full
git diff --check
```

Every command must exit 0 using only local synthetic configuration. Confirm dedicated outputs show the intended DB/process files actually ran. If any command fails, use `superpowers:systematic-debugging`, reproduce the focused red case, fix it, rerun the affected suite and then the full workflow.

- [ ] **Step 3: Request an independent bounded code review and resolve valid findings.**

Use `superpowers:requesting-code-review`, then `superpowers:receiving-code-review`. Review the complete diff against both approved PROJ-5 documents and this plan, focusing on patient-reference races, same-version comparisons, both shared-lock directions, `session_user` scope, rollback after late mutation, COMMIT uncertainty, runtime environment and logging privileges. Turn each valid finding into a failing targeted test before fixing it, then repeat affected and full checks.

- [ ] **Step 4: Record only executed evidence and implemented status.**

Set feature/index/design to local `In Review` only after every required command passes and actionable review findings are closed. Check only ACs backed by actual output. Add the exact date, test/assertion totals and commands to the feature and acceptance document. Update API/data model/decisions with the private checkpoint, opaque practitioner reference, patient FK, shared lock and restricted identity. Keep known issues explicit about no scheduler, UI, hosted role, real provider contract, deployment or real-data approval.

- [ ] **Step 5: Verify scope, secret and import boundaries.**

```powershell
git diff --check
git diff --name-only origin/main...HEAD
rg -n "services/mock-pvs" src/features/appointments --glob '!**/*.test.ts'
rg -n "SUPABASE_SERVICE_ROLE_KEY|MOCK_PVS_TEST_TOKEN|APPOINTMENT_SYNC_ADMIN_DATABASE_URL" src/features/appointments scripts/run-appointment-sync.ts --glob '!**/*.test.ts' --glob '!**/test/**'
rg -n "grant .*authenticated|grant .*anon" supabase/migrations/20260916170000_proj_5_appointment_sync.sql
git status --short
```

The first `rg` returns no product import. The forbidden-variable scan may match only rejection by name in `sync-config.ts`, never retrieval/use. The grant scan must show no appointment table or sync-function grant to browser roles. Confirm no generated `.env` file, source payload dump or `src/app` change appears.

- [ ] **Step 6: Commit the verified documentation state.**

```powershell
git add features/INDEX.md features/PROJ-5-appointment-synchronization.md docs/superpowers/specs/2026-09-16-proj-5-appointment-sync-design.md docs/superpowers/plans/2026-09-16-proj-5-appointment-sync.md README.md docs/architecture/api-contracts.md docs/architecture/data-model.md docs/architecture/decisions.md docs/delivery/acceptance-tests.md docs/delivery/known-issues.md
git commit -m "docs(proj-5): record appointment sync verification"
git status --short --branch
```

Expected: clean branch with local implementation and evidence. Report only achieved local scope and remaining gates. Do not push, open or merge a PR, deploy, provision hosted roles or use real data without a new explicit instruction.

## Plan self-review

- **Spec coverage:** AC01–AC14 map to Tasks 1–6. Patient resolution, independent cursor, shared cross-consumer lock, version/delete behavior, neutral failures, privacy and operational exclusions each have implementation and verification steps.
- **Type consistency:** `AppointmentProjection`, mutation, checkpoint, acquisition, commit and result types are defined before use. TypeScript camelCase maps explicitly to the five fixed SQL arguments; no caller-selected target ID reaches a privileged function.
- **Transaction consistency:** all appointment rows, patient-reference checks, version markers, appointment checkpoint and technical success share one SQL transaction. Provider failure status is separate and cannot advance Fachzustand.
- **Security consistency:** the new LOGIN group is distinct from the patient group; both share only the advisory-lock key. Browser roles, generic writers and direct tables remain inaccessible.
- **Scope:** no UI, scheduler, reminder, practitioner entity, generic sync refactor, source mutation, hosted work, deployment or real-data acceptance is introduced.
- **Execution gates:** every task starts red, ends with focused green checks and a reviewable commit. Full verification and independent review precede any completion claim.
