# Architecture Overview

## Tech Stack (Fakten aus `package.json` und `CLAUDE.md`)

| Bereich | Wahl | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^16.3.2 |
| Sprache | TypeScript | ^5 |
| UI-Bibliothek | React | ^19.0.0 |
| Styling | Tailwind CSS | ^3.4.1 |
| Komponenten | shadcn/ui (kopiert, in `src/components/ui/`) | — |
| Backend | Supabase (PostgreSQL + Auth + Storage) | `@supabase/supabase-js` ^2.39.3; `@supabase/ssr` ^0.12.5 |
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
| **Supabase** | Datenbank, Auth, Storage | EU-Entwicklungsprojekt verknüpft | Öffentliche App-Werte in `.env.local`; Service-Key ausschließlich in `.env.seed.local` |
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

**Die Sitzung liegt in Cookies, nicht im Browser-Speicher.** `@supabase/ssr` ist seit PROJ-1 Task 2 installiert. Das vorhandene `@supabase/supabase-js` allein würde Sitzungen im Browser-Speicher ablegen, den der Next.js-Server nicht als Cookie-Sitzung verwenden kann.

**Zugriffsschutz über `src/proxy.ts` nach der Next.js-16-Konvention.** Der Proxy aktualisiert Auth-Cookies und trifft Routing-Entscheidungen anhand von `getClaims()`. Geschützte Server-Komponenten prüfen die Identität zusätzlich; Proxy und UI-Ausblendung ersetzen keine Datenbankautorisierung.

**Rollen:** `rezeption`, `behandler`, `praxisadmin`. In PROJ-1 nur gespeichert und angezeigt — die Durchsetzung folgt mit PROJ-19.

## Aktueller Implementierungsstand

**Vorhanden:** Next.js-/shadcn-Grundgerüst, reproduzierbare Tooling-Baseline, validierte und nach Geheimhaltungsbedarf getrennte Supabase-Konfiguration sowie die erste lokale Datenbankmigration.

**Datenbankstand:** `practice` und `user_profile` sind mit Constraints, minimalen Tabellenrechten und RLS implementiert. 36 lokale pgTAP-Tests prüfen eigenen, anonymen und fremden Zugriff, blockierte Browser-Schreiboperationen und die expliziten CLI-Verwaltungsrechte. Der lokale Docker-Stack verwendet `55420`–`55429`, weil Windows den Supabase-Standardbereich auf diesem Entwicklungsrechner reserviert.

**Seed-Stand:** Der idempotente CLI-Seed ist implementiert und lokal zweimal geprüft. Er erzeugt ausschließlich eine synthetische Praxis sowie drei `.example`-Konten; Passwörter und Service-Key bleiben lokale Laufzeitvariablen.

**Auth-Infrastruktur:** Getrennte `@supabase/ssr`-Clients für Browser, Server und Proxy sind implementiert. `src/proxy.ts` schützt `/status` anhand verifizierter Claims, hält Refresh-Cookies synchron und verhindert Caching der Auth-Antworten. Neun Tests prüfen die Routing- und Cookie-Grenzen.

**Login-Domain:** Die serverseitige Login-Action validiert Eingaben mit Zod, verhindert unterscheidbare Credential-Fehler und gibt weder Passwörter noch technische Anbieterfehler zurück. Rate-Limits und vorübergehende Dienstfehler werden neutral kategorisiert.

**Login-Oberfläche:** Die responsive deutsche Anmeldeseite ist im freigegebenen DentPilot-Design umgesetzt. Sie verwendet ausschließlich lokale Assets und bestehende UI-Komponenten, bewahrt nur die E-Mail nach Fehlern, leert das Passwort und schützt vor Mehrfachübermittlung.

**Geschützter Kontostatus:** Die dynamische Statusseite verifiziert Claims erneut und lädt über RLS ausschließlich das eigene Profil und die zugehörige Praxis. Ein fehlendes Profil wird als eigener Einrichtungszustand behandelt; Logout beendet die Sitzung, invalidiert den App-Cache und leitet nach `/login`.

**Noch nicht vorhanden:** Die browserübergreifende End-to-End-Abnahme und Cloud-Abnahme aus Task 9. Keine eigenen API-Routen sind vorgesehen.

## Datenschutz, Sicherheit und KI-Compliance

Die verbindliche Querschnittsarchitektur steht in `docs/architecture/privacy-security-ai-compliance.md`.

- MVP arbeitet ausschließlich mit **synthetischen Testdaten**. Dies ist eine Entwicklungsgrenze, keine Absenkung des Architekturstandards.
- Echte oder re-identifizierbare Patienten-/Gesundheitsdaten sind bis zur dokumentierten Erfüllung des Real-Data-Gates untersagt.
- Vor dem Pilotbetrieb sind unter anderem zwingend: Rechtsgrundlagenprüfung, AV-Verträge/Transfers, DSFA, Rollenrechte und Audit-Log (PROJ-19), Sitzungssperre und MFA (PROJ-31 beziehungsweise Auth-Hardening), Lösch-/Aufbewahrungskonzept, Incident Response und Security-Test.
- Patientenbezogene Kennzahlen (Termintreue, PZR-Historie, CLV, Kommunikationshistorie) sind **personenbezogene Daten** und entsprechend zu behandeln.
- Der `SUPABASE_SERVICE_ROLE_KEY` umgeht alle Zugriffsregeln. Er gehört ausschließlich ins Seed-Skript auf der Kommandozeile — niemals in den Browser, niemals ins Repository.
- Regeln aus `.claude/rules/backend.md` gelten verbindlich: RLS auf jeder Tabelle, Zod-Validierung aller Eingaben, `.limit()` auf allen Listenabfragen, keine Secrets im Quellcode.
- Für KI-Funktionen gelten dokumentierte AI-Act-Einstufung, Datenminimierung, Human Oversight, Transparenz, Qualitätsgrenzen und eine Prüfung auf Medizinproduktebezug.
