# Implementation Plan

## Ausgangslage

Das Repository ist praktisch ein **unberührtes Next.js-Template**. Vorhanden sind 35 shadcn/ui-Komponenten, das Next.js-Grundgerüst und Testwerkzeuge. Es gibt **keine Datenbank, kein Auth, keine API-Routen, keinen Test und keinen Produktcode**.

`src/lib/supabase.ts` ist ein auskommentierter Platzhalter, der `null` exportiert — er würde bei Verwendung zu Laufzeitfehlern führen und wird in PROJ-1 ersetzt.

---

## Vorbedingung — muss von Hand erledigt werden

**Ein Supabase-Projekt auf supabase.com anlegen** (kostenlos). Das lässt sich nicht automatisieren, weil es eine Kontoerstellung erfordert. Ohne dieses Projekt kann PROJ-1 nicht fertiggestellt werden.

Danach werden drei Werte benötigt (Namen siehe `.env.example` bzw. `docs/architecture/overview.md`):
- Projekt-URL
- öffentlicher Zugriffsschlüssel
- geheimer Verwaltungsschlüssel — **nur für das Seed-Skript, nie in den Browser, nie ins Repository**

---

## NÄCHSTE AUFGABE — PROJ-1: Supabase Infrastructure Setup

**Dies ist die einzige Aufgabe, die jetzt begonnen werden soll.** Alle anderen Features haben keine Spezifikation.

**Bindende Spezifikation:** `features/PROJ-1-supabase-infrastructure-setup.md`
Sie enthält 22 Akzeptanzkriterien im Format Angenommen/Wenn/Dann, 7 Edge Cases und einen vollständigen technischen Entwurf. **Diese Datei ist maßgeblich — nicht dieser Plan.**

### Was gebaut wird

1. **Paket `@supabase/ssr` ergänzen** — speichert die Sitzung in Cookies. Das bereits installierte `@supabase/supabase-js` allein legt sie im Browser-Speicher ab, wovon der Next.js-Server nichts sieht; damit ließen sich Seiten nicht serverseitig schützen.
2. **Drei Supabase-Zugangsdateien** unter `src/lib/supabase/` — für Browser, Server-Komponenten und Middleware. Die drei Umgebungen haben unterschiedlichen Cookie-Zugriff.
3. **Migration** für die Tabellen `practice` und `user_profile`, inklusive aktivierter Row Level Security und Lese-Policies. Kein Schreibzugriff über die Anwendung.
4. **Middleware** als zentraler Zugriffsschutz — prüft jede Anfrage, leitet ohne gültige Sitzung zur Anmeldeseite und Angemeldete von der Anmeldeseite weg.
5. **Anmeldeseite** mit Zod-Validierung, gesperrter Schaltfläche während des Absendens und der geforderten Fehlerdifferenzierung.
6. **Geschützte Statusseite** mit Anzeigename, Rolle, Praxisname und Abmelde-Schaltfläche. Bewusst **ohne** App-Grundgerüst.
7. **Seed-Skript** für Testpraxis und je ein Demo-Konto pro Rolle. Wiederholbar, läuft nur auf der Kommandozeile.
8. **`.env.example` und Startprüfung** — fehlt eine Variable, bricht die Anwendung mit Klartextmeldung ab.

### Abnahmekriterium für diese Aufgabe

Alle 22 Akzeptanzkriterien aus der Spec sind erfüllt. Die zentralen darunter:

- Anmeldung mit korrekten Zugangsdaten führt auf die geschützte Seite
- **Falsches Passwort und unbekannte E-Mail-Adresse erzeugen dieselbe Meldung** — sonst lässt sich ausprobieren, wer ein Konto besitzt
- „Dienst nicht erreichbar" ist davon unterscheidbar
- Direkter URL-Aufruf ohne Anmeldung leitet weiter
- Nach Browser-Neustart weiterhin angemeldet
- Nach Abmelden zeigt der Zurück-Knopf keine geschützten Inhalte
- Konto ohne Profil führt zu einem erklärenden Hinweis, nicht zum Absturz
- RLS ist auf beiden Tabellen aktiv

### Verbindliche Regeln

Aus `.claude/rules/backend.md`: RLS auf jeder Tabelle, Policies je Operation, Zod-Validierung aller Eingaben, keine Secrets im Quellcode.
Aus `CLAUDE.md`: shadcn/ui-Komponenten **nie nachbauen** — `form`, `input`, `label`, `button`, `card`, `alert` sind vorhanden.
Aus `docs/design/design-system.md`: Farb-Tokens und Typografie. Oberflächensprache **Deutsch**.

---

## Danach — Baureihenfolge MVP

Jedes dieser Features braucht **zuerst eine Spezifikation** (`/write-spec PROJ-X`), dann einen technischen Entwurf (`/architecture PROJ-X`). Ohne Spec keinen Code.

| # | ID | Feature | Abhängig von |
|---|---|---|---|
| 2 | PROJ-19 | Audit Logging & Rollenrechte | PROJ-1 |
| 3 | PROJ-2 | Mock-PVS-Service | — |
| 4 | PROJ-3 | Integration-Adapter-Schicht | PROJ-1, PROJ-2 |
| 5 | PROJ-4 | Patienten-Synchronisierung | PROJ-3 |
| 6 | PROJ-5 | Termin-Synchronisierung | PROJ-3 |
| 7 | PROJ-6 | Patientenübersicht & Profil | PROJ-4 |
| 8 | PROJ-7 | Terminübersicht | PROJ-5 |
| 9 | PROJ-9 | CRM / Nachfassaktionen | PROJ-4 |
| 10 | PROJ-11 | Kommunikations-Templates-Editor | PROJ-1 |
| 11 | PROJ-12 | E-Mail-Versand-Integration | PROJ-1 |
| 12 | PROJ-10 | Regel-Engine | PROJ-1, PROJ-4, PROJ-5 |
| 13 | PROJ-13 | Kommunikationsautomatisierung | PROJ-10, PROJ-11, PROJ-12 |
| 14 | PROJ-14 | Transkript-Integration | PROJ-4, PROJ-5 |
| 15 | PROJ-15 | KI-Informationsextraktion | PROJ-14 |
| 16 | PROJ-16 | Automatischer Kostenvoranschlagsentwurf | PROJ-15 |
| 17 | PROJ-17 | Patientenkennzahlen | PROJ-4, PROJ-5 |
| 18 | PROJ-8 | Patienten-Timeline | PROJ-6, PROJ-7 |
| 19 | PROJ-18 | Dashboard | PROJ-9, PROJ-13, PROJ-16, PROJ-17 |

**Zwei Reihenfolge-Hinweise, die begründet sind:**

- **PROJ-19 steht bewusst an zweiter Stelle.** Rechte und Audit-Log nachträglich einzuziehen ist deutlich teurer, als sie früh mitzubauen.
- **PROJ-6 bringt das App-Grundgerüst** (Sidebar, Navigation, Layout nach Design-System). PROJ-1 liefert es bewusst nicht.

**Ein Punkt, der schon früher berücksichtigt werden muss:** PROJ-2 und PROJ-4 müssen **Telefonnummern** liefern und in E.164 normalisieren — sonst muss das Datenmodell für PROJ-29 (Anrufer-Erkennung) nachträglich erweitert werden.

---

## Zeitkritisch, unabhängig von der Reihenfolge

**PROJ-31 (Automatische Sitzungssperre nach Inaktivität)** muss stehen, **bevor echte Patientendaten ins System kommen** (Pilotbetrieb, Phase 6) — unabhängig davon, wie weit die übrigen P1-Features sind. Rezeptionsrechner stehen im halböffentlichen Bereich.
