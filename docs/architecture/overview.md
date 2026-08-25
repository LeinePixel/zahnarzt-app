# Architecture Overview

## Tech Stack (Fakten aus `package.json` und `CLAUDE.md`)

| Bereich | Wahl | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^16.1.1 |
| Sprache | TypeScript | ^5 |
| UI-Bibliothek | React | ^19.0.0 |
| Styling | Tailwind CSS | ^3.4.1 |
| Komponenten | shadcn/ui (kopiert, in `src/components/ui/`) | — |
| Backend | Supabase (PostgreSQL + Auth + Storage) | `@supabase/supabase-js` ^2.39.3 |
| Validierung | Zod + react-hook-form | ^4.3.5 / ^7.71.1 |
| Unit-Tests | Vitest | ^4.1.2 |
| E2E-Tests | Playwright | ^1.58.2 |
| Hosting | Vercel | (geplant, noch nicht eingerichtet) |
| Icons | lucide-react | ^0.562.0 |

**State-Management:** React `useState` / Context API — keine externe Bibliothek (aus `CLAUDE.md`).

## Systemgrenzen — das Fünf-Ebenen-Modell

```
┌─────────────────────────────────────────────────────────┐
│ Ebene 1  Bestehende Praxissoftware (Dampsoft)           │
│          Patientenstammdaten · Behandlungen · Befunde   │
│          Abrechnung · Basis-Terminverwaltung            │
│          BLEIBT SOURCE OF TRUTH                         │
└────────────────────────┬────────────────────────────────┘
                         │ API (aktuell: Mock-Service)
┌────────────────────────▼────────────────────────────────┐
│ Ebene 2  Integrations-Adapter (PROJ-3)                  │
│          herstellerspezifisch → internes Datenmodell    │
│          DampsoftAdapter, MockAdapter, …                │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Ebene 3  Internes Datenmodell (Supabase/PostgreSQL)     │
│          einheitlich, herstellerunabhängig              │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Ebene 4  Workflow- und Regel-Engine (PROJ-10)           │
│          Trigger → Bedingung → Aktion                   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Ebene 5  CRM · Analytics · Kommunikation (Oberfläche)   │
└─────────────────────────────────────────────────────────┘

Seitlich angebunden:
  Soniox (Transkription)        → PROJ-14
  IONOS AI Model Hub (KI)       → PROJ-15
  Resend (E-Mail-Versand)       → PROJ-12
```

**Warum die Adapter-Schicht:** Die Business-Logik darf nie direkt gegen eine Hersteller-API programmiert werden. Praxissoftware A nennt einen Termin `appointment`, Praxissoftware B `visit` — intern ist beides `Appointment`. So lassen sich weitere Systeme anbinden, ohne die Anwendung umzubauen.

## Externe Dienste

| Dienst | Zweck | Status | Konfiguration |
|---|---|---|---|
| **Supabase** | Datenbank, Auth, Storage | **Projekt muss noch angelegt werden** (supabase.com) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Mock-PVS** | simuliertes Praxisverwaltungssystem | nicht gebaut (PROJ-2) | offen |
| **Soniox** | Gesprächstranskription | nicht angebunden (PROJ-14) | offen |
| **IONOS AI Model Hub** | KI-Extraktion | nicht angebunden (PROJ-15) | offen |
| **Resend** | E-Mail-Versand | nicht angebunden (PROJ-12) | offen |
| **Dampsoft** | echtes PVS | **kein API-Zugang** — siehe open-questions.md | offen |

Fehler-, Retry- und Rate-Limit-Verhalten sind für keinen dieser Dienste spezifiziert, da nur PROJ-1 einen technischen Entwurf hat. Das gehört jeweils in die Feature-Spec.

## Datenhaltung und Mandantentrennung

**MVP läuft Single-Tenant** (eine Praxis), das Datenmodell ist aber auf Multi-Tenant vorbereitet:

- Eine `practice`-Entität existiert von Beginn an
- **Jede** Tabelle mit Praxisbezug erhält eine `practice_id`
- **Row Level Security ist auf jeder Tabelle aktiviert**, auch wenn nur eine Praxis existiert

Der Grund für RLS von Anfang an: Wer sie erst später aktiviert, entdeckt alle dadurch brechenden Abfragen zum spätestmöglichen Zeitpunkt.

## Authentifizierung

Vollständig beschrieben in `features/PROJ-1-supabase-infrastructure-setup.md`, Abschnitt *Tech Design*. Die zentralen Punkte:

**Die Sitzung liegt in Cookies, nicht im Browser-Speicher.** Das dafür nötige Paket `@supabase/ssr` ist **noch nicht installiert**. Das bereits vorhandene `@supabase/supabase-js` speichert die Sitzung im Browser-Speicher — davon sieht der Next.js-Server nichts, wodurch sich Seiten nicht serverseitig schützen ließen.

**Zugriffsschutz zentral in einer Middleware**, nicht pro Seite. Damit ist jedes neue Feature automatisch geschützt.

**Rollen:** `rezeption`, `behandler`, `praxisadmin`. In PROJ-1 nur gespeichert und angezeigt — die Durchsetzung folgt mit PROJ-19.

## Aktueller Implementierungsstand

**Vorhanden** (`git ls-files src/`):
- `src/app/layout.tsx`, `src/app/page.tsx` — Next.js-Grundgerüst aus dem Template
- `src/components/ui/*` — 35 shadcn/ui-Komponenten, vollständig installiert
- `src/hooks/use-mobile.tsx`, `src/hooks/use-toast.ts`
- `src/lib/utils.ts`
- `src/lib/supabase.ts` — **auskommentierter Platzhalter, exportiert `null`**
- `src/test/setup.ts`

**Nicht vorhanden:** keine API-Routen, keine Migrationen, keine Tests, keine Datenbank, kein Auth.

Es ist praktisch ein unberührtes Template. Der gesamte Produktcode muss noch entstehen.

## Datenschutz und Sicherheit

- MVP arbeitet ausschließlich mit **synthetischen Testdaten** — keine echten Patientendaten. Dadurch kein akuter DSGVO-Zeitdruck.
- Vor dem Pilotbetrieb (Phase 6) sind zwingend erforderlich: Rollenrechte (PROJ-19), Audit-Log (PROJ-19), **automatische Sitzungssperre (PROJ-31)**, Löschkonzept, Aufbewahrungsregeln.
- Patientenbezogene Kennzahlen (Termintreue, PZR-Historie, CLV, Kommunikationshistorie) sind **personenbezogene Daten** und entsprechend zu behandeln.
- Der `SUPABASE_SERVICE_ROLE_KEY` umgeht alle Zugriffsregeln. Er gehört ausschließlich ins Seed-Skript auf der Kommandozeile — niemals in den Browser, niemals ins Repository.
- Regeln aus `.claude/rules/backend.md` gelten verbindlich: RLS auf jeder Tabelle, Zod-Validierung aller Eingaben, `.limit()` auf allen Listenabfragen, keine Secrets im Quellcode.
