# DentPilot MVP Continuation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:brainstorming` and `superpowers:writing-plans` for each not-yet-specified feature. Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` only after its spec and architecture are approved.

**Goal:** Continue from the completed PROJ-1 foundation to a secure, synthetic-data MVP without opening the real-patient-data gate prematurely.

**Architecture:** Keep Next.js 16 App Router, Supabase SSR cookies, verified server claims and database RLS. Build the authorization/audit and session-hardening foundations before introducing patient-shaped data, then add a synthetic PVS boundary and downstream vertical slices.

**Tech Stack:** Next.js 16.3.2, React 19, TypeScript, Supabase EU/PostgreSQL/Auth/RLS, Zod, Vitest, pgTAP and Playwright.

**Specs:** `features/INDEX.md`; PROJ-1 binding spec at `features/PROJ-1-supabase-infrastructure-setup.md`; cross-cutting gate at `docs/architecture/privacy-security-ai-compliance.md`.

## Global Constraints

- Use only synthetic data until the documented Real-Data-Gate is approved.
- No service-role key, passwords, tokens, patient data or health data in browser storage, URLs, logs, telemetry, test artifacts or commits.
- Every new table starts with RLS, least-privilege grants and negative cross-tenant/write tests.
- Every feature starts with an approved feature spec, architecture review and its own test-driven implementation plan.
- PROJ-19 and PROJ-31 must be complete before any real or re-identifiable patient data.
- External providers require EU-region, AVV/subprocessor/transfer, retention and training-use review before integration.
- PROJ-15/16 require AI Act and possible medical-device-purpose classification before implementation.

---

## Phase 0: Close PROJ-1 Manual Review Gates

**Status:** Automated implementation is complete and `In Review`; this phase does not block synthetic planning for PROJ-19.

- [ ] Run a real Safari smoke on macOS/iOS and record browser/version/result in `docs/delivery/acceptance-tests.md`.
- [ ] Close and reopen the browser completely and confirm the cookie session persists without Local Storage.
- [ ] Simulate Supabase unavailability in a controlled development environment and confirm the neutral service-unavailable UI.
- [ ] Keep PROJ-1 `In Review` until these checks pass; move to `Approved` only with recorded evidence.

## Phase 1: PROJ-19 Audit Logging & Role Permissions — Next Task

**Why first:** Authentication exists, but stored roles currently do not authorize actions and security-relevant access is not audited. Adding features before this would spread authorization logic and create unverifiable access paths.

### Deliverable A: Specification and threat model

- [ ] Read `docs/architecture/privacy-security-ai-compliance.md`, `docs/architecture/data-model.md`, PROJ-1 RLS/migration code and all role references.
- [ ] Use `superpowers:brainstorming` to confirm the permission matrix for `rezeption`, `behandler` and `praxisadmin`; distinguish read, create, update, delete, export and administration.
- [ ] Define audit events, lawful purpose, actor/tenant/resource metadata, prohibited payloads, retention, access rights and tamper-resistance expectations.
- [ ] Write `features/PROJ-19-audit-logging-and-role-permissions.md` with Given/When/Then criteria, negative authorization cases, edge cases and explicit out-of-scope items.
- [ ] Review the spec against DSGVO data minimization, accountability and access-control requirements; keep legal approval as a Real-Data-Gate item.
- [ ] Commit the approved spec separately.

### Deliverable B: Architecture and implementation plan

- [ ] Define one centralized authorization interface consumed by server actions/components; database RLS remains the final authority.
- [ ] Design append-only audit storage without request bodies, tokens, passwords, free text or health content.
- [ ] Define actor, practice, action, resource type/ID, outcome, timestamp and correlation identifier types.
- [ ] Design RLS/grants, audit-read permissions, retention/deletion mechanism and negative pgTAP coverage.
- [ ] Write an ADR and a detailed TDD implementation plan under `docs/superpowers/plans/`.
- [ ] Do not implement until the user approves spec and architecture.

### Deliverable C: Test-driven implementation

- [ ] Implement the approved permission matrix and audit boundary test-first.
- [ ] Add unit tests for every allow/deny branch and payload redaction.
- [ ] Add pgTAP tests for anonymous, cross-practice, wrong-role and forbidden mutation access.
- [ ] Add Playwright tests for role-visible/hidden actions and safe audit administration where specified.
- [ ] Run lint, all unit tests, typecheck, pgTAP, production E2E and build; request independent code review.

## Phase 2: PROJ-31 Session Hardening

**Why now:** Shared dental-practice workstations require idle locking, maximum session lifetime and deliberate re-authentication before patient-shaped data is introduced.

- [ ] Specify inactivity timeout, absolute session lifetime, MFA policy, re-authentication triggers and shared-device behavior with the user/security owner.
- [ ] Decide which controls live in Supabase Auth, Next.js and the client activity monitor; document clock/race/failure behavior.
- [ ] Implement synthetic-account tests for idle lock, multi-tab synchronization, back navigation, refresh-token expiry and recovery.
- [ ] Add the completed controls to the Real-Data-Gate evidence.

## Phase 3: Synthetic PVS Foundation

1. **PROJ-2 Mock PVS Service** — synthetic patients/appointments only; include E.164 phone normalization for future PROJ-29, deterministic fixtures, pagination, failures and rate limits.
2. **PROJ-3 Integration Adapter Layer** — canonical internal contracts, idempotency, retry/backoff, source identifiers and strict boundary validation.
3. **PROJ-4 Patient Synchronization** — synthetic tenant-scoped patient records, minimization, conflict handling, RLS and audit integration.
4. **PROJ-5 Appointment Synchronization** — synthetic appointments, timezone/DST rules, cancellations/rescheduling, RLS and audit integration.

Each feature must complete: spec → architecture/threat review → detailed TDD plan → implementation → independent review → acceptance evidence.

## Phase 4: Core Practice Workflows

Recommended order after PROJ-2 through PROJ-5:

1. PROJ-6 Patient overview and 360° profile
2. PROJ-7 Day/week/month appointment overview
3. PROJ-9 CRM and follow-up tasks
4. PROJ-11 Communication template editor
5. PROJ-10 Rule engine
6. PROJ-18 Dashboard shell over implemented capabilities

Keep all data synthetic. PROJ-8 patient timeline follows only after its contributing sources are stable.

## Phase 5: External Communication

1. PROJ-12 Resend email integration
2. PROJ-13 Communication automation
3. PROJ-29 Caller recognition, after PBX and ambiguous-number rules are decided

Before connecting any provider: complete AVV, EU-region/subprocessor/third-country, retention, deletion, incident and secret-rotation checks. Add consent/legal-basis requirements to the feature spec rather than guessing them in code.

## Phase 6: AI and Clinical-Sensitive Features

1. PROJ-14 Transcript integration
2. PROJ-15 AI information extraction
3. PROJ-16 Cost-estimate draft
4. PROJ-17 Patient metrics
5. PROJ-8 Aggregated patient timeline

Do not begin PROJ-15/16 implementation until the AI-impact assessment defines provider data use, human oversight, transparency, logging, AI Act classification and whether the intended purpose can trigger medical-device law.

## Later Roadmap

- PROJ-20 analytics, PROJ-21 transparent patient rating, PROJ-22 raw transcript processing and PROJ-23 real PVS adapter after their dependencies and contracts stabilize.
- PROJ-24 multi-tenant migration before adding a second real practice.
- PROJ-25/26/27/28/30 after MVP evidence supports their priority.

## Definition of Ready for Every Feature

- [ ] Binding spec exists with acceptance criteria, error states and out-of-scope section.
- [ ] Privacy/security impact and data categories are documented.
- [ ] Authorization and audit behavior are explicit.
- [ ] Architecture interfaces, migrations and rollback strategy are approved.
- [ ] A detailed test-first implementation plan exists.

## Definition of Done for Every Feature

- [ ] Unit/integration tests, RLS tests where applicable, E2E and production build pass.
- [ ] No secret/PII/health-data leakage in source, URLs, logs, storage or artifacts.
- [ ] Documentation and feature status reflect evidence, not intent.
- [ ] Independent code review has no unresolved Critical or Important findings.
- [ ] Manual/provider/legal gates remain visibly open until actually completed.
