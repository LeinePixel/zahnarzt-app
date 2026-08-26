# Handoff: DentPilot

**Last updated:** 2026-08-26

## Current state

PROJ-1 provides the Next.js 16/Supabase SSR foundation, EU-hosted schema, RLS, synthetic seed accounts, German login and protected account-status UI. It is `In Review`: automated QA and cloud setup are complete; real Safari, complete browser restart and controlled service-outage checks remain manual.

Binding status: [`features/INDEX.md`](features/INDEX.md) · PROJ-1: [`features/PROJ-1-supabase-infrastructure-setup.md`](features/PROJ-1-supabase-infrastructure-setup.md)

## Start here

- Recommended continuation: [`docs/superpowers/plans/2026-08-26-mvp-continuation-roadmap.md`](docs/superpowers/plans/2026-08-26-mvp-continuation-roadmap.md)
- Current implementation plan/evidence: [`docs/delivery/implementation-plan.md`](docs/delivery/implementation-plan.md) and [`docs/delivery/acceptance-tests.md`](docs/delivery/acceptance-tests.md)
- Privacy, security and AI gates: [`docs/architecture/privacy-security-ai-compliance.md`](docs/architecture/privacy-security-ai-compliance.md)
- Architecture and decisions: [`docs/architecture/overview.md`](docs/architecture/overview.md) and [`docs/architecture/decisions.md`](docs/architecture/decisions.md)
- Known debt and open decisions: [`docs/delivery/known-issues.md`](docs/delivery/known-issues.md) and [`docs/delivery/open-questions.md`](docs/delivery/open-questions.md)

## Local environment

```bash
npm install
npm run lint
npm test
npm run typecheck
npx supabase test db
npm run test:e2e:edge-required
npm run build
```

`.env.local` contains only the two public Supabase app values. `.env.seed.local` contains the service-role key and three synthetic seed passwords. Both real files are ignored; use `.env.local.example` and `.env.seed.local.example` as the variable-name reference. Never paste or commit their values.

## Next task

Start **PROJ-19 Audit Logging & Role Permissions** with brainstorming and a binding feature spec—do not implement it from the roadmap alone. Then architect a centralized authorization boundary, append-only minimized audit model and RLS/pgTAP strategy. PROJ-31 session hardening follows before patient-shaped data work.

## Non-negotiable gate

No real or re-identifiable patient/health data may enter development until the Real-Data-Gate is documented and approved. PROJ-19 and PROJ-31, legal/privacy decisions, provider reviews and operational security controls are prerequisites, not cleanup work.
