# Handoff: DentPilot

**Sicherheitsfortsetzung 07.09.2026:** Aktuelle Arbeitspakete und Abnahmekriterien stehen im [Security-Umsetzungsplan](docs/superpowers/plans/2026-09-07-security-remediation.md). Alle neun Auditbefunde bleiben bis zu ihrer belegten Korrektur offen; bestehende Architektur und historische Abnahmen bleiben erhalten.

**Last updated:** 2026-09-07

## Current state

PROJ-1 provides the Next.js 16/Supabase SSR foundation, RLS, synthetic seed accounts, German login and protected account-status UI. PROJ-19 adds role authorization, a separated `portaladmin` identity and a minimized audit stream available only through active, practice-initiated, time-limited support access. Both are `In Review`: local automated QA is complete; real Safari, complete browser restart, controlled service outage, scheduler monitoring and evidence of an executed purge, MFA/re-authentication and the Real-Data-Gate remain open.

Binding status: [`features/INDEX.md`](features/INDEX.md) · PROJ-1: [`features/PROJ-1-supabase-infrastructure-setup.md`](features/PROJ-1-supabase-infrastructure-setup.md) · PROJ-19: [`features/PROJ-19-audit-logging-and-role-permissions.md`](features/PROJ-19-audit-logging-and-role-permissions.md)

## Start here

- Repository rules: [`AGENTS.md`](AGENTS.md)
- Architecture, security and durable decisions: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`SECURITY.md`](SECURITY.md), [`DECISIONS.md`](DECISIONS.md)
- Recommended continuation: [`docs/superpowers/plans/2026-08-26-mvp-continuation-roadmap.md`](docs/superpowers/plans/2026-08-26-mvp-continuation-roadmap.md)
- Current implementation plan/evidence: [`docs/delivery/implementation-plan.md`](docs/delivery/implementation-plan.md) and [`docs/delivery/acceptance-tests.md`](docs/delivery/acceptance-tests.md)
- Privacy, security and AI details: [`docs/architecture/privacy-security-ai-compliance.md`](docs/architecture/privacy-security-ai-compliance.md)
- Detailed architecture and decision history: [`docs/architecture/overview.md`](docs/architecture/overview.md) and [`docs/architecture/decisions.md`](docs/architecture/decisions.md)
- Known debt and open decisions: [`docs/delivery/known-issues.md`](docs/delivery/known-issues.md) and [`docs/delivery/open-questions.md`](docs/delivery/open-questions.md)

## Local environment

```bash
npm install
npm run verify
npm run verify:full
```

`verify` führt Lint, Typecheck, Vitest und den Produktions-Build aus. `verify:full` ergänzt die lokalen pgTAP-/RLS-Tests sowie die verpflichtende Browser-/Edge-E2E-Abnahme und benötigt dafür Docker/Supabase, synthetische Testkonfiguration, installierte Playwright-Browser und Microsoft Edge.

`.env.local` contains only the two public Supabase app values. `.env.seed.local` contains the service-role key and four synthetic seed passwords for the two practices and separate portaladmin identity. Both real files are ignored; use `.env.local.example` and `.env.seed.local.example` as the variable-name reference. Never paste or commit their values.

## Next task

Start with T00 (dependency patches) and T01 (approved PROJ-31/19 specifications) in the security remediation plan. Scheduler commissioning alone no longer represents the full remaining scope.

Hosted migrations, daily purge scheduling and synthetic cloud acceptance are documented as of 2026-09-06 in docs/delivery/acceptance-tests.md. Complete scheduler monitoring and record an executed purge before PROJ-19 operational approval. PROJ-31 session hardening (MFA, inactivity and re-authentication) follows before patient-shaped data work.

## Non-negotiable gate

No real or re-identifiable patient/health data may enter development until the Real-Data-Gate is documented and approved. PROJ-19 operational commissioning, PROJ-31, legal/privacy decisions, provider reviews and operational security controls are prerequisites, not cleanup work.
