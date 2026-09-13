# PROJ-3 Integration-Adapter-Schicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-only Mock-PVS adapter with a practice-scoped, privacy-minimised technical status boundary, without importing patients or appointments.

**Architecture:** `src/features/integrations` owns the canonical source contract, local configuration validation and the sole HTTP implementation for the Mock-PVS. A separate PostgreSQL boundary stores only provider identity, technical state and short-lived neutral error events; a controlled RPC returns a cursor-free status only to the current `praxisadmin`. No scheduler, browser route, patient table or source-data import is part of this plan.

**Tech Stack:** TypeScript, Node `fetch`, Zod 4, Vitest, Next.js server-only modules, Supabase PostgreSQL migrations, RLS, pgTAP.

**Spec:** [`features/PROJ-3-integration-adapter-layer.md`](../../../features/PROJ-3-integration-adapter-layer.md) and [`docs/superpowers/specs/2026-09-13-proj-3-integration-adapter-design.md`](../specs/2026-09-13-proj-3-integration-adapter-design.md)

## Global Constraints

- Use only explicitly synthetic fixtures and credentials; the Real-Data-Gate remains closed.
- Product code is server-only. It creates no Next.js route and reads neither `MOCK_PVS_TEST_TOKEN` nor a Supabase service-role key.
- `MOCK_PVS_BASE_URL` and `MOCK_PVS_READ_TOKEN` are private process configuration. They never enter tables, `NEXT_PUBLIC_*`, URLs, logs, test output or screenshots.
- The concrete adapter accepts only `http://127.0.0.1` or `http://localhost` with an explicit port without credentials, path, query or fragment; it follows no redirects and uses only fixed `/v1` paths.
- Validate every Mock-PVS response with DentPilot-owned strict Zod schemas. Do not import `services/mock-pvs/*` from production source files.
- Persist only technical integration state. Do not persist source resources, external resource IDs, payloads, URLs, headers, tokens or per-patient/per-appointment counters.
- Enable RLS and revoke direct table access for `anon` and `authenticated`; status RPCs derive practice scope from `auth.uid()` and never accept a caller-supplied practice ID.
- Do not create a scheduler, retry loop, UI, patient/appointment table, data import, source conflict resolver or real PVS connector.

---

## File Structure

| Path | Responsibility |
|---|---|
| `.env.integration.local.example` | Value-free local adapter configuration template. |
| `src/features/integrations/adapter.ts` | Canonical source entities, paging, error result and adapter interface. |
| `src/features/integrations/contracts.ts` | Strict Zod response schemas that belong to DentPilot, not the Mock-PVS service. |
| `src/features/integrations/mock-pvs-config.ts` | Local origin and read-token validation. |
| `src/features/integrations/mock-pvs-adapter.ts` | Fixed-path `fetch` implementation and neutral error mapping. |
| `src/features/integrations/sync-state.ts` | Cursor-free status value types and the future state-repository contract. |
| `src/features/integrations/read-sync-status.ts` | Server-side, capability-gated mapper for the cursor-free RPC result. |
| `src/features/integrations/*.test.ts` | Unit and HTTP boundary tests. |
| `src/features/authorization/policy.ts` | Adds the narrow `integration.status.read` capability. |
| `supabase/migrations/20260913170000_proj_3_integration_adapter.sql` | Integration schema, RLS, controlled RPCs and retention function. |
| `supabase/tests/proj_3_integration_adapter.test.sql` | Database ownership, privilege, RLS and retention evidence. |
| `supabase/seed.ts`, `supabase/seed.test.ts` | Seeds exactly one synthetic `mock_pvs` integration without connection data. |
| `README.md`, `docs/architecture/api-contracts.md`, `docs/architecture/data-model.md`, `docs/delivery/acceptance-tests.md`, `docs/delivery/known-issues.md` | Documents the implemented boundary and unresolved follow-up gates. |

## Task 1: Canonical contract and private Mock-PVS configuration

**Files:**
- Create: `.env.integration.local.example`
- Create: `src/features/integrations/adapter.ts`
- Create: `src/features/integrations/contracts.ts`
- Create: `src/features/integrations/mock-pvs-config.ts`
- Create: `src/features/integrations/mock-pvs-config.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces `IntegrationAdapter`, consumed by `MockPvsAdapter` in Task 2 and the future PROJ-4/5 syncs.
- Produces `loadMockPvsConfig`, consumed only by `MockPvsAdapter`.
- Produces the closed `IntegrationFailureCode` union used by Tasks 2–4.

- [ ] **Step 1: Write the failing contract/configuration tests.**

Create `mock-pvs-config.test.ts` with synthetic values. Cover accepted local origins, a trimmed nonempty read token, and every rejected boundary: absent token, `https`, remote hostname, credentials, non-root path, query and fragment. Assert rejection occurs before a `fetch` dependency can be supplied.

```ts
const validEnvironment = {
  MOCK_PVS_BASE_URL: 'http://127.0.0.1:3181',
  MOCK_PVS_READ_TOKEN: 'synthetic-read-token',
}

expect(loadMockPvsConfig(validEnvironment)).toMatchObject({
  baseUrl: new URL('http://127.0.0.1:3181'),
  readToken: 'synthetic-read-token',
})
expect(() => loadMockPvsConfig({
  ...validEnvironment,
  MOCK_PVS_BASE_URL: 'https://example.invalid',
})).toThrow(MockPvsConfigError)
```

Add schema tests that reject extra envelope keys, malformed timestamps, a patient with an invalid `phoneE164`, an appointment whose end is not after its start, and an `upsert` event whose resource ID/version differs from the event.

- [ ] **Step 2: Run the new tests and confirm they fail because the modules do not exist.**

Run: `npx vitest run src/features/integrations/mock-pvs-config.test.ts`

Expected: FAIL with module-not-found errors for `adapter`, `contracts` or `mock-pvs-config`.

- [ ] **Step 3: Implement the minimal canonical contract and configuration parser.**

Create the canonical types and result union in `adapter.ts`. Do not use database or Mock-PVS service imports.

```ts
export type IntegrationFailureCode =
  | 'configuration_invalid'
  | 'network_unavailable'
  | 'rate_limited'
  | 'temporarily_unavailable'
  | 'source_protocol_invalid'
  | 'source_contract_invalid'

export type AdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: IntegrationFailureCode; retryAt: Date | null } }

export type Page<T> = { data: T[]; nextCursor: string | null }

export interface IntegrationAdapter {
  checkHealth(): Promise<AdapterResult<void>>
  listPatients(input: { cursor?: string; limit?: number }): Promise<AdapterResult<Page<SourcePatient>>>
  listAppointments(input: { patientId?: string; from?: string; to?: string; cursor?: string; limit?: number }): Promise<AdapterResult<Page<SourceAppointment>>>
  listChanges(input: { cursor?: string; limit?: number }): Promise<AdapterResult<Page<SourceChangeEvent>>>
}
```

Implement strict Zod schemas in `contracts.ts` with the exact PROJ-2 fields and values. Recreate `SourcePatient`, `SourceAppointment` and `SourceChangeEvent` from these schemas; do not add DentPilot IDs, medical values or imported-table shapes.

Implement `loadMockPvsConfig` in `mock-pvs-config.ts`. Parse the URL with `new URL`, require protocol `http:`, host `127.0.0.1` or `localhost`, an explicit port, no username/password, pathname `/`, empty search and empty hash. Return a normalized origin URL and trimmed token. Throw only `MockPvsConfigError('Mock-PVS-Integration ist ungültig.')`.

Add the value-free template:

```dotenv
# Local synthetic adapter only. Copy to .env.integration.local; never commit values.
MOCK_PVS_BASE_URL=http://127.0.0.1:
MOCK_PVS_READ_TOKEN=
```

Add a concise README section stating that the adapter template is private, server-only and has no runtime command or browser API in PROJ-3.

- [ ] **Step 4: Run targeted tests and static checks.**

Run:

```powershell
npx vitest run src/features/integrations/mock-pvs-config.test.ts
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the contract boundary.**

```powershell
git add .env.integration.local.example README.md src/features/integrations/adapter.ts src/features/integrations/contracts.ts src/features/integrations/mock-pvs-config.ts src/features/integrations/mock-pvs-config.test.ts
git commit -m "feat(proj-3): add integration adapter contract"
```

## Task 2: Mock-PVS HTTP adapter and neutral source failures

**Files:**
- Create: `src/features/integrations/mock-pvs-adapter.ts`
- Create: `src/features/integrations/mock-pvs-adapter.test.ts`
- Modify: `src/features/integrations/adapter.ts` only if a source-result type from Task 1 needs a narrow export.

**Interfaces:**
- Consumes `IntegrationAdapter`, `AdapterResult`, schemas and `MockPvsConfig` from Task 1.
- Produces `MockPvsAdapter`, the only concrete PROJ-3 `IntegrationAdapter`.
- Tests may import `createMockPvsServer`, `createScenarioState` and `loadMockPvsConfig` from `services/mock-pvs/`; production files must not.

- [ ] **Step 1: Write failing HTTP boundary tests against the real local Mock-PVS.**

Start an in-process server with a random read token and test token as in `services/mock-pvs/router.test.ts`. Instantiate the production adapter with the read token only. Cover:

```ts
const adapter = new MockPvsAdapter({
  baseUrl: new URL(baseUrl),
  readToken,
})

await expect(adapter.checkHealth()).resolves.toEqual({ ok: true, value: undefined })
await expect(adapter.listPatients({ limit: 25 })).resolves.toMatchObject({
  ok: true,
  value: { data: expect.any(Array), nextCursor: expect.anything() },
})
```

Add assertions for patient and appointment pages, deterministic change `upsert`s, resource-free delete tombstones, no test-token header in any product call, fixed query encoding and opaque cursor round-trip.

Activate `invalid-source-data`, `rate-limited` and `temporarily-unavailable` through `/__test` from test code only. Assert respectively `source_contract_invalid`, `rate_limited` with `retryAt` one second after a fixed fake clock, and `temporarily_unavailable` with the same capped retry result. Add a minimal separate local server that returns a redirect, non-JSON and a body over 1 MiB; each must map to `source_protocol_invalid` with no raw text.

- [ ] **Step 2: Run the HTTP tests and confirm they fail because `MockPvsAdapter` is absent.**

Run: `npx vitest run src/features/integrations/mock-pvs-adapter.test.ts`

Expected: FAIL with a missing `mock-pvs-adapter` module or constructor.

- [ ] **Step 3: Implement fixed-path fetching and bounded decoding.**

Implement the class with an injected `fetch` function and `now` clock for deterministic tests.

```ts
export class MockPvsAdapter implements IntegrationAdapter {
  constructor(
    private readonly config: MockPvsConfig,
    private readonly dependencies: {
      fetch?: typeof fetch
      now?: () => Date
    } = {},
  ) {}

  async listChanges(input: { cursor?: string; limit?: number }) {
    return this.getPage('/v1/changes', input, changePageSchema)
  }
}
```

Build only these literal paths: `/v1/health`, `/v1/patients`, `/v1/appointments` and `/v1/changes`. Validate outgoing `limit` in `1..100`; validate `patientId`, `from` and `to` before constructing the query. Use `Authorization: Bearer ${config.readToken}`, `redirect: 'error'` and `AbortSignal.timeout(3000)`.

Reject a response if `content-length` exceeds `1_048_576` or streamed bytes exceed that limit. Parse JSON only after the size bound and validate each envelope with Task 1's strict schemas. Never throw upstream response text; return only the closed `AdapterResult` failure type.

Map 429 to `rate_limited`, 503 to `temporarily_unavailable`, transport and timeout errors to `network_unavailable`, and all other HTTP/redirect/body/JSON failures to `source_protocol_invalid`. Parse only an integer `Retry-After` in `1..300` seconds. For 429/503 without that value, set `retryAt` to `now() + 60 seconds`; all other errors use `null`.

- [ ] **Step 4: Run focused adapter verification.**

Run:

```powershell
npx vitest run src/features/integrations/mock-pvs-config.test.ts src/features/integrations/mock-pvs-adapter.test.ts
npm run test:mock-pvs
npm run typecheck
npm run lint
```

Expected: every command exits 0. Inspect the test output to confirm neither generated token appears.

- [ ] **Step 5: Commit the concrete adapter.**

```powershell
git add src/features/integrations/adapter.ts src/features/integrations/mock-pvs-adapter.ts src/features/integrations/mock-pvs-adapter.test.ts
git commit -m "feat(proj-3): add local mock pvs adapter"
```

## Task 3: Practice-scoped technical state, RLS and synthetic seed

**Files:**
- Create: `supabase/migrations/20260913170000_proj_3_integration_adapter.sql`
- Create: `supabase/tests/proj_3_integration_adapter.test.sql`
- Modify: `supabase/seed.ts`
- Modify: `supabase/seed.test.ts`

**Interfaces:**
- Produces `public.read_integration_sync_status()` for Task 4. It has no arguments and returns only `integration_id`, `provider`, `status`, `last_attempt_at`, `last_success_at`, `next_attempt_at` and `last_error_code`.
- Produces private `private.record_integration_sync_result(...)`, `private.confirm_integration_change_cursor(...)` and `private.purge_expired_integration_sync_events()` for a later, explicitly specified execution identity.
- Consumes the existing `public.practice`, `public.user_profile` and `public.user_role` boundary; no user-supplied practice ID is accepted by public functions.

- [ ] **Step 1: Write the failing pgTAP and seed tests.**

Create a transaction-wrapped pgTAP file with two synthetic practices, one `praxisadmin`, one other practice role and one portaladmin. Set `select plan(...)` to the exact assertion count written in this file.

Cover existence and RLS for all three tables, direct `SELECT/INSERT/UPDATE/DELETE` privilege absence for `authenticated`, uniqueness of `(practice_id, provider)`, and a seeded idle state. Under `authenticated`, assert:

```sql
select is(
  (select count(*) from public.read_integration_sync_status()),
  1::bigint,
  'an owning praxisadmin receives exactly one cursor-free status'
);

create temporary table proj_3_public_status_shape as
select * from public.read_integration_sync_status() limit 0;

select ok(
  not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'pg_temp.proj_3_public_status_shape'::regclass
      and attname = 'confirmed_change_cursor' and not attisdropped
  ),
  'the public status contract never projects a cursor'
);
```

Also assert that rezeption, portaladmin, anonymous and a foreign praxisadmin receive zero rows, and that `authenticated` cannot execute any private writer or retention function. Insert an event 31 days old and one 29 days old as `service_role`; verify the private purge removes only the former.

Extend `MemorySeedAdminClient` and `SeedAdminClient` with `upsertMockPvsIntegration(practiceId: string)`. First write a failing seed test that two seed runs retain exactly one integration for the synthetic primary practice and store no base URL or token.

- [ ] **Step 2: Run the failing database and seed tests.**

Run:

```powershell
npx vitest run supabase/seed.test.ts
npx supabase test db --local --file supabase/tests/proj_3_integration_adapter.test.sql
```

Expected: the Vitest test fails on the missing seed method, and pgTAP fails because the migration objects do not exist.

- [ ] **Step 3: Add the smallest database schema and controlled functions.**

Create the provider, state and error enums with only the approved values. Create tables with no connection data and an `AFTER INSERT` trigger that creates an `idle` state.

```sql
create type public.integration_provider as enum ('mock_pvs');
create type public.integration_sync_status as enum (
  'idle', 'healthy', 'retry_scheduled', 'failed'
);
create type public.integration_sync_error_code as enum (
  'rate_limited', 'temporarily_unavailable', 'network_unavailable',
  'source_contract_invalid', 'source_protocol_invalid',
  'configuration_invalid'
);

create table public.integration (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practice(id) on delete cascade,
  provider public.integration_provider not null,
  created_at timestamptz not null default now(),
  unique (practice_id, provider)
);
```

Make `integration_sync_state.integration_id` its primary key and foreign key to `integration`. Add only `status`, `confirmed_change_cursor`, `last_attempt_at`, `last_success_at`, `next_attempt_at`, `last_error_code` and `updated_at`; use check constraints so `healthy` has no error/retry time and `retry_scheduled` has both a retry error and future `next_attempt_at`. Create `integration_sync_event` with only integration ID, `succeeded|failed`, nullable approved error code, attempt time and retry time. Add indexes on event retention and due state, and a private 30-day purge function.

Enable RLS for every table, revoke all direct privileges from `public`, `anon` and `authenticated`, and grant table administration only to `service_role`. Define all `SECURITY DEFINER` functions with `set search_path = ''`; revoke all function privileges before granting execute on `public.read_integration_sync_status()` only to `authenticated`.

```sql
create or replace function public.read_integration_sync_status()
returns table (
  integration_id uuid,
  provider public.integration_provider,
  status public.integration_sync_status,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_attempt_at timestamptz,
  last_error_code public.integration_sync_error_code
)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  select integration.id, integration.provider, state.status,
         state.last_attempt_at, state.last_success_at,
         state.next_attempt_at, state.last_error_code
  from public.user_profile as profile
  join public.integration as integration on integration.practice_id = profile.practice_id
  join public.integration_sync_state as state on state.integration_id = integration.id
  where profile.user_id = auth.uid()
    and profile.role = 'praxisadmin';
end;
$$;
```

Write the private record and cursor-confirm functions so they accept only a known integration ID and approved enum values. Neither may log or accept a source resource, URL, header or token. Do not call either from application code in this feature.

Update the seed's typed database model and `SupabaseSeedAdminClient` to upsert `{ practice_id: practice.id, provider: 'mock_pvs' }` after the primary practice exists. The in-memory test client stores only practice IDs. Do not add any environment variable or connection field to seed code.

- [ ] **Step 4: Reset the authorised synthetic local database and run targeted verification.**

Run:

```powershell
npx supabase db reset --local
npm run seed
npx vitest run supabase/seed.test.ts
npx supabase test db --local --file supabase/tests/proj_3_integration_adapter.test.sql
```

Expected: migration and seed complete only with synthetic data; all new pgTAP assertions pass. If the reset or migration fails, stop and diagnose before changing the schema.

- [ ] **Step 5: Commit the database boundary.**

```powershell
git add supabase/migrations/20260913170000_proj_3_integration_adapter.sql supabase/tests/proj_3_integration_adapter.test.sql supabase/seed.ts supabase/seed.test.ts
git commit -m "feat(proj-3): persist protected integration status"
```

## Task 4: Server-side cursor-free status mapper

**Files:**
- Modify: `src/features/authorization/policy.ts`
- Modify: `src/features/authorization/policy.test.ts`
- Create: `src/features/integrations/sync-state.ts`
- Create: `src/features/integrations/read-sync-status.ts`
- Create: `src/features/integrations/read-sync-status.test.ts`

**Interfaces:**
- Consumes `ActorContext` and `mayUseCapability` from the existing authorization module.
- Produces `IntegrationSyncStatus` and `IntegrationSyncStateRepository` from `sync-state.ts` for later PROJ-4/5 execution work.
- Consumes `public.read_integration_sync_status()` from Task 3 through an injected RPC client.
- Produces `readIntegrationSyncStatus(client, actor): Promise<IntegrationSyncStatus | null>` for a later server component; no page or action calls it in PROJ-3.

- [ ] **Step 1: Write failing policy and status-mapper tests.**

Extend policy tests so only a practice-member `praxisadmin` receives
`integration.status.read`; rezeption, behandler and portaladmin return false.

For the mapper, use a fake RPC client. Verify it makes exactly this argument-free call for the allowed actor:

```ts
expect(client.rpc).toHaveBeenCalledWith(
  'read_integration_sync_status',
  {},
)
```

Verify it rejects malformed results, provider/error enum values outside the closed contract and database errors by returning `null` without forwarding a database or provider message. For every disallowed actor, assert the RPC client is never called. Assert the returned TypeScript object cannot contain `confirmedChangeCursor`, raw error text or a practice ID.

- [ ] **Step 2: Run tests and confirm the expected failures.**

Run:

```powershell
npx vitest run src/features/authorization/policy.test.ts src/features/integrations/read-sync-status.test.ts
```

Expected: FAIL because the capability and mapper module do not exist.

- [ ] **Step 3: Add the narrow capability and server-only mapper.**

Add `'integration.status.read'` to the closed `Capability` union and list. Return true only when `actor.kind === 'practice_member' && actor.role === 'praxisadmin'`.

Create `sync-state.ts` first. It imports `IntegrationFailureCode` from `adapter.ts` and exports the cursor-free status value plus the future writer contract; no production code instantiates the writer in PROJ-3:

```ts
export type IntegrationSyncStatus = {
  integrationId: string
  provider: 'mock_pvs'
  status: 'idle' | 'healthy' | 'retry_scheduled' | 'failed'
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  nextAttemptAt: string | null
  lastErrorCode: IntegrationFailureCode | null
}

export type IntegrationSyncResult = {
  integrationId: string
  outcome: 'succeeded' | 'failed'
  errorCode: IntegrationFailureCode | null
  retryAt: string | null
}

export interface IntegrationSyncStateRepository {
  recordResult(input: IntegrationSyncResult): Promise<void>
  confirmChangeCursor(input: { integrationId: string; cursor: string }): Promise<void>
}
```
Implement the mapper with `import 'server-only'`, an injected `rpc` shape and a strict response schema. It must not accept a practice ID:

```ts
export type IntegrationStatusRpcClient = {
  rpc(name: string, parameters: Record<string, never>): PromiseLike<{
    data: unknown
    error: unknown
  }>
}

export async function readIntegrationSyncStatus(
  client: IntegrationStatusRpcClient,
  actor: ActorContext,
): Promise<IntegrationSyncStatus | null> {
  if (!mayUseCapability(actor, 'integration.status.read')) return null
  const { data, error } = await client.rpc('read_integration_sync_status', {})
  const parsed = integrationSyncStatusSchema.safeParse(data)
  if (error || !parsed.success || parsed.data.length !== 1) return null
  return parsed.data[0]
}
```

Use schemas for a UUID, provider `mock_pvs`, all approved state/error enums and nullable ISO timestamps. Map snake_case RPC fields to the private TypeScript type without exposing cursor, practice ID or provider errors.

- [ ] **Step 4: Run focused server-boundary checks.**

Run:

```powershell
npx vitest run src/features/authorization/policy.test.ts src/features/integrations/read-sync-status.test.ts
npm run typecheck
npm run lint
```

Expected: all commands exit 0 and no file under `src/app/` changes.

- [ ] **Step 5: Commit the status-read boundary.**

```powershell
git add src/features/authorization/policy.ts src/features/authorization/policy.test.ts src/features/integrations/sync-state.ts src/features/integrations/read-sync-status.ts src/features/integrations/read-sync-status.test.ts
git commit -m "feat(proj-3): expose guarded integration status"
```

## Task 5: Documentation, full verification and review evidence

**Files:**
- Modify: `features/INDEX.md`
- Modify: `features/PROJ-3-integration-adapter-layer.md`
- Modify: `docs/superpowers/specs/2026-09-13-proj-3-integration-adapter-design.md`
- Modify: `README.md`
- Modify: `docs/architecture/api-contracts.md`
- Modify: `docs/architecture/data-model.md`
- Modify: `docs/delivery/acceptance-tests.md`
- Modify: `docs/delivery/known-issues.md`

**Interfaces:**
- Consumes the exact test counts and commands produced by Tasks 1–4.
- Produces an evidence-backed `In Review` feature record; it must not claim hosted operation, a real PVS connection, scheduler commissioning or Real-Data-Gate approval.

- [ ] **Step 1: Write the documentation assertions as a final checklist before editing status.**

Create a checklist in the feature spec that maps every acceptance criterion to its executed test: configuration and HTTP boundaries to Vitest, database access/retention to pgTAP, seed idempotence to `supabase/seed.test.ts`, and repository integration to `verify:full`. Leave hosted, scheduler, real provider and Real-Data-Gate entries explicitly open.

- [ ] **Step 2: Execute the required full verification with only synthetic configuration.**

Run in this order:

```powershell
npm run test:mock-pvs
npm run lint
npm run typecheck
npm test
npx supabase test db --local
npm run test:e2e:edge-required
npm run verify:full
git diff --check
```

Expected: every command exits 0. Record only commands actually run and their observed test totals. If any command fails, apply systematic debugging, fix the failure in the responsible task, then repeat the affected command and the final full run.

- [ ] **Step 3: Update durable documentation from verified evidence.**

Set PROJ-3 to `In Review` only after all commands in Step 2 pass. Mark only proven acceptance criteria `[x]`; append the exact local evidence date, commands and totals to the feature spec and acceptance document.

Update API contracts to name the server-only Mock-PVS adapter and its closed error boundary. Update the data model with the three technical integration entities, their field exclusions, RLS and 30-day event retention. In known issues, keep the explicit follow-ups: no scheduler/runtime identity, no status UI, no source-data import and no real PVS access. Keep the design document's status as locally implemented and `In Review` only when this evidence exists.

- [ ] **Step 4: Run documentation and secret-boundary checks.**

Run:

```powershell
git diff --check
rg -n "MOCK_PVS_TEST_TOKEN" src supabase --glob '!**/*.test.ts'
rg -n "MOCK_PVS_READ_TOKEN" src --glob '!src/features/integrations/mock-pvs-config.ts' --glob '!**/*.test.ts'
git status --short
```

Expected: `git diff --check` exits 0; both `rg` commands return no matches; status lists only intended PROJ-3 files.

- [ ] **Step 5: Commit the verified review state.**

```powershell
git add features/INDEX.md features/PROJ-3-integration-adapter-layer.md docs/superpowers/specs/2026-09-13-proj-3-integration-adapter-design.md README.md docs/architecture/api-contracts.md docs/architecture/data-model.md docs/delivery/acceptance-tests.md docs/delivery/known-issues.md
git commit -m "docs(proj-3): record adapter verification"
```

## Plan self-review

- **Spec coverage:** Task 1 covers D01–D05 and private configuration; Task 2 covers every source path and neutral error class; Task 3 covers D06–D08, state persistence, retention, RLS and synthetic seed; Task 4 adds the server-side capability and cursor-free read contract; Task 5 ties every acceptance criterion to recorded verification without advancing hosted or Real-Data-Gates.
- **Scope:** The plan contains no automatic execution, UI, patient/appointment persistence, real manufacturer connection, browser configuration or service-role application runtime.
- **Type consistency:** `IntegrationAdapter`, `AdapterResult`, `IntegrationFailureCode`, `MockPvsConfig` and `IntegrationSyncStatus` are each introduced before a later task consumes them. Public status RPC input remains `{}` throughout; practice scope is always derived in PostgreSQL.
- **No placeholders:** Migration name, file paths, enums, RPC name, tests, commands, commits and follow-up boundaries are explicit.
