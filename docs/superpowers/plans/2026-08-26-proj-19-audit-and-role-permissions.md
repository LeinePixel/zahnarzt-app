# PROJ-19 Audit Logging & Role Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Enforce the approved role boundary, provide practice-approved temporary provider audit access, and retain data-minimized audit events for 90 days.

**Architecture:** A small TypeScript policy module rejects impossible role/capability combinations before a server adapter calls Postgres. PostgreSQL remains authoritative: protected RPC functions validate identity, tenant, grant and expiry, then write the audit event in the same transaction as the protected action. A private database function is invoked daily by pg_cron; no browser or application role can run the purge.

**Tech Stack:** Next.js 16.3.2, TypeScript 5, React 19, Supabase Auth/PostgreSQL/RLS, PostgreSQL pg_cron, Zod 4, Vitest 4, pgTAP and Playwright.

**Spec:** features/PROJ-19-audit-logging-and-role-permissions.md; docs/superpowers/specs/2026-08-26-proj-19-audit-and-authorization-design.md; docs/architecture/proj-19-threat-model.md.

## Global Constraints

- Use synthetic data only; this feature does not open the Real-Data-Gate.
- portaladmin is a separate provider identity, never a user_profile role or an implicit practice member.
- Practice roles cannot read, export, update or delete audit events.
- A practice admin grants access only to its own practice. Default duration is eight hours; maximum is 24 hours; expiry and revocation take effect on the next query.
- Store only actor, known practice, controlled action/object/outcome, timestamp and correlation ID. Never store free text, patient data, request/response bodies, tokens, passwords, prompts or IP addresses.
- RLS is enabled and direct API grants are revoked for every new table. Every exposed RPC revokes default execution from public and anon.
- SECURITY DEFINER is used only for the approved RPC boundary, always pins search_path = '', schema-qualifies every relation and validates every parameter.
- Break-Glass, audit export, external tickets, provider access to clinical/fach content, user management, MFA implementation and Real-Data-Gate approval are out of scope.

---

### Task 1: Restore the local database test feedback loop

**Files:**
- Modify: none.

**Interfaces:**
- Consumes: supabase/config.toml database port 55422.
- Produces: an agent-runnable npx supabase test db baseline.

- [ ] **Step 1: Prove the current readiness state.**

~~~
docker port supabase_db_zahnarzt-app
Test-NetConnection 127.0.0.1 -Port 55422
~~~

Expected: Docker publishes 55422 and TcpTestSucceeded is True.

- [ ] **Step 2: Recreate only the local synthetic stack if the port is absent.**

~~~
npx supabase stop
npx supabase start
docker port supabase_db_zahnarzt-app
~~~

Expected: 5432/tcp maps to host port 55422; no cloud project is touched.

- [ ] **Step 3: Run the current pgTAP suite.**

Run: npx supabase test db

Expected: existing PROJ-1 suites pass before a PROJ-19 migration exists.

### Task 2: Define the red database-security contract

**Files:**
- Create: supabase/tests/proj_19_audit_authorization.test.sql
- Test: supabase/tests/proj_19_audit_authorization.test.sql

**Interfaces:**
- Consumes: practice, user_profile, auth.users and the current JWT pgTAP setup.
- Produces: failing tests for portal_admin, support_access_grant, audit_event and the Task-3 functions.

- [ ] **Step 1: Write the schema and privilege assertions.**

~~~sql
select has_table('public', 'portal_admin');
select has_table('public', 'support_access_grant');
select has_table('public', 'audit_event');
select ok(not has_table_privilege('authenticated', 'public.audit_event', 'SELECT'));
select ok(not has_table_privilege('authenticated', 'public.audit_event', 'UPDATE'));
select ok(not has_table_privilege('authenticated', 'public.audit_event', 'DELETE'));
~~~

- [ ] **Step 2: Add fixed fixtures and negative authorization cases.**

Create two practices, a praxisadmin, a rezeption user and two portal-admin identities. Set request.jwt.claim.sub and request.jwt.claim.role = authenticated per role block. Prove: only the practice admin requests its own grant; no portal admin reads before activation; a second portal admin cannot reuse another admin’s grant.

- [ ] **Step 3: Add atomicity, expiry and purge tests.**

~~~sql
select throws_ok(
  $$ select * from public.read_audit_events('<foreign-practice>', now(), 50) $$,
  '42501', null, 'ungranted portal access is denied'
);
select is(
  (select count(*) from public.audit_event where action = 'audit_read'),
  1::bigint, 'an allowed audit read records itself'
);
~~~

Also assert: revoked and expired grants return no rows; 25 hours is rejected; direct mutations fail; purge deletes occurred_at <= now() - interval '90 days' and keeps a newer event.

- [ ] **Step 4: Run the focused suite to red.**

Run: npx supabase test db --file supabase/tests/proj_19_audit_authorization.test.sql

Expected: FAIL because tables and functions do not exist.

- [ ] **Step 5: Commit the red contract.**

~~~
git add supabase/tests/proj_19_audit_authorization.test.sql
git commit -m "test: define PROJ-19 database security contract"
~~~

### Task 3: Implement the authoritative Postgres boundary

**Files:**
- Create: supabase/migrations/20260827090000_proj_19_audit_authorization.sql
- Modify: supabase/tests/proj_19_audit_authorization.test.sql
- Test: supabase/tests/proj_19_audit_authorization.test.sql

**Interfaces:**
- Consumes: Task-2 contract.
- Produces:

~~~sql
public.request_support_access(p_requested_duration interval) returns uuid
public.activate_support_access(p_grant_id uuid, p_reason public.support_reason) returns timestamptz
public.revoke_support_access(p_grant_id uuid) returns void
public.read_audit_events(p_practice_id uuid, p_before timestamptz, p_limit integer)
  returns table(actor_id uuid, occurred_at timestamptz, action public.audit_action, outcome public.audit_outcome, resource_type text, resource_id uuid, correlation_id uuid)
private.purge_expired_audit_events() returns integer
~~~

- [ ] **Step 1: Create types, tables, indices and RLS before functions.**

~~~sql
create type public.audit_outcome as enum ('allowed', 'denied', 'failed');
create type public.audit_action as enum (
  'support_access_requested',
  'support_access_activated',
  'support_access_revoked',
  'audit_read'
);
create type public.support_reason as enum ('technical_investigation', 'account_support');
create table public.portal_admin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.support_access_grant (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practice(id) on delete cascade,
  requested_by uuid not null references public.user_profile(user_id) on delete restrict,
  activated_by uuid references public.portal_admin(user_id) on delete restrict,
  requested_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  support_reason public.support_reason,
  check (expires_at > requested_at and expires_at <= requested_at + interval '24 hours')
);
~~~

Create audit_event with UUID primary key, nullable practice_id only for denied pre-scope attempts, actor ID, controlled action/outcome, controlled resource_type, opaque UUID resource_id, occurred_at and correlation_id. Index practice_id plus occurred_at descending, and occurred_at. Enable RLS; revoke all table access from public, anon and authenticated; grant maintenance access only to service_role.

- [ ] **Step 2: Implement the three grant lifecycle functions.**

Every function is SECURITY DEFINER SET search_path = '', uses auth.uid(), schema-qualifies relations and has default execution revoked. request_support_access allows only the caller’s praxisadmin profile, defaults null duration to eight hours and rejects duration over 24 hours. activate_support_access requires a portal_admin identity, locks the row with FOR UPDATE, rejects activated/revoked/expired rows and stores the controlled reason. revoke_support_access requires the owning practice admin and writes revoked_at once. Each writes an allowed or denied audit event in the same transaction.

- [ ] **Step 3: Implement bounded atomic audit reading.**

read_audit_events verifies an active, unrevoked grant for auth.uid() and p_practice_id, accepts p_limit from 1 through 100, writes audit_read before returning data and orders by occurred_at descending then id descending. It has no text parameter, no export mode and returns only the declared metadata. A denial raises 42501 without revealing if a practice or grant exists.

- [ ] **Step 4: Implement the private daily purge.**

~~~sql
create or replace function private.purge_expired_audit_events()
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted_count integer;
begin
  delete from public.audit_event
  where occurred_at <= now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
select cron.schedule(
  'dentpilot-purge-expired-audit-events',
  '17 3 * * *',
  $$select private.purge_expired_audit_events();$$
);
~~~

Enable pg_cron, do not expose private through the Data API and revoke application execution on the purge function.

- [ ] **Step 5: Run database tests green and commit.**

~~~
npx supabase test db --file supabase/tests/proj_19_audit_authorization.test.sql
npx supabase test db
git add supabase/migrations/20260827090000_proj_19_audit_authorization.sql supabase/tests/proj_19_audit_authorization.test.sql
git commit -m "feat: add PROJ-19 audit authorization database boundary"
~~~

Expected: every existing and PROJ-19 pgTAP test passes.

### Task 4: Add the central TypeScript policy seam

**Files:**
- Create: src/features/authorization/policy.ts
- Create: src/features/authorization/policy.test.ts

**Interfaces:**

~~~ts
export type Capability = 'support_access.request' | 'support_access.revoke' | 'audit.read'
export type ActorContext =
  | { kind: 'practice_member'; userId: string; practiceId: string; role: 'rezeption' | 'behandler' | 'praxisadmin' }
  | { kind: 'portal_admin'; userId: string }
export function mayUseCapability(actor: ActorContext, capability: Capability): boolean
export class AuthorizationError extends Error {}
~~~

- [ ] **Step 1: Write the failing capability matrix.**

~~~ts
expect(mayUseCapability(rezeption, 'audit.read')).toBe(false)
expect(mayUseCapability(praxisadmin, 'support_access.request')).toBe(true)
expect(mayUseCapability(portalAdmin, 'audit.read')).toBe(true)
expect(mayUseCapability(portalAdmin, 'support_access.request')).toBe(false)
~~~

Add malformed role/context cases that throw AuthorizationError rather than allowing a fallback.

- [ ] **Step 2: Run red, implement, run green and commit.**

~~~
npm test -- src/features/authorization/policy.test.ts
git add src/features/authorization/policy.ts src/features/authorization/policy.test.ts
git commit -m "feat: add centralized PROJ-19 capability policy"
~~~

The module only rejects impossible role combinations; ownership, grant state and expiry remain Task-3 database facts.

### Task 5: Add server adapters and minimal practice/portal flows

**Files:**
- Create: src/features/audit/support-access.ts, src/features/audit/support-access.test.ts
- Create: src/features/audit/read-events.ts, src/features/audit/read-events.test.ts
- Create: src/app/status/support-access-actions.ts
- Modify: src/app/status/page.tsx, src/app/status/page.test.tsx
- Create: src/app/portal/audit/page.tsx, src/app/portal/audit/page.test.tsx
- Modify: src/proxy.ts, src/lib/supabase/proxy.test.ts

**Interfaces:**
- Consumes: Task-3 RPCs and Task-4 policy.
- Produces: server-only operations and an audit view limited to 100 events.

- [ ] **Step 1: Write the adapter tests first.**

~~~ts
await expect(requestSupportAccess(client, { requestedDurationHours: 25 })).rejects.toThrow('maximal 24 Stunden')
await expect(readAuditEvents(client, { practiceId: 'bad', limit: 101 })).rejects.toThrow('zwischen 1 und 100')
expect(client.rpc).toHaveBeenCalledWith('read_audit_events', expect.not.objectContaining({ query: expect.anything() }))
~~~

- [ ] **Step 2: Implement Zod validation and neutral errors.**

Accept only duration 1–24, default eight hours, the two support-reason values, UUID practice IDs and limits 1–100. Never accept support text. Translate database denial/provider failure to German neutral errors without SQL, tenant or credential detail.

- [ ] **Step 3: Write and implement page tests.**

The status page renders the support-access action only for mocked praxisadmin. The portal page renders fixed actor, time, action, outcome and opaque-object columns for an allowed result, a neutral denied state without active grant, no control named Export and no free-text search. Extend proxy protection to /portal/* while retaining query-free redirects and private, no-store.

- [ ] **Step 4: Run focused tests and commit.**

~~~
npm test -- src/features/authorization/policy.test.ts src/features/audit/support-access.test.ts src/features/audit/read-events.test.ts src/app/portal/audit/page.test.tsx src/lib/supabase/proxy.test.ts
git add src/features src/app/status/support-access-actions.ts src/app/portal src/proxy.ts src/lib/supabase/proxy.test.ts
git commit -m "feat: add PROJ-19 practice and provider audit flows"
~~~

### Task 6: Seed synthetic provider accounts and prove the browser flows

**Files:**
- Modify: .env.seed.local.example, supabase/seed-env.ts, supabase/seed-env.test.ts, supabase/seed.ts, supabase/seed.test.ts
- Create: tests/audit-access.spec.ts

**Interfaces:**
- Consumes: a new seed-only SEED_PORTALADMIN_PASSWORD.
- Produces: one synthetic portal admin with no user_profile plus E2E proof.

- [ ] **Step 1: Write red seed tests.**

Assert the new password is required only in .env.seed.local, absent from .env.local.example, and the seed creates exactly one portal_admin mapping with no practice profile.

- [ ] **Step 2: Implement and prove the seed extension.**

~~~
npm test -- supabase/seed-env.test.ts supabase/seed.test.ts
npm run seed
~~~

Keep all portal passwords out of browser-visible environment, screenshots, traces, reports and logs.

- [ ] **Step 3: Write and run the E2E scenarios.**

Log in as a seeded practice admin, request a grant, prove the portal admin cannot read before activation, activate, read only that practice, revoke, reload and see denial. Assert no element has accessible name containing Export and a foreign-practice URL produces the neutral denial page.

~~~
npm run test:e2e:edge-required -- tests/audit-access.spec.ts
git add .env.seed.local.example supabase tests/audit-access.spec.ts
git commit -m "test: cover PROJ-19 provider audit access"
~~~

### Task 7: Verify, review and record evidence

**Files:**
- Modify: features/PROJ-19-audit-logging-and-role-permissions.md
- Modify: docs/delivery/acceptance-tests.md

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: evidence-backed status; never a Real-Data-Gate approval.

- [ ] **Step 1: Run the complete verification set.**

~~~
npm run lint
npm test
npm run typecheck
npx supabase test db
npm run test:e2e:edge-required
npm run build
~~~

Expected: every command exits 0. On any failure, stop and use systematic debugging before changing implementation.

- [ ] **Step 2: Verify the hosted purge job with an approved, non-secret administrative session.**

~~~sql
select jobname, schedule, command
from cron.job
where jobname = 'dentpilot-purge-expired-audit-events';
~~~

Expected: exactly one job, schedule 17 3 * * *, command select private.purge_expired_audit_events(); Record only metadata, never credentials or event rows.

- [ ] **Step 3: Request independent review and write evidence.**

Review SECURITY DEFINER functions, grants/RLS, cross-tenant cases, expiry/revocation races, minimization and secret leakage. Resolve Critical and Important findings, then append actual dates, commands and results to feature evidence.

~~~
git add features/PROJ-19-audit-logging-and-role-permissions.md docs/delivery/acceptance-tests.md
git commit -m "docs: record PROJ-19 acceptance evidence"
~~~

## Plan Self-Review

- Tasks 2–3 cover schema, RLS, grants, atomic audit behavior and 90-day deletion.
- Task 4 establishes the central authorization seam; Task 5 makes it the server/UI path; Task 6 supplies isolated synthetic E2E proof.
- Break-Glass, export, provider access beyond audit metadata, MFA and real-data approvals remain explicitly excluded, as required by the approved specification.
