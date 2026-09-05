# DentPilot

DentPilot ist eine deutschsprachige Workflow-, CRM- und Automatisierungsanwendung für Zahnarztpraxen. Die bestehende Praxissoftware bleibt führend für Patienten-, Behandlungs-, Abrechnungs- und Termindaten; DentPilot ergänzt praxisübergreifende Abläufe, Kommunikation, Auswertung und später KI-gestützte Vorbereitung.

## Aktueller Stand

PROJ-1 stellt die technische Grundlage bereit; PROJ-19 ergänzt sie um die lokal verifizierte Rollen- und Auditgrenze:

- Next.js-16-Anwendung mit deutscher Login-Oberfläche
- Cookie-basierte Supabase-SSR-Sitzung
- geschützte Kontostatus-Seite
- Praxis- und Benutzerprofilmodell mit PostgreSQL-RLS
- synthetische Seed-Konten für zwei Praxen sowie die getrennte `portaladmin`-Identität
- PROJ-19-Audit-/Rollenautorisierung mit praxisinitiierter, zeitlich begrenzter Supportfreigabe
- Unit-, RLS- und browserübergreifende Auth-/Security-Tests

PROJ-1 und PROJ-19 sind `In Review`: lokale automatisierte Abnahme ist dokumentiert. Echter Safari-Smoke, vollständiger Browser-Neustart, kontrollierte Dienstunterbrechung, Hosted-Cron-Commissioning sowie MFA/Re-Authentisierung bleiben vor Produktions- und Real-Data-Freigabe offene Gates. Der verbindliche Status steht in [`features/INDEX.md`](features/INDEX.md).

## Technologie

- Next.js 16, React 19 und TypeScript
- Tailwind CSS und shadcn/ui
- Supabase PostgreSQL, Auth und `@supabase/ssr`
- Zod und react-hook-form
- Vitest, pgTAP/Supabase CLI und Playwright
- Vercel als geplantes Hosting-Ziel

## Lokale Einrichtung

Voraussetzungen:

- Node.js und npm
- Docker für den lokalen Supabase-Stack und die RLS-Tests
- Playwright-Browser; Microsoft Edge für die vollständige Abnahme

```bash
npm install
npx playwright install chromium firefox webkit
```

Konfiguration:

1. `.env.local.example` nach `.env.local` kopieren und die beiden öffentlichen Supabase-App-Werte setzen.
2. `.env.seed.local.example` nach `.env.seed.local` kopieren und ausschließlich dort Service-Role-Key und synthetische Seed-Passwörter setzen.
3. Docker Desktop starten und den lokalen Supabase-Stack aufbauen:

```bash
npx supabase start
npx supabase db reset
npx supabase test db --local
```

`supabase start` startet die lokalen Dienste. `supabase db reset` baut die lokale Datenbank aus den versionierten Migrationen reproduzierbar neu auf. Anschließend legt `npm run seed` die synthetischen Konten an. Mit `npx supabase stop` wird der Stack wieder beendet.

`.env.local` und `.env.seed.local` werden ignoriert. Zugangsdaten oder echte Patienteninformationen gehören weder in das Repository noch in Testausgaben.

## Entwicklung und Verifikation

```bash
npm run dev             # Entwicklungsserver auf http://localhost:3000
npm run seed            # zwei synthetische Praxen und vier Demo-Konten einschließlich portaladmin
npm run verify          # Lint, Typecheck, Vitest und Produktions-Build
npm run verify:full     # zusätzlich pgTAP/RLS und verpflichtende Browser-/Edge-E2E
```

Einzelne Prüfungen:

```bash
npm run lint
npm run typecheck
npm test
npx supabase test db --local
npm run test:e2e
npm run test:e2e:edge-required
npm run build
```

`verify:full` benötigt eine passende lokale Supabase-/Docker-Umgebung, synthetische Cloud-Testkonfiguration, installierte Playwright-Browser und Microsoft Edge.

## Repository-Struktur

```text
src/app/                 Next.js App-Router-Seiten
src/components/          Auth-Oberfläche und shadcn/ui-Bausteine
src/features/auth/       Login-, Logout- und Kontokontext-Logik
src/lib/supabase/        Browser-, Server- und Proxy-Clients
supabase/migrations/     versioniertes Schema und RLS-Policies
supabase/tests/          pgTAP-Sicherheitstests
tests/                   Playwright-E2E- und Security-Flows
features/                Feature-Status und verbindliche Specs
docs/                    Produkt-, Architektur-, Sicherheits- und Lieferdokumentation
```

## Architektur- und Sicherheitsgrenzen

- Der Next.js-Proxy aktualisiert Auth-Cookies und trifft Routing-Entscheidungen nur anhand verifizierter Claims.
- Geschützte Server-Komponenten prüfen die Identität erneut.
- Datenbankrechte und RLS bilden die Autorisierungsgrenze.
- Der Service-Role-Key ist ausschließlich für das CLI-Seed-Skript vorgesehen.
- Bis zur dokumentierten Freigabe des Real-Data-Gates sind nur synthetische Daten erlaubt.
- PROJ-19-Rollenautorisierung und Audit-Logging sind lokal verifiziert und `In Review`; Hosted-Cron-Commissioning, MFA und Inaktivitätssperre bleiben vor der Produktions- und Real-Data-Freigabe offen.

## Projektdokumentation

- Arbeitsregeln für Coding-Agenten: [`AGENTS.md`](AGENTS.md)
- Einstieg und aktueller Handoff: [`HANDOFF.md`](HANDOFF.md)
- Produktanforderungen: [`docs/PRD.md`](docs/PRD.md)
- Feature-Status: [`features/INDEX.md`](features/INDEX.md)
- Architektur: [`ARCHITECTURE.md`](ARCHITECTURE.md), vertieft in [`docs/architecture/overview.md`](docs/architecture/overview.md)
- Sicherheit: [`SECURITY.md`](SECURITY.md), vertieft in [`docs/architecture/privacy-security-ai-compliance.md`](docs/architecture/privacy-security-ai-compliance.md)
- Entscheidungen: [`DECISIONS.md`](DECISIONS.md), vollständiger Log in [`docs/architecture/decisions.md`](docs/architecture/decisions.md)
- Datenmodell: [`docs/architecture/data-model.md`](docs/architecture/data-model.md)
- Schulden und offene Fragen: [`docs/delivery/known-issues.md`](docs/delivery/known-issues.md), [`docs/delivery/open-questions.md`](docs/delivery/open-questions.md)

## Arbeitsweise

Vor der Implementierung eines Features müssen dessen Status und Spec in `features/` geprüft werden. Roadmap-Einträge ohne freigegebene Spec sind keine Implementierungsgrundlage. Dauerhafte technische Entscheidungen werden im Decision Log erfasst; offene Risiken und unbestätigte Annahmen bleiben ausdrücklich als solche dokumentiert.
