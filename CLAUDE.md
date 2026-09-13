# DentPilot Project Context

DentPilot is a German-language workflow, CRM, and automation application for dental practices. Existing practice-management software remains the source of truth for patients, treatments, billing, and appointments. The current implementation contains the secure Next.js/Supabase foundation and PROJ-19 audit/role authorization; most product features remain roadmap items.

Read `AGENTS.md` first for repository-wide operating rules. Use the root architecture, security, and decision documents as the canonical entry points; follow their links only when deeper context is needed.

## Current Stack

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS and copied shadcn/ui components in `src/components/ui/`
- Supabase PostgreSQL and Auth through `@supabase/ssr`
- Zod and react-hook-form for validation
- Vitest, pgTAP/Supabase CLI, and Playwright for verification
- Vercel is the planned hosting target; deployment is not configured yet

## Repository Map

```text
src/app/                 App Router pages and layouts
src/components/auth/     Login/logout presentation
src/components/ui/       Existing shadcn/ui primitives; reuse these
src/features/auth/       Authentication and current-user domain logic
src/lib/supabase/        Environment-specific browser/server/proxy clients
src/proxy.ts             Next.js 16 request protection entrypoint
supabase/migrations/     Versioned PostgreSQL schema and RLS policies
supabase/tests/          pgTAP/RLS isolation tests
supabase/seed.ts         CLI-only synthetic test-data provisioning
tests/                   Playwright browser and security flows
features/                Binding feature status and specifications
docs/                    Product, architecture, security, design, and delivery context
```

## Architecture Boundaries

- Pages and components call feature/domain functions; authentication logic belongs in `src/features/auth/` and audit authorization in `src/features/audit/`.
- Browser, Server Component, and proxy code use their dedicated client from `src/lib/supabase/` because their cookie capabilities differ.
- The proxy refreshes cookies and performs optimistic routing with verified `getClaims()` results. Protected Server Components verify claims again.
- PostgreSQL privileges and RLS are the authorization boundary. Proxy redirects and hidden UI are not authorization.
- Login and logout use Server Actions. PROJ-1 intentionally has no custom API routes.
- New practice-owned tables require `practice_id`, RLS, appropriate indexes, versioned migrations, and positive/negative pgTAP tests.

## Delivery Workflow

Before implementation, read `features/INDEX.md` and the relevant `features/PROJ-X-*.md`. Roadmap entries without an approved feature specification are not implementation instructions.

After feature work:

1. Update the feature specification with implementation and verification evidence.
2. Keep its status consistent with `features/INDEX.md`.
3. Record durable architectural decisions in `docs/architecture/decisions.md`.
4. Record unresolved debt or blockers in `docs/delivery/known-issues.md` or `docs/delivery/open-questions.md`.

## Verification

```bash
npm run verify          # lint, typecheck, Vitest tests, production build
npm run verify:full     # core checks plus pgTAP/RLS and required browser/Edge E2E
npm run dev             # development server on localhost:3000
npm run seed            # synthetic accounts; requires .env.seed.local
```

`verify:full` requires a running local Supabase/Docker environment, valid synthetic test configuration, installed Playwright browsers, and Microsoft Edge. The E2E server strips seed secrets before starting Next.js.

## Security and Data Rules

- Development and tests use synthetic data only.
- Real or re-identifiable patient/health data remains prohibited until the versioned Real-Data-Gate in `docs/architecture/privacy-security-ai-compliance.md` is approved.
- `.env.local` contains only public Supabase app values. `.env.seed.local` contains the service-role key and synthetic seed passwords.
- The service-role key is restricted to explicit CLI administration and must never enter application-server or browser environments.
- Server-side identity decisions use `getClaims()`, not unverified session data.
- Protected responses remain `private, no-store`; sensitive data stays out of URLs, browser storage, general logs, traces, screenshots, and analytics.
- Changes to authentication, RLS, secrets, or the Real-Data-Gate require focused security review and negative tests.

## Documentation Pointers

- Operating rules: `AGENTS.md`
- Product scope: `docs/PRD.md`, `docs/product/`, `features/INDEX.md`
- Current and planned architecture: `ARCHITECTURE.md`
- Security controls and gates: `SECURITY.md`
- Durable decisions: `DECISIONS.md`
- Data model and API boundaries: `docs/architecture/data-model.md`, `docs/architecture/api-contracts.md`
- Current handoff and verification evidence: `HANDOFF.md`, `docs/delivery/`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
