# Architecture Overview

**Stand:** 09.09.2026

Dieses Dokument trennt die heute ausführbare Architektur ausdrücklich von der geplanten Produktarchitektur. Roadmap-Elemente sind keine implementierten Systembestandteile.

## Aktueller Systemumfang

Implementiert sind PROJ-1 und PROJ-19 sowie der lokale T05-Stand von PROJ-31: eine Next.js-16-Anwendung mit deutscher Anmeldung, geschützter Kontostatus-Seite, Supabase-SSR-Sitzung, Praxis- und Portaladmin-Identitäten, RLS, synthetischer Testdatenbereitstellung sowie einer minimierten Auditansicht mit praxisinitiierter, zeitlich begrenzter Supportfreigabe. Der T05-Stand ergänzt TOTP, einen privaten Sitzungszustand, SSR-Gates, Re-Authentisierung für sensible Supportaktionen und eine nonce-basierte CSP. PROJ-19 und PROJ-31 sind `In Review`; betriebliche Produktions-Gates bleiben offen.

Noch nicht implementiert sind Patienten-, Termin-, CRM-, Kommunikations-, Workflow-, PVS- und KI-Funktionen. Für diese Bereiche existieren Produktplanung und Architekturvorgaben, aber überwiegend noch keine verbindlichen Feature-Specs.

## Technologie

| Bereich | Wahl | Version |
|---|---|---|
| Framework | Next.js App Router | ^16.3.2 |
| Sprache | TypeScript | ^5 |
| UI | React, Tailwind CSS, shadcn/ui | ^19.0.0 / ^3.4.1 |
| Backend | Supabase PostgreSQL und Auth | @supabase/supabase-js ^2.39.3 |
| SSR-Sitzung | @supabase/ssr | ^0.12.5 |
| Validierung | Zod, react-hook-form | ^4.3.5 / ^7.71.1 |
| Tests | Vitest, pgTAP, Playwright | ^4.1.2 / Supabase CLI / ^1.58.2 |
| Hosting | Vercel | geplant, nicht eingerichtet |

## Aktuelle Laufzeitarchitektur

~~~text
Browser
  │ Cookie-basierte Supabase-Sitzung
  ▼
src/proxy.ts
  │ aktualisiert Cookies, prüft getClaims(), steuert /login, MFA, Re-Auth und geschützte Routen
  ▼
Next.js Server Components / Server Actions
  │ prüfen Claims erneut, validieren Eingaben, laden Kontokontext
  ▼
src/lib/supabase/server.ts
  │ öffentlicher Supabase-Key + Benutzer-Cookie
  ▼
Supabase Auth + PostgreSQL
  │ Tabellenrechte und RLS
  ▼
practice / user_profile
~~~

Der Proxy ist ein früher Routing- und Sitzungsfilter, aber keine vollständige Autorisierung. Identität wird in geschützten Server-Komponenten erneut geprüft; Datenbankrechte und RLS entscheiden über den Datenzugriff.

## Anwendungsgrenzen

### Präsentation

- src/app/ enthält Routen, Layout und Seiten.
- src/components/auth/ enthält Login- und Logout-Oberfläche.
- src/components/ui/ enthält die vorhandenen shadcn/ui-Bausteine.

### Feature- und Domainlogik

- src/features/auth/actions.ts validiert Login-Eingaben, neutralisiert Anbieterfehler und führt die Anmeldung aus.
- src/features/auth/current-user.ts verifiziert Claims, lädt den minimalen Kontokontext und führt Logout aus.
- UI-Code soll diese Funktionen verwenden, statt Authentifizierungslogik zu duplizieren.

### Supabase-Zugriff

- src/lib/supabase/client.ts: Browser-Client.
- src/lib/supabase/server.ts: Server-Component- und Server-Action-Client.
- src/lib/supabase/proxy.ts: Request-/Response-Cookie-Synchronisierung und Routing.
- src/lib/env.ts: ausschließlich öffentliche App-Konfiguration.
- supabase/seed-env.ts: geheime CLI-Seed-Konfiguration.

Die drei Supabase-Clients bleiben getrennt, weil Browser, Server und Proxy unterschiedliche Cookie-Rechte besitzen.

## Aktuelle Datenhaltung

Die Migration supabase/migrations/20260825170000_proj_1_identity.sql definiert:

- practice als Praxis-/Tenant-Grenze,
- user_profile als minimale Zuordnung von Auth-Konto, Praxis, Anzeigename und Rolle,
- user_role mit rezeption, behandler und praxisadmin.

Beide Tabellen haben RLS. Browserrollen besitzen nur selektiven Lesezugriff:

- angemeldete Personen sehen das eigene Profil,
- angemeldete Personen sehen die zugehörige Praxis,
- anonyme und fremde Zugriffe werden blockiert,
- Schreibzugriffe sind Browserrollen entzogen,
- die geheime service_role ist auf explizite CLI-Verwaltung beschränkt.

PROJ-19 trennt Praxisrollen von `portaladmin`. Praxisrollen erhalten keine Audit-Einsicht; Portaladmins lesen Audit-Metadaten ausschließlich über eine aktive, von der jeweiligen Praxis angelegte Supportfreigabe. RLS, Tabellenrechte und autorisierte RPCs erzwingen diese Grenze.

## Authentifizierungsfluss

1. / leitet nach /login.
2. Der Proxy aktualisiert die Cookie-Sitzung und verwendet verifizierte getClaims()-Ergebnisse als Routing-Signal.
3. Die Login-Server-Action validiert E-Mail und Passwort serverseitig mit Zod.
4. Credential-, Rate-Limit- und Dienstfehler werden ohne Kontenoffenlegung oder technische Anbietertexte klassifiziert.
5. Eine AAL1-Sitzung durchläuft die TOTP-Einschreibung oder -Prüfung; eine AAL2-Sitzung ohne aktuellen Datenbankzustand wird zur Re-Authentisierung geleitet.
6. /status verifiziert Claims erneut und lädt über RLS nur das eigene Profil und die eigene Praxis.
7. Logout beendet die Supabase-Sitzung, invalidiert den App-Layout-Cache und leitet nach /login.

Auth-Antworten erhalten Cache-Control: private, no-store; Redirects enthalten keine übernommenen Query- oder Hash-Werte.

## Seed- und Testgrenze

supabase/seed.ts läuft ausschließlich als CLI-Prozess. Es legt zwei synthetische Praxen und vier Konten einschließlich einer separaten `portaladmin`-Identität idempotent an. Service-Role-Key und Seed-Passwörter werden in .env.seed.local gehalten und vor dem Start des E2E-App-Servers aus dessen Umgebung entfernt.

Die Verifikationsschichten sind:

- ESLint und TypeScript,
- 90 Vitest-Tests,
- 108 pgTAP-/RLS-Tests,
- 17 Playwright-Tests einschließlich Auth-/Security- und Audit-Flows,
- Chromium sowie Browser-Smokes in Firefox, WebKit und echtem Microsoft Edge,
- Next.js-Produktions-Build.

Automatisierte PROJ-1- und Cloud-Abnahme wurden am 26.08.2026 dokumentiert. Offen bleiben echter Safari-Smoke, vollständiger Browser-Neustart und kontrollierte Dienstunterbrechung; deshalb bleibt PROJ-1 In Review.

## Externe Dienste

| Dienst | Zweck | Status | Konfiguration |
|---|---|---|---|
| **Supabase** | Datenbank, Auth, Storage | EU-Entwicklungsprojekt verknüpft | Öffentliche App-Werte in `.env.local`; Service-Key ausschließlich in `.env.seed.local` |
| **Mock-PVS** | simuliertes Praxisverwaltungssystem | lokaler, synthetischer HTTP-Prozess (PROJ-2, In Review) | ignorierte lokale Konfiguration |
| **Soniox** | Gesprächstranskription | nicht angebunden (PROJ-14) | offen |
| **IONOS AI Model Hub** | KI-Extraktion | nicht angebunden (PROJ-15) | offen |
| **Resend** | E-Mail-Versand | nicht angebunden (PROJ-12) | offen |
| **Dampsoft** | echtes PVS | **kein API-Zugang** — siehe open-questions.md | offen |

Der Mock-PVS dokumentiert seinen lesenden `/v1`-Vertrag einschließlich neutraler Fehler, Rate Limits und fester Testszenarien in `features/PROJ-2-mock-pvs-service.md`. Für die übrigen Dienste werden Fehler-, Retry- und Rate-Limit-Verhalten jeweils mit der Feature-Spec festgelegt.

## Deployment und Betrieb

Es gibt keine Vercel-Konfiguration. Eingecheckte GitHub-Workflows führen Kernverifikation sowie Dependency-/Secret-Prüfungen aus; ihre GitHub-Aktivierung, Branch-Protection und betriebliche Reaktion auf Funde sind nicht belegt. Verifikation wird zusätzlich lokal über npm run verify beziehungsweise npm run verify:full ausgeführt. Produktionsheader, Monitoring, Backup-/Restore-Nachweise und Incident-Prozesse sind Teil des Real-Data- und Deployment-Gates, nicht aktueller Betriebszustand.

## Architekturinvarianten

- Praxissoftware bleibt Source of Truth für medizinische und abrechnungsrelevante Daten.
- Serverseitige Identitätsentscheidungen verwenden verifizierte Claims.
- Proxy oder UI-Ausblendung ersetzen keine Datenbankautorisierung.
- Praxisbezogene Tabellen erhalten practice_id, RLS, passende Indizes und negative Isolationstests.
- Service-Role-Zugriffe bleiben expliziten CLI-Verwaltungsprozessen vorbehalten.
- Bis zur Freigabe des Real-Data-Gates werden ausschließlich synthetische Daten verarbeitet.

## Bekannte Schulden und Ausnahmen

- PROJ-31 ist lokal mit Browser-/Edge-E2E implementiert, aber ohne Hosted-Nachweis und ohne Beweis menschlicher Anwesenheit bei einem gestohlenen, noch gültigen Sitzungstoken.
- Die nonce-basierte CSP liegt im Proxy; weitere Security Header sind noch nicht implementiert oder betrieblich nachgewiesen.
- Lösch-, Aufbewahrungs-, Incident- und Anbieterprozesse sind nicht abgenommen.
- Die Anwendung ist im Betrieb noch Single-Tenant, obwohl das Schema die Praxisgrenze vorbereitet.

Die vollständige Liste steht in docs/delivery/known-issues.md und docs/delivery/open-questions.md.

## Geplante Produktarchitektur

Der folgende Zielaufbau ist beschlossen, aber bis auf Supabase/Identität nicht implementiert:

~~~text
Praxissoftware als Source of Truth
  ▼
herstellerspezifischer PVS-Adapter (PROJ-3/23)
  ▼
internes, praxisgebundenes Datenmodell
  ▼
Workflow- und Regel-Engine (PROJ-10)
  ▼
CRM, Kommunikation, Analytics und KI-gestützte Vorbereitung
~~~

Business-Logik soll nie direkt an eine Hersteller-API gekoppelt werden. Ein normalisierter Adapter bildet PVS-spezifische Begriffe und Formate auf das interne Modell ab. KI extrahiert oder bereitet vor; nachvollziehbare Regeln und qualifizierte Menschen entscheiden.

## Vertiefende Dokumente

- Datenmodell: docs/architecture/data-model.md
- Schnittstellenstatus: docs/architecture/api-contracts.md
- Entscheidungen: docs/architecture/decisions.md
- Datenschutz, Sicherheit und KI-Gates: docs/architecture/privacy-security-ai-compliance.md
- Feature-Status: features/INDEX.md
