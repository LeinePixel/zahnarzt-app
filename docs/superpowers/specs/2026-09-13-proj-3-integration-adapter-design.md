# PROJ-3 Integration-Adapter-Schicht — Architekturentwurf

**Status:** Lokal implementiert, In Review (14.09.2026)
**Datum:** 2026-09-13  
**Verbindliche Feature-Spezifikation:**
[`features/PROJ-3-integration-adapter-layer.md`](../../../features/PROJ-3-integration-adapter-layer.md)

## Ziel und Nicht-Ziel

PROJ-3 stellt die austauschbare, serverseitige Quellgrenze bereit, über die
Folgefeatures Daten aus dem lokalen Mock-PVS lesen können. Sie normalisiert
den bestehenden `v1`-Vertrag, bewahrt technische Abrufzustände und verhindert,
dass HTTP-, Token- oder PVS-spezifische Details in Patienten- oder
Terminlogik gelangen.

Der Entwurf synchronisiert, projiziert oder zeigt keine Fachdaten. Es gibt
keinen Scheduler und keine automatische Wiederholung. Die Datenbank speichert
nur den technischen Zustand, niemals Quellinhalt oder Zugangsdaten.

## Gewählte Lösung

```text
PROJ-4 / PROJ-5, später
        │
        ▼
IntegrationAdapter-Port
        │                    ┌─────────────────────────────────────┐
        ├─ MockPvsAdapter ───▶│ lokaler Mock-PVS: feste GET /v1-Routen│
        │                    └─────────────────────────────────────┘
        │
        └─ SyncStateRepository ──▶ private Statusschreibvorgänge
                                      │
                                      ▼
                          integration / state / event
```

Der Port ist ein kleines, rein lesendes TypeScript-Interface. Ein konkreter
`MockPvsAdapter` besitzt die alleinige HTTP- und Konfigurationsverantwortung.
Eine getrennte State-Schnittstelle beschreibt Statuslese- und
Schreiboperationen, ohne zu behaupten, dass PROJ-3 bereits einen Job ausführt.

| Alternative | Grund gegen die Alternative |
|---|---|
| Direkte `fetch`-Aufrufe in PROJ-4/5 | Quellformat, Fehler- und Geheimnisgrenze würden in Fachlogik dupliziert. |
| Generischer Provider-Plugin-Host | Echte Herstelleranforderungen sind unbekannt; Registry, Credentials und Lifecycle wären vorzeitige Plattformarbeit. |
| Scheduler oder Cron-Route in PROJ-3 | Es gäbe noch keine transaktionale Fachverarbeitung und keine spezifizierte, sichere Ausführungsidentität. |

## Komponenten und Verantwortlichkeiten

```text
src/features/integrations/
  contracts.ts             Kanonische Quelltypen und strikte Zod-Grenzen
  mock-pvs-config.ts       Private Konfigurations- und lokale Origin-Prüfung
  mock-pvs-adapter.ts      Feste HTTP-Aufrufe und neutrale Fehlerübersetzung
  adapter.ts               Kleiner lesender Adapter-Port
  sync-state.ts            Status-Repository-Port und cursorfreie Lesetypen
  *.test.ts                Unit- und HTTP-Grenztests

supabase/
  migrations/20260913170000_proj_3_integration_adapter.sql
                           Provider, Status, Ereignisse, RLS und RPCs
  tests/proj_3_integration_adapter.test.sql
                           Rechte-, RLS- und Retentionsnachweise
```

`contracts.ts` dupliziert die validierenden Formen bewusst innerhalb der
DentPilot-Grenze. Der Adapter importiert weder `services/mock-pvs/contracts.ts`
noch andere Service-Interna. Vertragsdrift wird durch HTTP-Integrationstests
gegen den gestarteten Mock sichtbar.

`mock-pvs-config.ts` akzeptiert nur `MOCK_PVS_BASE_URL` als lokale
HTTP-Origin ohne zusätzliche URL-Bestandteile und einen nichtleeren
`MOCK_PVS_READ_TOKEN`. Es kennt den Test-Token nicht. `mock-pvs-adapter.ts`
baut ausschließlich feste Pfade und Query-Parameter aus validierten Eingaben.
Er folgt keinen Redirects, beendet Anfragen nach drei Sekunden und verwirft
Antworten über einem MiB vor JSON- und Zod-Verarbeitung.

`sync-state.ts` bietet spätere Statusübergänge als klaren Port an. Es gibt in
PROJ-3 keinen Aufrufer, der einen Quellenabruf ausführt oder einen Cursor
bestätigt. Das verhindert, dass ein halb implementierter Import den Cursor
vor seiner Fachtransaktion fortschreibt.

## Datenmodell und Autorisierung

`public.integration_provider` enthält zunächst nur `mock_pvs`.

| Tabelle | Zweck | Wesentliche Felder |
|---|---|---|
| `integration` | Ein Providerkontext pro Praxis | `id`, `practice_id`, `provider`, `created_at` |
| `integration_sync_state` | Aktueller technischer Abrufzustand | `integration_id`, `status`, `confirmed_change_cursor`, `last_attempt_at`, `last_success_at`, `next_attempt_at`, `last_error_code`, `updated_at` |
| `integration_sync_event` | Kurzlebige technische Ergebnisfolge | `id`, `integration_id`, `outcome`, `error_code`, `attempted_at`, `retry_at` |

Die Migration legt einen eindeutigen Index auf `(practice_id, provider)` sowie
Indizes für fällige Wiederholungen und die 30-Tage-Löschung an. Prüfbedingungen
erzwingen konsistente Zustände, zum Beispiel kein `retry_at` ohne
`retry_scheduled` und keine Fehlerklasse bei `healthy`.

Die drei Tabellen aktivieren RLS, erhalten keine direkten Privilegien für
Browserrollen und sind nicht über die Data API öffentlich lesbar. Die einzige
öffentliche Lesefunktion gibt einem aktuellen `praxisadmin` den Status seiner
eigenen Praxis zurück. Sie projiziert explizit keinen Cursor und keine
Ereignisdetails. Jede fehlende oder fremde Identität, jede andere Praxisrolle
und jeder `portaladmin` erhält ein neutrales leeres Ergebnis.

Private Schreibfunktionen stehen weder `anon` noch `authenticated` zur
Verfügung. Sie werden bis zur Spezifikation einer Ausführungsidentität nicht
von einer Next.js-Route, einem Server Action oder einem Cron-Job aufgerufen.
Der synthetische Seed erzeugt nur die `mock_pvs`-Integration für die
Testpraxis, ohne Konfigurationswerte zu speichern.

## Datenfluss und Zustandsübergänge

1. Ein späterer, ausdrücklich autorisierter Ausführer liest die private
   Konfiguration und ruft über den Adapter eine Seite ab.
2. Der Adapter validiert Status, Header, Größe, JSON und die kanonische Form.
3. Der Ausführer übergibt nur Ergebnisstatus, erlaubte Fehlerklasse und
   gegebenenfalls einen begrenzten nächsten Versuch an den Statusspeicher.
4. Bei einem `upsert`- oder `delete`-Batch übergibt er Cursor und Ressourcen
   an PROJ-4 oder PROJ-5. Erst deren erfolgreiche Fachtransaktion darf den
   Cursor als bestätigt markieren.

```text
idle ── success ───────────▶ healthy
  │                            │
  └─ 429/503/network ─────▶ retry_scheduled
                                  │
                                  └─ successful later run ──▶ healthy

any state ── invalid config/protocol/source contract ──▶ failed
```

Eine `retry_scheduled`-Speicherung nimmt einen `Retry-After` höchstens bis
fünf Minuten an. Ohne brauchbaren Header ist die Wartezeit exakt eine Minute.
Es gibt keine versteckte Echtzeit-Schleife oder Retry-Kaskade im HTTP-Client.

## Fehlergrenze

| Quellfall | Kanonisches Ergebnis | Persistierbar |
|---|---|---|
| Ungültige lokale Konfiguration | `configuration_invalid` | ja, ohne Konfigurationsdetails |
| Netzwerk/Timeout | `network_unavailable` | ja |
| 429 | `rate_limited` + begrenzter Zeitpunkt | ja |
| 503 | `temporarily_unavailable` + begrenzter Zeitpunkt | ja |
| Nicht erwarteter Status, Redirect, nicht-JSON oder zu großer Body | `source_protocol_invalid` | ja |
| Zod- oder fachliche Vertragsverletzung | `source_contract_invalid` | ja |

HTTP-Fehlertexte, Antwortbody, Header, URL, Token und Cursor erscheinen weder
in Fehlerobjekten noch in Ereignissen oder Logs. Nicht definierte Fehler werden
als `source_protocol_invalid` behandelt.

## Testarchitektur

- Vitest testet lokale Konfiguration, erlaubte Origin, feste Pfade, Header,
  Timeout, Redirect- und Größenlimit sowie die neutralen Fehlerobjekte.
- HTTP-Tests starten den existierenden Mock-PVS mit temporären Testwerten,
  lesen mit dem regulären Token und aktivieren Szenarien nur im Testcode. Sie
  decken Vollstände, Änderungen, Tombstones, fehlerhafte Quelle, 429 und 503
  ab.
- pgTAP testet RLS, fehlende Tabellenrechte, Statusisolation,
  cursorfreie `praxisadmin`-Antworten, Portaladmin-Ausschluss und die
  30-Tage-Retention.
- `npm run verify:full` bleibt der Abschlussnachweis, da die Änderung eine
  externe Integration und neue Datenbankautorisierung betrifft.

## Offene Folgeentscheidungen

- PROJ-4/5 spezifizieren die Ausführungsidentität, Batch-Transaktion,
  Idempotenz, Datenimport und Cursor-Commit.
- PROJ-4/5 entscheiden, ob und wie ein Scheduler die gespeicherte
  Wiederholbarkeit ausführt.
- Eine Oberfläche für Integrationsstatus benötigt eine eigene Spezifikation.
- PROJ-23 definiert den echten Herstelleradapter nach einem verfügbaren,
  vertraglich geklärten Anbieterzugang.
