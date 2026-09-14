# PROJ-4 Patienten-Synchronisierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import only synthetic patients through an explicitly started local CLI, with restricted database identity and atomic patient/checkpoint commits.

**Architecture:** `src/features/patients` owns minimal projections, orchestration and a small PostgreSQL repository. A dedicated database login is mapped to one integration and may invoke only three private entry points. The patient checkpoint is independent from the existing PROJ-3 global cursor and all future appointment work.

**Tech Stack:** TypeScript, Zod 4, existing PROJ-3 adapter, Node fetch, node-postgres (`pg`), Vitest, Supabase PostgreSQL, pgTAP, existing Playwright/Edge workflow.

**Spec:** [PROJ-4 feature](../../../features/PROJ-4-patient-synchronization.md) and [approved design](../specs/2026-09-14-proj-4-patient-sync-design.md), approved by the user on 2026-09-14.

## Global Constraints

- Exclusively synthetic data. Real-Data-Gate, DSGVO, data-security and EU-AI-Act operational gates remain closed.
- Local CLI only: no scheduler, page, browser route, Server Action, UI, patient browser-read capability or appointment import.
- No service-role key, Mock-PVS test token, seed password or administrator database URL enters the runtime CLI environment.
- Reuse `IntegrationAdapter`, the six `IntegrationFailureCode` values and existing technical state/event writers internally; no production imports from `services/mock-pvs`.
- Runtime origin and database connection require local hosts `127.0.0.1|localhost` and explicit ports. Reject hosted configuration before all I/O.
- Use `limit: 100`, at most 100 data pages combined, 10 MiB maximum projected batch/SQL input, a 60-second run deadline, and database statements no longer than five seconds.
- Preserve the existing three-second per-request timeout and one-MiB response bound; combine the request signal with the overall deadline.
- One successful transaction per run includes patient data, version markers, initial-completion flag, patient checkpoint and technical success.
- Never change `integration_sync_state.confirmed_change_cursor`. Never persist source event IDs, per-event cursors, appointment resources, email or raw bodies.
- Every new table has RLS, consistent practice/integration foreign keys and revoked direct browser/runtime privileges.
- Runtime group/logins: `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`; group is `NOLOGIN`. Only three private entry points are granted.
- Every privileged entry point uses `SECURITY DEFINER SET search_path = ''`, derives scope from `session_user` and returns neutral results.
- No automatic cursor reset, rebootstrap, deletion on snapshot absence, retry loop or source-contract extension.
- Initial bootstrap is accepted only against unchanged deterministic Mock-PVS scenarios; durable cursor/snapshot guarantees for real sources are not claimed.
- Minimal delete-version markers live until the synthetic integration is deleted. Technical result events retain the existing 30-day purge boundary; no scheduler commissioning.
- Work inline, one task at a time. Subagents only for necessary independent reviews. Local commits are allowed; PROJ-4 push, PR, merge, hosted changes and deployment require separate authorization.

## Execution entry and baseline

The local branch `codex/proj-4-patient-sync-design` starts on the completed PROJ-3 branch; PR #4 was open during specification. The isolated worktree is already `C:/Users/Admin/.codex/worktrees/2c1a/zahnarzt-app`. Verify actual HEAD, status and PR/base before execution; do not create a nested worktree or change another task's checkout.

```powershell
git -c safe.directory=C:/Users/Admin/.codex/worktrees/2c1a/zahnarzt-app status --short
git -c safe.directory=C:/Users/Admin/.codex/worktrees/2c1a/zahnarzt-app log -3 --oneline
npm test
npx supabase test db --local
```

Read the user-provided AGENTS instructions, `features/INDEX.md`, both approved PROJ-4 documents, PROJ-3 contracts/migration, and existing privacy/roles documents. Root AGENTS/ARCHITECTURE/SECURITY/DECISIONS files are absent on the original PROJ-3 base; do not invent them or import security work from PROJ-31. A local reset must target only the already-authorized synthetic stack and is used only when applying/rechecking the planned migration.

## File map

| Path | Responsibility |
|---|---|
| `src/features/patients/source-projection.ts`, `.test.ts` | Minimal patient fields, mutation schemas and deterministic projection. |
| `src/features/patients/sync-config.ts`, `.test.ts` | Local runtime configuration, secret exclusion and synthetic confirmation. |
| `src/features/patients/sync-repository.ts` | Runtime ports and closed result types. |
| `src/features/patients/sync-patients.ts`, `.test.ts`, `.http.test.ts` | Initial/delta collection, limits, deadline, one commit, neutral handling. |
| `src/features/patients/postgres-sync-repository.ts`, `.test.ts`, `.db.test.ts` | Single connection, SQL calls, transaction, cleanup and real LOGIN identity evidence. |
| `src/features/patients/test/local-database.ts` | Test-only administrative fixtures and random restricted login provisioning. |
| `scripts/run-patient-sync.ts`, `.test.ts`, `.process.test.ts` | CLI composition, sanitized child environment, neutral messages and exitcodes. |
| `scripts/provision-patient-sync-local.ts`, `.test.ts` | Explicit local administrative provisioning; separate from runtime. |
| `.env.patient-sync.local.example`, `.env.patient-sync-admin.local.example` | Value-free private runtime/administration templates. |
| `supabase/migrations/20260914170000_proj_4_patient_sync.sql` | Projection, private markers/checkpoints/executors, group role and SQL functions. |
| `supabase/tests/proj_4_patient_sync.test.sql` | SQL, privilege, RLS and functional atomicity tests. |
| `package.json`, `package-lock.json` | Only pg/types and required patient-sync scripts. |
| `vitest.config.mts`, `vitest.patient-sync.config.mts` | Ordinary tests exclude real DB/process acceptance; dedicated config explicitly enables them. |
| Feature/design/index, API/data-model/decisions, README and acceptance/known-issues docs | Exact implementation evidence and remaining gates. |

## Task 1: Minimal projection, local configuration and runtime ports

**Files:** Create `source-projection.ts`, `source-projection.test.ts`, `sync-config.ts`, `sync-config.test.ts`, `sync-repository.ts` under `src/features/patients`; create runtime template.

**Consumes:** `SourcePatient`, `SourceChangeEvent`, `IntegrationFailureCode`, `MockPvsConfig` and `loadMockPvsConfig` from PROJ-3.

**Produces:** `PatientProjection`, `PatientMutation`, `projectPatient`, `projectPatientChange`, `PatientSyncRepository`, `PatientSyncResult`, `loadPatientSyncConfig`.

- [ ] **Step 1: Write red projection and config tests.**

```ts
const source = {
  id: 'synthetic-patient', version: 1, firstName: 'Synthetic', lastName: 'Fixture',
  birthDate: '2000-01-01', email: 'fixture@example.invalid', phoneE164: '+491234567',
  sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
}
expect(projectPatient(source)).toEqual({
  sourceId: source.id, sourceVersion: 1, firstName: source.firstName,
  lastName: source.lastName, birthDate: source.birthDate, phoneE164: source.phoneE164,
  sourceCreatedAt: source.sourceCreatedAt, sourceUpdatedAt: source.sourceUpdatedAt,
})
expect(() => projectPatient({ ...source, id: 'x'.repeat(101) })).toThrow()
expect(() => loadPatientSyncConfig({ PATIENT_SYNC_SYNTHETIC_ONLY: '0' })).toThrow()
```

Also assert missing/invalid dates, names over 200 characters, empty/overlong ID, invalid phone, exact projection keys, resource-free patient Delete and `null` for an appointment change. Config table covers absent confirmation/token/DB URL, hosted host, absent port, non-PostgreSQL protocol, query/hash, empty database/password, privileged username and forbidden service-role/admin/test-token/seed variables. Do not print full config values in failure assertions; compare predicates for secrets.

- [ ] **Step 2: Verify expected red modules.**

```powershell
npx vitest run src/features/patients/source-projection.test.ts src/features/patients/sync-config.test.ts
```

Expected: missing projection/config modules. Confirm this before implementation.

- [ ] **Step 3: Define schemas, parser and the complete ports.**

```ts
export type PatientProjection = {
  sourceId: string; sourceVersion: number; firstName: string; lastName: string
  birthDate: string; phoneE164: string; sourceCreatedAt: string; sourceUpdatedAt: string
}
export type PatientMutation =
  | { operation: 'upsert'; patient: PatientProjection }
  | { operation: 'delete'; sourceId: string; sourceVersion: number }
export type PatientCheckpoint = {
  integrationId: string; initialImportCompleted: boolean; confirmedChangeCursor: string | null
}
export type PatientSyncFailure = IntegrationFailureCode | 'execution_denied' | 'persistence_unavailable'
export type PatientSyncResult =
  | { ok: true }
  | { ok: false; code: PatientSyncFailure | 'sync_busy' | 'retry_not_due' }
export type PatientSyncAcquisition =
  | { ok: true; checkpoint: PatientCheckpoint }
  | { ok: false; code: 'sync_busy' | 'retry_not_due' | 'execution_denied' | 'persistence_unavailable' }
export type PatientSyncCommit = {
  expected: PatientCheckpoint; snapshot: PatientProjection[]
  mutations: PatientMutation[]; candidateCursor: string | null
}
export interface PatientSyncRepository {
  acquire(signal: AbortSignal): Promise<PatientSyncAcquisition>
  commit(input: PatientSyncCommit, signal: AbortSignal): Promise<PatientSyncResult>
  recordFailure(input: { code: IntegrationFailureCode; retryAt: Date | null }, signal: AbortSignal): Promise<boolean>
  close(): Promise<void>
}
```

Implement strict Zod projection/mutation schemas and export `patientProjectionSchema` and `patientMutationSchema`. Derive projection fields explicitly; do not spread source objects. `projectPatientChange(event)` returns patient mutation or `null` for appointment. Failure exceptions are neutral `PatientProjectionError('Patientenquelle ist ungültig.')` and `PatientSyncConfigError('Patientensync-Konfiguration ist ungültig.')`.

`loadPatientSyncConfig(environment = process.env)` returns `{ databaseUrl: string, mockPvs: MockPvsConfig }`. Reuse PROJ-3 Mock config. Parse DB URL using `URL`: only `postgres:|postgresql:`, local host, explicit port, one nonempty database path, no query/hash, username matching `^dentpilot_sync_[a-z0-9_]+$`, nonempty decoded password without control characters. Runtime login attributes are additionally checked by SQL; a username alone is not authorization.

Reject any nonempty service-role, seed-password, admin-connection or Mock-test-token variable before I/O. Runtime template contains only:

```dotenv
PATIENT_SYNC_SYNTHETIC_ONLY=1
PATIENT_SYNC_DATABASE_URL=
MOCK_PVS_BASE_URL=http://127.0.0.1:
MOCK_PVS_READ_TOKEN=
```

- [ ] **Step 4: Verify and review Task 1.**

```powershell
npx vitest run src/features/patients/source-projection.test.ts src/features/patients/sync-config.test.ts
npm run typecheck
npm run lint
```

Require all exit 0; review exact fields, no direct clients and no app-route changes.

- [ ] **Step 5: Commit.**

```powershell
git add src/features/patients/source-projection.ts src/features/patients/source-projection.test.ts src/features/patients/sync-config.ts src/features/patients/sync-config.test.ts src/features/patients/sync-repository.ts .env.patient-sync.local.example
git commit -m "feat(proj-4): define minimal patient sync contract"
```

## Task 2: Restricted schema, versioning and atomically scoped SQL functions

**Files:** Create the named migration and `supabase/tests/proj_4_patient_sync.test.sql`.

**Consumes:** Task 1 projection fields/mutations and existing practice/integration/status schema.

**Produces:** Three private entry points. Acquisition returns JSONB `{ ok, checkpoint }` or `{ ok:false, code }`, with camelCase fields matching Task 1. Commit returns JSONB `{ok:true}` or a Task 1 failure. Failure recorder returns boolean. SQL signatures are:

```sql
private.acquire_patient_sync()
private.commit_patient_sync(text, boolean, jsonb, jsonb, text)
private.record_patient_sync_failure(public.integration_sync_error_code, timestamptz)
```

The five commit arguments are expected cursor, expected initial-completion flag, snapshot, mutations and candidate cursor. The repository-owned `expected.integrationId` is checked against the acquired checkpoint locally; it is not a target-selector argument in SQL.

- [ ] **Step 1: Write failing SQL assertions.**

Use `begin; select plan(N); ... select * from finish(); rollback;`, with N computed from the exact written assertions. Do not leave a guessed count. Create two synthetic practices/integrations and transaction-local restricted roles. Test identity changes with original superuser `SET SESSION AUTHORIZATION` and explicitly reset it; actual password logins are additionally tested in Task 4.

```sql
select has_table('public','patient','patient projection exists');
select has_table('private','patient_source_version','delete versions are private');
select has_table('private','patient_sync_checkpoint','patient cursor is private');
select has_table('private','patient_sync_executor','login mapping is private');
select ok(not has_table_privilege('authenticated','public.patient','SELECT,INSERT,UPDATE,DELETE'),'browser has no patient table access');
select ok(not has_function_privilege('authenticated','private.commit_patient_sync(text,boolean,jsonb,jsonb,text)','EXECUTE'),'browser cannot commit');
```

Write named cases: own acquisition, repeated acquisition, foreign composite FK, unmapped identity, initial idle checkpoint, missing/reentrant lock, successful initial batch, duplicate/up/down/same-version cases, late same-version conflict after earlier mutation, Delete-known/Delete-unknown, old upsert after Delete, shared family phone, endcursor/CAS, role revocation, no global cursor modification, neutral failing-row exclusion and failure event field exclusions. Assert all four tables' RLS, privileges for anon/authenticated/runtime, all role attributes and every SECURITY-DEFINER search_path.

- [ ] **Step 2: Run red pgTAP.**

```powershell
npx supabase test db --local supabase/tests/proj_4_patient_sync.test.sql
```

Expected: new objects missing. Use positional path, not unsupported `--file`.

- [ ] **Step 3: Create schema and privileged-function foundations.**

```sql
alter table public.integration add constraint integration_id_practice_unique unique(id,practice_id);
do $$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname='dentpilot_patient_sync_executor') then
    create role dentpilot_patient_sync_executor nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  elsif exists(select 1 from pg_catalog.pg_roles where rolname='dentpilot_patient_sync_executor'
      and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)) then
    raise exception 'Invalid patient sync group configuration';
  end if;
end;
$$;
-- Every patient/private table references (integration_id,practice_id):
-- foreign key (integration_id,practice_id) references public.integration(id,practice_id) on delete cascade.
```

Create exactly the four approved tables/fields. Patient IDs default UUID; names/IDs/phone/date/version constraints mirror Task 1. `patient_source_version` and checkpoint use integration keys and their specified unique keys. Initialize new checkpoints through an AFTER INSERT integration trigger; backfill existing integrations with `ON CONFLICT DO NOTHING`. Grant direct local administration only to `service_role`; revoke table privileges from PUBLIC/browser/runtime. Grant private schema USAGE and only the three named function EXECUTEs to the group. Do not grant generic PROJ-3 writers or helper EXECUTEs. Ensure existing broad default grants cannot undo explicit revokes.

Define ungranted private helpers with these concrete signatures:

```sql
private.patient_sync_identity() returns table(integration_id uuid, practice_id uuid)
private.patient_sync_has_lock(uuid) returns boolean
private.apply_patient_sync_mutation(uuid, uuid, jsonb) returns void
```

Identity requires mapped `session_user`, login role membership and all restricted attributes. Lock key is the two-integer namespace `(20260914, hashtext(integration_id::text))`. Detect own held lock by `pg_locks.locktype='advisory'`, `pid=pg_backend_pid()`, `classid=20260914`, `objid=(hashtext(id::text)::bit(32)::bigint)::oid`, `objsubid=2`, granted=true. Hash collisions may serialize unrelated integrations but must never grant cross-integration data scope; identity determines rows.

- [ ] **Step 4: Implement acquisition and mutation rules.**

Acquire verifies identity and future retry time before the nonblocking advisory-lock attempt, checks own already-held lock first, then returns the private checkpoint. Failure after acquiring releases the lock. Do not use `pg_try_advisory_lock` to test ownership: it is reentrant.

Implement version helper using row locks and strict JSON keys/types before casts. Revalidate positive integral version, valid nonempty names/IDs, ISO date/timestamps and E.164. Unknown keys fail rather than disappear. All SQL references are fully qualified.

```sql
-- Core comparison after loading the current private version row FOR UPDATE:
if incoming_version < stored_version then return; end if;
if incoming_version = stored_version then
  -- Same delete: return. Same upsert: compare every projected source field.
  -- Different operation or changed same-version fields: raise SQLSTATE 'P4001'.
end if;
-- Newer delete: DELETE matching patient, UPSERT is_deleted=true version marker.
-- Newer upsert: UPSERT matching patient fields, UPSERT is_deleted=false marker.
```

The helper's SQLSTATE `P4001` is internal only and never carries a payload/message from the source. Repeated upserts leave the internal UUID stable. Never infer deletes from absence.

- [ ] **Step 5: Implement the overall commit and failure writer.**

Inside the commit function, recheck/lock identity mapping and lock ownership, then lock/check the checkpoint. Require boolean and cursor length/null semantics; expected initial-completion and cursor use null-safe comparison. A completed initial import rejects any nonempty snapshot. Validate total JSON byte size and maximum 10,000 resources/events before writes.

```sql
begin
  -- The subtransaction includes validation, snapshot upserts, all mutations,
  -- checkpoint completion/candidate and private PROJ-3 technical success.
  return jsonb_build_object('ok',true);
exception
  when sqlstate 'P4001' then
    return jsonb_build_object('ok',false,'code','source_contract_invalid');
  when query_canceled then
    return jsonb_build_object('ok',false,'code','persistence_unavailable');
  when others then
    return jsonb_build_object('ok',false,'code','persistence_unavailable');
end;
```

Authorization/CAS/lock failure returns `execution_denied` before mutation. Distinguish source-projection validation errors as `source_contract_invalid` via the same internal SQLSTATE. An empty source feed leaves candidate equal to prior cursor; SQL must not implicitly null it. Reuse `private.record_integration_sync_result` internally for success/failure only. The failure writer rechecks current identity and held lock and accepts only six provider codes/retry values. Sensitive constraint details are caught; SQL/parameter/error-statement logging must be disabled for the runtime role and its function path. Use administrative role settings to disable logging where PostgreSQL requires elevated SET privileges; do not grant SET privileges to runtime.

- [ ] **Step 6: Apply the authorized local migration and run green SQL.**

```powershell
npx supabase db reset --local
npm run seed
npx supabase test db --local supabase/tests/proj_4_patient_sync.test.sql
npx supabase test db --local
```

Require migration/seed/tests exit 0 against local synthetic stack. The reset does not authorize any linked/hosted operation. Diagnose failures before another schema edit/reset.

- [ ] **Step 7: Review and commit SQL boundary.**

```powershell
git add supabase/migrations/20260914170000_proj_4_patient_sync.sql supabase/tests/proj_4_patient_sync.test.sql
git commit -m "feat(proj-4): add restricted atomic patient persistence"
```

Review scope derivation, complete FK/privilege coverage, no raw exceptions and true late-conflict rollback.

## Task 3: Bounded initial/delta orchestration and HTTP contract

**Files:** Create `sync-patients.ts`, `sync-patients.test.ts`, `sync-patients.http.test.ts`.

**Consumes:** All Task 1 types, projection helpers and existing adapter.

**Produces:**

```ts
runPatientSync(adapter: IntegrationAdapter, repository: PatientSyncRepository,
  dependencies?: { now?: () => number; signal?: AbortSignal }): Promise<PatientSyncResult>
```

- [ ] **Step 1: Write red orchestration tests with behavior assertions.**

Use a test-only stateful repository that atomically commits the supplied batch and exposes its confirmed checkpoint for assertions; failure must leave it unchanged. Adapter stubs return real typed pages, not unverifiable call-count-only results.

```ts
const initial = { integrationId: '33000000-0000-4000-8000-000000000001', initialImportCompleted: false, confirmedChangeCursor: null }
const lastEventCursor = 'opaque-last-event'
// Stub feed: patient upsert then appointment upsert, nextCursor:null.
expect(await runPatientSync(adapter, repository)).toEqual({ ok: true })
expect(repository.confirmed.confirmedChangeCursor).toBe(lastEventCursor)
expect(repository.confirmed.initialImportCompleted).toBe(true)
expect(repository.patients.every(patient => !('email' in patient))).toBe(true)
```

Also cover later-page provider failure, record-failure failure, refused commit, initial vs delta, terminal empty page, busy/retry-before-source, duplicate cursor/empty continuation, exactly 100 pages vs 101, byte limit, overall deadline, last appointment event and cleanup after acquire rejection. Test raw thrown errors return only neutral closed results.

- [ ] **Step 2: Confirm red module.**

```powershell
npx vitest run src/features/patients/sync-patients.test.ts
```

Expected: `sync-patients` absent.

- [ ] **Step 3: Implement collection and exactly one commit.**

Initialize deadline once and maintain combined page count and projected UTF-8 byte count across snapshot/mutations. Count only projected persisted fields, including mutation envelopes and checkpoint parameters in the final serialized SQL batch; reject a final oversized batch before commit. Count pages before requesting the next page so page 101 is never fetched.

```ts
const deadline = AbortSignal.any([AbortSignal.timeout(60_000), ...(dependencies.signal ? [dependencies.signal] : [])])
let candidateCursor = acquired.checkpoint.confirmedChangeCursor
// A change page advances candidate only to an actual event.cursor.
// Appointment mutations project to null but their consumer position still advances.
```

Use separate visited sets for patients/changes, include each stream's starting cursor, and check repeated continuation values before another request. Fully validate both streams before calling commit. Reserve five seconds before commit, and refuse a commit when the remaining deadline cannot cover it. Map projection exceptions to `source_contract_invalid`, malformed paging/limits to `source_protocol_invalid`, deadline to `network_unavailable`, persistence errors to `persistence_unavailable`. Source failures are recorded only through the restricted repository; failed recording does not create a success claim. `finally` always closes the repository.

- [ ] **Step 4: Add HTTP tests against unchanged scenarios.**

Start real `createMockPvsServer` in Node test environment with random tokens as existing router tests do. Tests alone activate `/__test`. Each scenario has a fresh repository/integration; do not switch scenarios in an existing successful cursor test except the explicit invalidation test.

```ts
await activateScenario('changes')
expect(await runPatientSync(realAdapter, freshRepository)).toEqual({ ok: true })
expect(freshRepository.patients.some(patient => patient.sourceVersion === 2)).toBe(true)
const confirmed = freshRepository.confirmed.confirmedChangeCursor
await activateScenario('baseline')
expect((await runPatientSync(realAdapter, freshRepository)).ok).toBe(false)
expect(freshRepository.confirmed.confirmedChangeCursor).toBe(confirmed)
```

Cover baseline paging, changes, deletions, invalid-source-data, 429/503 and restart invalidation. An independent read of `listChanges({})` after patient processing demonstrates untouched appointment feed; do not implement a fake production appointment importer.

- [ ] **Step 5: Verify, review and commit orchestration.**

```powershell
npx vitest run src/features/patients/source-projection.test.ts src/features/patients/sync-config.test.ts src/features/patients/sync-patients.test.ts src/features/patients/sync-patients.http.test.ts
npm run test:mock-pvs
npm run typecheck
npm run lint
git add src/features/patients/sync-patients.ts src/features/patients/sync-patients.test.ts src/features/patients/sync-patients.http.test.ts
git commit -m "feat(proj-4): orchestrate bounded patient synchronization"
```

All checks must pass before commit. Review no partial mutation, unchanged global cursor, no source internals in product and no hidden retry.

## Task 4: Real PostgreSQL repository, deadline and restricted LOGIN tests

**Files:** Create `postgres-sync-repository.ts`, `.test.ts`, `.db.test.ts` and `test/local-database.ts`; create `vitest.patient-sync.config.mts`; modify main Vitest config, package and lockfile only for acceptance selection/dependencies/command.

**Consumes:** Task 1 ports and Task 2 exact SQL JSON contracts.

**Produces:** `PostgresPatientSyncRepository(databaseUrl: string) implements PatientSyncRepository`; a test-only `createLocalDatabaseFixture()` returning `{ runtimeUrlA, runtimeUrlB, admin, close }` with random role/password fixtures.

- [ ] **Step 1: Write red repository/identity tests.**

```ts
const repositoryA = new PostgresPatientSyncRepository(fixture.runtimeUrlA)
const repositoryB = new PostgresPatientSyncRepository(fixture.runtimeUrlB)
const acquiredA = await repositoryA.acquire(signal)
const acquiredB = await repositoryB.acquire(signal)
expect(acquiredA.ok && acquiredB.ok && acquiredA.checkpoint.integrationId !== acquiredB.checkpoint.integrationId).toBe(true)
// Admin observes rows after both bounded commits; no runtime table SELECT is used.
```

Connection unit tests assert actual neutral result mapping, parameter shapes and rollback/close behavior. Real DB tests assert different `session_user` values, denied direct SELECT/generic functions, unmapped login, invalid role attributes, CAS failure, repeated lock acquisition, same-integration competing login, mapping revocation during HTTP, physical disconnect/reacquire, SQL late-conflict rollback and logging settings. Never assert passwords/URLs via literal `toEqual` values that can print them.

- [ ] **Step 2: Run red tests and install only required dependencies.**

```powershell
npx vitest run src/features/patients/postgres-sync-repository.test.ts
npm install pg
npm install --save-dev @types/pg
```

Expected first command fails for missing repository. `pg` is explicitly required by approved design. Do not upgrade unrelated dependencies. Record installation/audit results without closing existing security gates.

- [ ] **Step 3: Implement single-client repository and parameterized SQL.**

```ts
const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000, statement_timeout: 5000 })
await client.connect()
const acquired = await client.query('select private.acquire_patient_sync() as result')
await client.query('begin')
const result = await client.query(
  'select private.commit_patient_sync($1::text,$2::boolean,$3::jsonb,$4::jsonb,$5::text) as result',
  [input.expected.confirmedChangeCursor, input.expected.initialImportCompleted,
   JSON.stringify(input.snapshot), JSON.stringify(input.mutations), input.candidateCursor],
)
```

Strictly validate acquisition/result JSON before use. Store the acquired integration locally and reject mismatched expected integration before SQL. On `{ok:false}` ROLLBACK, on `{ok:true}` COMMIT, report success only after COMMIT resolves. Bind failure code/retry date in the restricted failure call. Abort/deadline closes the physical connection to end in-flight I/O, removes listeners and never retries a possibly committed transaction blindly. A lost COMMIT acknowledgement is `persistence_unavailable` with uncertain outcome, not a claim that rows definitely rolled back; the next explicitly started idempotent run reconciles state. Remove secret-bearing causes from returned errors.

`close()` unlocks only the acquired integration's namespace/key, then always ends the client; failure to unlock still closes the session. Close is idempotent and bounded by remaining deadline/physical disconnect. Retain no connection pool.

- [ ] **Step 4: Implement isolated test fixtures and execute real logins.**

The test helper reads admin URL only from ignored `.env.patient-sync-admin.local`, requires local PostgreSQL origin, and rejects hosted databases. It creates fresh synthetic practices/integrations and random `dentpilot_sync_test_*` logins using safe identifier quoting and generated hex passwords, grants only the group and inserts approved mappings. No secrets in command arguments/logs. Cleanup disconnects runtime clients before dropping fixtures/roles; it must not reset or delete another integration.

The dedicated DB suite fails clearly when local admin configuration is absent; do not silently skip required acceptance. Add `**/*.db.test.ts` and `**/*.process.test.ts` to default Vitest exclude. The dedicated config inherits plugins/setup/aliases while explicitly replacing excludes; do not rely on CLI array merge behavior:

```ts
// vitest.patient-sync.config.mts
import { configDefaults, defineConfig } from 'vitest/config'
import base from './vitest.config.mts'
export default defineConfig({
  ...base,
  test: { ...base.test, exclude: [...configDefaults.exclude, 'tests/**'] },
})
```

Add `"test:patient-sync:db": "vitest run --config vitest.patient-sync.config.mts src/features/patients/postgres-sync-repository.db.test.ts"`. The final `verify:full` includes the dedicated command. Test-only admin configuration is never imported from product modules.

```powershell
npm run test:patient-sync:db
npx vitest run src/features/patients/postgres-sync-repository.test.ts
npm run typecheck
npm run lint
```

- [ ] **Step 5: Review and commit real persistence.**

```powershell
git add package.json package-lock.json vitest.config.mts vitest.patient-sync.config.mts src/features/patients/postgres-sync-repository.ts src/features/patients/postgres-sync-repository.test.ts src/features/patients/postgres-sync-repository.db.test.ts src/features/patients/test/local-database.ts
git commit -m "feat(proj-4): add scoped postgres sync repository"
```

Review true LOGIN evidence, no reused admin connection, deadline cleanup and commit acknowledgement semantics.

## Task 5: Local administrative provisioning and runtime CLI process

**Files:** Create named provisioning/runtime scripts and their unit/process tests; admin template; modify package scripts and full workflow.

**Consumes:** `loadPatientSyncConfig`, `MockPvsAdapter`, repository, `runPatientSync` and test helper.

**Produces:** Explicit `patient-sync` and `patient-sync:provision-local` commands and `test:patient-sync:process` acceptance command.

- [ ] **Step 1: Write red CLI/provisioning tests.**

```ts
const result = await runCli({ environment: invalidEnvironment, log: line => lines.push(line) })
expect(result).toBe(1)
expect(lines).toEqual(['Patientensync konnte nicht abgeschlossen werden.'])
expect(databaseFactory).not.toHaveBeenCalled()
expect(fetchFactory).not.toHaveBeenCalled()
```

Define injectable `runCli({ environment, log, createRepository?, createAdapter? }): Promise<0|1|2>` in runtime script so invalid config is testable before factories. Tests cover exact messages/exits, busy and retry, refused config, rejected connection/commit, no raw stdout/stderr and no privileged environment inheritance. Provision tests reject hosted URLs, missing synthetic confirmation, foreign practice/integration pair and privileged runtime role attributes.

- [ ] **Step 2: Execute red tests.**

```powershell
npx vitest run scripts/run-patient-sync.test.ts scripts/provision-patient-sync-local.test.ts
```

Expected absent entrypoint modules. Guard main execution with `pathToFileURL(process.argv[1])` as existing seed script does.

- [ ] **Step 3: Implement separate administrative provisioning.**

Admin template contains `PATIENT_SYNC_SYNTHETIC_ONLY=1`, `PATIENT_SYNC_ADMIN_DATABASE_URL=` and `PATIENT_SYNC_PROVISION_INTEGRATION_ID=`. Provisioner validates local connection and known synthetic integration before making changes. Generate a restricted random login and password; safely quote identifiers, use parameterized mapping insert and a transaction for role/mapping creation. Set runtime logging off administratively. It does not grant table privileges or generic writers and does not alter app users.

Never overwrite an existing runtime env file or print its secrets. Produce private DB URL configuration in a uniquely named ignored `.env.patient-sync.<random>.local` file with the four runtime variables and blank Mock read configuration. If file creation fails, roll back provisioning or remove only the just-created role/mapping. After the operator adds local Mock values, that file may be copied to `.env.patient-sync.local`; existing credentials are preserved. Explain which role belongs to which integration using local file instructions, without logging passwords/URLs. Do not create production or hosted logins.

- [ ] **Step 4: Compose bounded CLI and deadline-aware adapter.**

```ts
const config = loadPatientSyncConfig(environment)
const deadline = AbortSignal.timeout(60_000)
const adapter = new MockPvsAdapter(config.mockPvs, {
  fetch: (input, init) => fetch(input, {
    ...init, signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]),
  }),
})
const result = await runPatientSync(adapter, repository, { signal: deadline })
```

Configuration validation must precede deadline/repository/adapter construction. Factories receive only validated runtime values. The CLI does not load seed/app/admin/test env files and rejects their forbidden variable names. Messages are exactly `Patientensync abgeschlossen.`, `Patientensync ist bereits aktiv oder noch nicht fällig.`, `Patientensync konnte nicht abgeschlossen werden.` for exits 0/2/1 respectively.

Add scripts:

```json
{
  "patient-sync": "node --conditions=react-server --import=tsx --env-file=.env.patient-sync.local scripts/run-patient-sync.ts",
  "patient-sync:provision-local": "node --import=tsx --env-file=.env.patient-sync-admin.local scripts/provision-patient-sync-local.ts",
  "test:patient-sync:process": "vitest run --config vitest.patient-sync.config.mts scripts/run-patient-sync.process.test.ts",
  "verify:full": "npm run verify && supabase test db --local && npm run test:patient-sync:db && npm run test:patient-sync:process && npm run test:e2e:edge-required"
}
```

The dedicated process suite uses the explicit acceptance config from Task 4. This isolates administrative fixtures from ordinary unit tests without hiding required full acceptance.

- [ ] **Step 5: Execute real CLI process acceptance.**

Start a real local Mock-PVS and provisioned runtime target with test-only admin helper. Spawn Node with server conditions and `--import=tsx`; explicit env allowlist keeps only required OS runtime values and the four private runtime variables. Do not spread `process.env` into the child. Capture stdout/stderr without secrets in test snapshots, assert neutral output and exits. Supply intentional forbidden values only in rejection tests and assert they are never emitted. Test 26-patient initial import, repeat, known conflict, busy, retry and absent/malformed config; admin observes rows after process exit. Generated credentials remain test-memory/private files and are cleaned up.

```powershell
npx vitest run scripts/run-patient-sync.test.ts scripts/provision-patient-sync-local.test.ts
npm run test:patient-sync:process
npm run test:patient-sync:db
npm run typecheck
npm run lint
```

- [ ] **Step 6: Review and commit CLI boundary.**

```powershell
git add scripts/run-patient-sync.ts scripts/run-patient-sync.test.ts scripts/run-patient-sync.process.test.ts scripts/provision-patient-sync-local.ts scripts/provision-patient-sync-local.test.ts .env.patient-sync-admin.local.example package.json vitest.config.mts
git commit -m "feat(proj-4): add restricted local patient sync cli"
```

Review no seeded service-role in runtime, no secrets in output/argv, neutral exits and reversible scoped provisioning cleanup.

## Task 6: Full verification, independent review and durable evidence

**Files:** Update feature/index/design/plan, README, architecture API/data-model/decisions and delivery acceptance/known issues.

**Consumes:** AC01–AC15 and actual commands/results from Tasks 1–5.

**Produces:** Locally implemented `In Review` with exact evidence; no operational/real-data approval claim.

- [ ] **Step 1: Create evidence checklist before marking acceptance.**

| Criteria | Required evidence |
|---|---|
| AC01–AC02, AC06–AC07 | Initial/delta orchestration + real Mock + real CLI/DB observation. |
| AC03–AC05 | Projection validation + version/delete/late-conflict pgTAP + DB rollback. |
| AC08–AC10 | Actual LOGIN sessions, revocation/concurrency, role/privilege/RLS pgTAP. |
| AC11–AC12 | Config, exact limits/deadline, retry and log-boundary tests. |
| AC13 | Real Mock restart/scenario invalidation, unchanged target checkpoint. |
| AC14 | Sanitized real process env and messages/exits. |
| AC15 | All focused suites, full workflow and reviewed final diff. |

Keep separate unchecked operational follow-ups for real provider bootstrap/cursors, productive retention, scheduler, UI, hosted provisioning and Real-Data-Gate.

- [ ] **Step 2: Run all required checks.**

```powershell
npm run test:mock-pvs
npm run lint
npm run typecheck
npm test
npx supabase test db --local
npm run test:patient-sync:db
npm run test:patient-sync:process
npm run test:e2e:edge-required
npm run verify:full
git diff --check
```

Require every command exit 0 with local synthetic test configuration. Check dedicated DB/process test output confirms those files actually ran. Do not count prior PROJ-3 totals as new evidence. If a failure occurs, use systematic debugging, reproduce red, fix responsible task, rerun affected check then final full workflow.

- [ ] **Step 3: Obtain independent bounded review and resolve findings.**

Use requesting-code-review and receiving-code-review skills; reviewer checks current changes against this plan and the approved spec. This necessary independent review justifies a subagent; do not delegate implementation by default. Review especially identity changes during HTTP, all null-sensitive SQL constraints, rollback after a late mutation, uncertain COMMIT acknowledgements, runtime environment and logging privilege settings. Reproduce valid findings in red tests before fixes, then repeat affected/full checks.

- [ ] **Step 4: Update documentation from successful results.**

Set feature/index/design to locally implemented `In Review` only after green checks and closed actionable review findings. Mark ACs only with executed evidence. Append exact date, file/test/assertion totals and run commands to feature and acceptance doc. Document private schema, minimal fields/version markers, restricted runtime provisioning, expected Mock invalidation and no runtime browser-read capability. Append selective decisions without changing old decision rows. Known issues retain productive gates and pre-existing dependency-audit findings; do not claim security remediation merely from tests.

- [ ] **Step 5: Verify final scope and secret boundaries.**

```powershell
git diff --check
git diff --name-only
rg -n "services/mock-pvs" src/features/patients --glob '!**/*.test.ts'
rg -n "SUPABASE_SERVICE_ROLE_KEY|MOCK_PVS_TEST_TOKEN|PATIENT_SYNC_ADMIN_DATABASE_URL" src/features/patients scripts/run-patient-sync.ts --glob '!**/*.test.ts' --glob '!**/test/**'
git status --short
```

First rg must have no imports in product. Second rg may match only forbidden-variable-name validation in `sync-config.ts`, never reads/connection use of privileged values. Review generated env files are ignored, no source patient payload/debug output and no `src/app` changes. Compare final complete branch diff against verified PROJ-3 basis, not only unstaged files.

- [ ] **Step 6: Commit and report local result.**

```powershell
git add features/INDEX.md features/PROJ-4-patient-synchronization.md docs/superpowers/specs/2026-09-14-proj-4-patient-sync-design.md docs/superpowers/plans/2026-09-14-proj-4-patient-sync.md README.md docs/architecture/api-contracts.md docs/architecture/data-model.md docs/architecture/decisions.md docs/delivery/acceptance-tests.md docs/delivery/known-issues.md
git commit -m "docs(proj-4): record patient sync verification"
git status --short
```

Report only achieved local scope, actual verification, review outcome and remaining gates. Leave branch/worktree in place. No automatic PROJ-4 push/PR/merge/deployment. PROJ-5 follows its own approved specification, architecture and plan.

## Plan self-review

- Spec coverage: AC01–AC15 are mapped to concrete tasks and acceptance suites; privacy/identity, cursor isolation and unchanged deterministic bootstrap constraints persist.
- Type consistency: projections, mutation variants, repository acquisition/commit/failure/close and orchestrator signature are defined before use. SQL JSON returns use the same closed shapes. The SQL commit receives no caller-selected target IDs.
- Integration: pg/types are added only when repository requires them; default versus dedicated suite exclusion is explicit, and full workflow includes all actual login/process checks.
- Scope: no browser grants, scheduler, appointment implementation, source-contract changes, productive role provisioning or real-data acceptance.
- Review gates: every independently testable task ends in targeted checks and review, final independent review precedes acceptance; no unchecked tests are represented as implemented controls.
