# Handoff: DentPilot

**Stand:** 2026-08-24 · **Erzeugt von:** `/codex-handoff`

## Was ist das Produkt?

Eine **Automatisierungs- und Intelligence-Schicht für bestehende Zahnarztsoftware** — kein neues Praxisverwaltungssystem. DentPilot dockt per API an die vorhandene Praxissoftware (Zielsystem: Dampsoft) und ein Transkriptionstool (Soniox) an, führt die Daten zusammen und automatisiert Nachverfolgung: Kostenvoranschläge nachfassen, PZR-Recalls auslösen, Terminerinnerungen versenden. Primäre Nutzergruppe ist die Rezeption.

Details: [`docs/product/vision.md`](docs/product/vision.md)

## Aktueller Zustand — bitte zuerst lesen

**Das Projekt ist gut durchdacht, aber praktisch nicht gebaut.**

Was belastbar ist: eine vollständige PRD, ein festgelegtes Design-System mit klickbarem Prototyp, 31 priorisierte Features mit Abhängigkeiten, und **eine** vollständig spezifizierte Feature-Spec inklusive technischem Entwurf (PROJ-1).

Was fehlt: **kein Produktcode, keine Datenbank, kein Auth, keine API-Route, kein Test.** Das Repository ist ein unberührtes Next.js-Template mit 35 installierten shadcn/ui-Komponenten. `src/lib/supabase.ts` ist ein Platzhalter, der `null` exportiert.

**30 von 31 Features stehen auf *Roadmap*** — benannt und priorisiert, aber ohne User Stories und ohne Akzeptanzkriterien. Das ist der bewusste Arbeitsstand: spezifiziert wird Feature für Feature kurz vor der Umsetzung. **Für Roadmap-Features keinen Code schreiben, ohne dass vorher eine Spec entsteht.**

Vollständiger Status: [`features/INDEX.md`](features/INDEX.md) · [`docs/handoff/manifest.yaml`](docs/handoff/manifest.yaml)

## Wo die verbindlichen Spezifikationen liegen

| Thema | Datei |
|---|---|
| Produktvision & Leitfrage | [`docs/product/vision.md`](docs/product/vision.md) |
| Umfang & Priorisierung | [`docs/product/scope.md`](docs/product/scope.md) |
| User Flows | [`docs/product/user-flows.md`](docs/product/user-flows.md) |
| Architektur-Überblick & externe Dienste | [`docs/architecture/overview.md`](docs/architecture/overview.md) |
| **Entscheidungen mit Begründung** | [`docs/architecture/decisions.md`](docs/architecture/decisions.md) |
| Datenmodell | [`docs/architecture/data-model.md`](docs/architecture/data-model.md) |
| API-Verträge | [`docs/architecture/api-contracts.md`](docs/architecture/api-contracts.md) |
| Design-System & Tokens | [`docs/design/design-system.md`](docs/design/design-system.md) |
| Screen-Specs & Zustände | [`docs/design/screen-specs.md`](docs/design/screen-specs.md) |
| Umsetzungsplan | [`docs/delivery/implementation-plan.md`](docs/delivery/implementation-plan.md) |
| Abnahmeschritte | [`docs/delivery/acceptance-tests.md`](docs/delivery/acceptance-tests.md) |
| Altlasten & Risiken | [`docs/delivery/known-issues.md`](docs/delivery/known-issues.md) |
| **Offene Fragen** | [`docs/delivery/open-questions.md`](docs/delivery/open-questions.md) |

**Maßgeblich für PROJ-1 ist die Feature-Spec selbst:** [`features/PROJ-1-supabase-infrastructure-setup.md`](features/PROJ-1-supabase-infrastructure-setup.md) — 22 Akzeptanzkriterien, 7 Edge Cases, technischer Entwurf. Die `docs/`-Dateien fassen zusammen, die Spec entscheidet.

## Zum Laufen bringen

```bash
npm install
npm run dev
```

Weitere Befehle aus `package.json`:

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:all
```

**Umgebung:** Es werden drei Supabase-Variablen benötigt — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY`. Ihre Bedeutung steht in [`docs/architecture/overview.md`](docs/architecture/overview.md). Eine `.env.example` konnte nicht angelegt werden, weil `.env`-Dateien in dieser Umgebung gesperrt sind. Der Verwaltungsschlüssel gehört ausschließlich ins Seed-Skript — niemals in den Browser, niemals committen.

**Zu den Tests:** `npm test` läuft grün, weil **kein einziger Test existiert**. Das ist kein Sicherheitsnetz.

## Nächste Aufgabe

**PROJ-1 — Supabase Infrastructure Setup (inkl. Login)**

Datenbank-Fundament und funktionierende Anmeldung: zwei Tabellen (`practice`, `user_profile`) mit aktiver Row Level Security, zentraler Zugriffsschutz per Middleware, Anmeldeseite, geschützte Statusseite, Seed-Skript für Testpraxis und Demo-Konten.

Vollständige Akzeptanzkriterien: [`features/PROJ-1-supabase-infrastructure-setup.md`](features/PROJ-1-supabase-infrastructure-setup.md)
Schritte und Reihenfolge: [`docs/delivery/implementation-plan.md`](docs/delivery/implementation-plan.md)

**Der eine technische Punkt, der leicht falsch gemacht wird:** Die Anmeldesitzung muss in **Cookies** liegen, nicht im Browser-Speicher. Dafür ist das noch nicht installierte Paket `@supabase/ssr` nötig. Das vorhandene `@supabase/supabase-js` allein speichert im Browser-Speicher — davon sieht der Next.js-Server nichts, wodurch sich Seiten nicht serverseitig schützen ließen. Begründung in [`docs/architecture/decisions.md`](docs/architecture/decisions.md).

## Offene Entscheidungen, die Arbeit blockieren

| Blockiert | Offene Entscheidung | Verfolgt in |
|---|---|---|
| **PROJ-1 kann nicht fertiggestellt werden** | Supabase-Projekt muss auf supabase.com angelegt werden — erfordert Kontoerstellung, nicht automatisierbar | [`open-questions.md`](docs/delivery/open-questions.md) |
| PROJ-23 (echte Dampsoft-Anbindung) | Kein API-Zugang. Kein deutscher PVS-Anbieter hat eine öffentliche REST-API; Partnerschaftsanfrage nötig. | [`open-questions.md`](docs/delivery/open-questions.md) |
| PROJ-29 (Anrufer-Erkennung) | Telefonanlage der Pilotpraxis unbekannt | [`open-questions.md`](docs/delivery/open-questions.md) |
| PROJ-2 und PROJ-4 | Telefonnummern müssen im Datenmodell mitlaufen und E.164-normalisiert werden — **schon im MVP**, sonst ist für PROJ-29 nachzurüsten | [`open-questions.md`](docs/delivery/open-questions.md) |

**PROJ-1 selbst ist ansonsten nicht blockiert** — sobald das Supabase-Projekt existiert, kann gebaut werden.

## Zwei Dinge, die den Umfang jeder Aufgabe bestimmen

1. **Es gibt genau einen Entwickler.** Die zweite Person im Projekt ist Zahnarzt und liefert Fachwissen, entwickelt nicht mit. Aufgaben müssen für eine Person tragbar bleiben.
2. **Die Produktleitfrage** aus dem Ursprungskonzept, zu prüfen bei jedem Feature: *Macht dieses Feature vorhandene Praxisdaten besser nutzbar, oder automatisiert es einen Prozess, der heute manuell liegen bleibt?* Wenn nein: nicht bauen. Sie schützt davor, schleichend doch ein vollständiges Praxisverwaltungssystem zu bauen.
