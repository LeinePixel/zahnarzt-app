# Projektanweisungen

## Projektüberblick

DentPilot ist eine deutschsprachige Workflow-, CRM- und Automatisierungsanwendung für Zahnarztpraxen. Die vorhandene Praxissoftware bleibt Source of Truth für Patienten, Behandlungen, Abrechnung und Termine. Implementiert sind PROJ-1 (Supabase-/Anmeldefundament) und PROJ-19 (praxisgebundene Audit- und Rollenautorisierung mit getrennten `portaladmin`-Identitäten und zeitlich begrenzter Supportfreigabe). PROJ-19 ist lokal abgenommen, bleibt bis zur betrieblichen Freigabe `In Review`.

## Verbindlicher Kontext

Vor jeder Änderung:

1. features/INDEX.md lesen und den Status des betroffenen Features prüfen.
2. Die zugehörige features/PROJ-X-*.md vollständig lesen.
3. Bei Architektur-, Auth-, Daten- oder Integrationsarbeit die passenden Root-Dokumente lesen.
4. Roadmap-Einträge ohne freigegebene Spec erst spezifizieren; sie sind keine Implementierungsgrundlage.

Bei Widersprüchen gelten direkte System- und Nutzeranweisungen zuerst. Den belegten Ist-Zustand bestimmen anschließend aktuelle Konfiguration, ausführbarer Code und Tests; Repository-Dokumentation wird daran ausgerichtet. Widersprüche sichtbar machen statt stillschweigend eine Seite zu wählen.

## Technologie

- Next.js 16 App Router, React 19 und TypeScript
- Tailwind CSS und vorhandene shadcn/ui-Komponenten
- Supabase PostgreSQL und Auth mit @supabase/ssr
- Zod und react-hook-form
- Vitest, pgTAP/Supabase CLI und Playwright
- Vercel als geplantes, noch nicht eingerichtetes Hosting-Ziel

## Repository-Map

~~~text
src/app/                 Routen, Layouts und Server Components
src/components/auth/     Login-/Logout-Präsentation
src/components/ui/       vorhandene shadcn/ui-Bausteine
src/features/auth/       Auth- und Kontokontext-Domainlogik
src/lib/supabase/        getrennte Browser-, Server- und Proxy-Clients
src/proxy.ts             Next.js-16-Zugriffsschutz
supabase/migrations/     versioniertes Schema und RLS
supabase/tests/          pgTAP-/Isolationstests
tests/                   Playwright-E2E- und Security-Flows
features/                verbindliche Specs und Status
docs/                    vertiefende Produkt- und Lieferdokumentation
~~~

## Architekturgrenzen

- Seiten und Komponenten rufen Feature-Funktionen auf; Auth-Logik gehört nach src/features/auth/.
- Browser, Server und Proxy verwenden jeweils ihren Client aus src/lib/supabase/.
- Der Proxy aktualisiert Cookies und trifft frühe Routing-Entscheidungen mit getClaims().
- Geschützte Server Components verifizieren Claims erneut.
- PostgreSQL-Rechte und RLS bilden die Autorisierungsgrenze; Proxy und UI-Ausblendung ersetzen sie nicht.
- Login und Logout laufen über Server Actions. PROJ-1 besitzt bewusst keine eigenen API-Routen.
- Praxisbezogene Tabellen erhalten practice_id, RLS, passende Indizes, versionierte Migrationen und negative pgTAP-Tests.
- Externe Anbieter werden hinter der vorgesehenen Integrations-/Adaptergrenze angebunden.

## Implementierungsregeln

- Vorhandene Komponenten in src/components/ui/ wiederverwenden.
- Eingaben serverseitig mit Zod validieren.
- Supabase-Fehler behandeln, ohne Anbietertexte oder personenbezogene Inhalte offenzulegen.
- Listenabfragen explizit begrenzen und N+1-Abfrageschleifen vermeiden.
- Unit-Tests neben der Quelle, Browserflüsse in tests/ und RLS-Tests in supabase/tests/ ablegen.
- Änderungen an Auth, RLS, Secrets oder Real-Data-Gate mit fokussierten Negativtests prüfen.
- Nach Feature-Arbeit Spec, features/INDEX.md, Entscheidungen und bekannte Schulden konsistent aktualisieren.

## Entwicklung

~~~bash
npm install
npm run dev
npm run seed
~~~

Der lokale Supabase-Stack wird mit npx supabase start gestartet. npx supabase db reset baut die lokale Datenbank aus den versionierten Migrationen reproduzierbar neu auf.

## Verifikation

Für normale Änderungen:

~~~bash
npm run verify
~~~

Dieser Befehl führt Lint, Typecheck, Vitest und den Produktions-Build aus.

Für Auth-, Datenbank-, RLS-, Integrations- oder Release-Änderungen:

~~~bash
npm run verify:full
~~~

Der Voll-Lauf benötigt Docker Desktop, einen laufenden lokalen Supabase-Stack, synthetische Testkonfiguration, installierte Playwright-Browser und Microsoft Edge.

## Hochrisikobereiche

- Bis zur dokumentierten Freigabe des Real-Data-Gates sind ausschließlich synthetische Daten erlaubt.
- .env.local enthält nur öffentliche Supabase-App-Werte.
- .env.seed.local enthält Service-Role-Key und synthetische Seed-Passwörter.
- Der Service-Role-Key bleibt auf explizite CLI-Verwaltungsprozesse beschränkt.
- Geschützte Antworten bleiben private, no-store.
- Sensible Inhalte bleiben aus URLs, Browser-Storage, allgemeinen Logs, Analytics, Traces und Screenshots.

## Niemals

- Echte oder re-identifizierbare Patienten-/Gesundheitsdaten vor Freigabe des Real-Data-Gates verwenden.
- getSession() oder ungeprüfte Cookie-Daten als serverseitigen Vertrauensanker verwenden.
- Service-Role-Key in Browser- oder App-Server-Umgebungen übernehmen.
- RLS durch Service-Role-Zugriffe für normale Benutzeranfragen umgehen.
- Geplante Tabellen, Schnittstellen oder Features ohne freigegebene Spec vorwegnehmen.
- Auth-, RLS- oder Secret-Änderungen ohne explizite Sicherheitsprüfung abschließen.

## Dokumentations-Map

- ARCHITECTURE.md: aktuelle Laufzeitarchitektur, Grenzen, Invarianten und Zielbild.
- SECURITY.md: Sicherheitskontrollen, Trust Boundaries, offene Risiken und Agentenregeln.
- DECISIONS.md: selektive, langlebige Architekturentscheidungen.
- docs/architecture/: vertiefende Architektur-, Datenmodell-, API- und Compliance-Dokumentation.
- docs/PRD.md und docs/product/: Produktziel, Scope und User Flows.
- HANDOFF.md und docs/delivery/: aktueller Lieferstand, Abnahmeevidenz, Schulden und offene Fragen.
