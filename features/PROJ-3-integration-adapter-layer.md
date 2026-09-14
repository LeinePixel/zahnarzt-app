# PROJ-3: Integration-Adapter-Schicht

## Status: In Review

**Created:** 2026-09-13  
**Last Updated:** 2026-09-14
**Priority:** P0 (MVP)

## Zusammenfassung

PROJ-3 schafft eine ausschließlich serverseitige Adaptergrenze zwischen
DentPilot und dem lokalen Mock-PVS aus PROJ-2. Sie validiert dessen
versionierte `/v1`-Antworten, übersetzt sie in herstellerneutrale Quelltypen
und hält einen datensparsamen, praxisgebundenen technischen Sync-Status vor.

Der Adapter speichert weder Patienten noch Termine und stellt keine
Oberfläche, Route, Scheduler oder automatische Wiederholung bereit.
PROJ-4 und PROJ-5 konsumieren später die normalisierten Batches und bestätigen
einen Cursor erst zusammen mit ihrer eigenen, erfolgreichen Fachtransaktion.
Die Praxissoftware bleibt Source of Truth.

## Dependencies

- PROJ-1 liefert Authentisierung, Praxisgrenze und RLS.
- PROJ-2 liefert den lokalen, rein synthetischen HTTP-Vertrag.
- PROJ-4 und PROJ-5 sind Folgeschritte und nicht Teil dieses Features.

## Beschlossene Entscheidungen

| ID | Entscheidung |
|---|---|
| D01 | Ein schmaler Adapter-Port trennt DentPilot von Transport, Bearer-Token und Mock-PVS-Formaten. Der konkrete Mock-PVS-Adapter ist die einzige Implementierung in PROJ-3. |
| D02 | Der Adapter ist server-only. Es gibt keine Next.js-Route, keinen Browserzugriff und keine Einbettung des Tokens in `NEXT_PUBLIC_*`-Variablen. |
| D03 | Die lokale Adapterkonfiguration besteht aus `MOCK_PVS_BASE_URL` und `MOCK_PVS_READ_TOKEN` in einer ignorierten Integrationsumgebung. Der Mock-PVS-Test-Token gehört ausschließlich in Tests und wird vom Produktcode nie gelesen. |
| D04 | Der konkrete Mock-Endpunkt akzeptiert nur eine lokale HTTP-Origin ohne Pfad, Query oder Fragment. Er folgt keinen Redirects, begrenzt Antwortgrößen und Zeiten und nutzt nur fest definierte `/v1`-Pfade. |
| D05 | Eingehende Antworten werden an der Adaptergrenze mit eigenen strikten Zod-Schemas geprüft. Der Adapter importiert keine internen Dateien des Mock-PVS. |
| D06 | `integration`, `integration_sync_state` und `integration_sync_event` speichern nur technische Metadaten. Tokens, Basis-URLs, Antwortkörper, externe Ressourcenkennungen sowie Patienten- und Termindaten sind ausgeschlossen. |
| D07 | Tabellenrechte verweigern direkten Browserzugriff. Eine spätere Statusanzeige erhält nur einen kontrollierten, cursorfreien Status für den eigenen `praxisadmin`; Portaladmins erhalten in PROJ-3 keinen Zugriff. |
| D08 | PROJ-3 führt keine Synchronisierung eigenständig aus. Ein späteres Ausführungsmodell für PROJ-4/5 muss zuerst eine eigene, nicht Service-Role-basierte Ausführungsidentität und seinen Scheduler spezifizieren. |

## User Stories

- Als Entwicklerin oder Entwickler eines späteren Patienten- oder Termin-Syncs
  möchte ich validierte, herstellerneutrale Seiten und Änderungsereignisse
  abrufen, damit Fachlogik nicht an HTTP, Token oder PVS-Feldnamen gebunden
  ist.
- Als Praxisadmin möchte ich später für meine Praxis einen neutralen
  Integrationszustand sehen können, ohne dass Cursor, Zugangsdaten oder
  Quellinhalte sichtbar werden.
- Als Sicherheitsverantwortliche möchte ich, dass fehlerhafte oder temporär
  nicht erreichbare Quellen nur datensparsame Fehlerklassen hinterlassen und
  keine Quellantworten, Tokens oder personenbezogenen Daten protokolliert
  werden.

## Umfang

### Serverseitiger Adapter-Port

Der Port beschreibt ausschließlich lesende Operationen für den in PROJ-2
definierten Vertrag:

- `checkHealth()` bestätigt nur die erwartete API-Version `v1`.
- `listPatients({ cursor, limit })` liefert eine validierte, normalisierte
  Patientenseite.
- `listAppointments({ patientId, from, to, cursor, limit })` liefert eine
  validierte, normalisierte Terminseite.
- `listChanges({ cursor, limit })` liefert eine geordnete, normalisierte
  Änderungsseite mit `upsert`-Ressourcen oder ressourcenlosen Tombstones.

`cursor` bleibt vollständig undurchsichtig. Der Adapter interpretiert ihn
nicht, leitet ihn nur an den vorgesehenen Endpunkt weiter und gibt den
Folgecursor zurück. Paginierung, Import, Deduplizierung, fachliche
Konfliktauflösung und das Vorziehen eines Cursors entstehen erst in PROJ-4
beziehungsweise PROJ-5.

Die kanonischen Typen enthalten nur die bereits von PROJ-2 zugesicherten,
nichtmedizinischen Felder. Sie modellieren keine DentPilot-Tabellen und keine
zusätzlichen Herstellerfelder.

### Konfiguration und Netzgrenze

Der Produktcode liest ausschließlich `MOCK_PVS_BASE_URL` und
`MOCK_PVS_READ_TOKEN` aus der Prozessumgebung. Lokale Werte liegen in
`.env.integration.local`, die von Git ignoriert bleibt. Eine dokumentierte
Beispieldatei nennt nur Variablennamen, keine Werte. Das Token darf nicht in
der Datenbank, in Next.js-öffentlichen Variablen, in URLs, Logs, Testreports
oder Screenshots erscheinen.

Für den lokalen Mock muss die Basis-URL eine lokale HTTP-Origin ohne
Pfadbestandteile sein. Der Client verwendet eine feste Timeout-Grenze von drei
Sekunden, `redirect: 'error'`, feste `/v1`-Pfade und eine maximale
Antwortgröße von einem MiB. Fehlende, ungültige oder nichtlokale Konfiguration
wird vor einem Netzwerkaufruf neutral abgewiesen.

### Technischer Status und Fehlerereignisse

`integration` ordnet genau einen Provider `mock_pvs` einer Praxis zu;
`(practice_id, provider)` ist eindeutig. Die Zuordnung enthält keine
Verbindungsdaten oder Geheimnisse.

`integration_sync_state` hält pro Integration den letzten Ergebniszustand,
den zuletzt bestätigten Änderungs-Cursor, Zeitpunkte des letzten Versuchs und
Erfolgs sowie einen frühesten nächsten Versuch. Zulässige Zustände sind
`idle`, `healthy`, `retry_scheduled` und `failed`.

`integration_sync_event` hält eine auf 30 Tage begrenzte Folge technischer
Ergebnisse. Ein Ereignis enthält nur Integration, Ergebnis, erlaubte
Fehlerklasse, Versuchszeitpunkt und gegebenenfalls den nächsten erlaubten
Versuch. Es enthält keine Antwort, HTTP-Header, URL, Token, Cursor, externe
Kennungen oder Zähler pro Patient beziehungsweise Termin.

Die Fehlerklassen sind abschließend: `rate_limited`,
`temporarily_unavailable`, `network_unavailable`, `source_contract_invalid`,
`source_protocol_invalid` und `configuration_invalid`. Ein 429- oder
503-Antwortfall übernimmt einen gültigen `Retry-After` bis höchstens fünf
Minuten. Fehlt oder überschreitet der Header diese Grenze, setzt der Zustand
eine feste Wartezeit von einer Minute. Der Adapter selbst startet keine
Wiederholungsschleife.

Ein erfolgreicher Abruf aktualisiert nur den technischen Zustand. Ein
Änderungs-Cursor darf erst durch eine spätere PROJ-4/5-Transaktion als
bestätigt gespeichert werden, nachdem deren zugehörige Fachdaten erfolgreich
verarbeitet wurden.

### Autorisierung und Datenbankgrenze

Alle drei Tabellen aktivieren RLS. `anon` und `authenticated` erhalten keine
direkten Tabellenrechte. Ein kontrollierter, `SECURITY DEFINER`-geschützter
Lesefunktionsvertrag gibt ausschließlich einem aktuellen `praxisadmin` den
statusbezogenen, cursorfreien Datensatz seiner eigenen Praxis zurück. Jeder
fehlende, fremde oder sonst nicht passende Kontext liefert ein neutrales leeres
Ergebnis. `portaladmin` und andere Praxisrollen erhalten keinen Zugriff.

Die schreibenden Statusfunktionen liegen im privaten Datenbankschema und sind
für Browserrollen nicht ausführbar. PROJ-3 implementiert bewusst noch keine
Runtime-Identität, die sie ausführt. Der lokale Seed darf ausschließlich die
synthetische Providerzuordnung ohne Geheimnisse anlegen.

### Fehlerverhalten

Der Adapter gibt keine HTTP- oder Providerfehltexte an Aufrufer weiter.
Ungültige Konfiguration, Netzwerkfehler, 401/404/422/429/503, unerwartete
Statuscodes, nicht-JSON-Antworten, übergroße Antworten und Schemafehler werden
auf die erlaubten Fehlerklassen abgebildet. Auf Fehler werden weder Cursor noch
fachliche Daten fortgeschrieben.

## Sicherheits- und Datenschutzgrenzen

- Entwicklung, Fixtures und Tests verwenden ausschließlich eindeutig
  synthetische Daten.
- Die Adaptergrenze liest keinen Service-Role-Key und umgeht RLS nie.
- Der Mock-PVS-Lesezugang bleibt ein serverseitiges Geheimnis; der
  Teststeuerungs-Token bleibt außerhalb des Produktcodes.
- Technische Fehlerereignisse sind datensparsam, zeitlich begrenzt und frei von
  Quellpayloads oder externen Kennungen.
- Der Adapter ist kein echter PVS-Zugang, kein Hosting-, Anbieter- oder
  Real-Data-Gate-Nachweis.

## Out of Scope

- Persistente Patienten-, Termin- oder sonstige Fachdaten
- Datenimport, Delete-Verarbeitung, fachliche Konfliktauflösung und
  Cursor-Commit in einer Fachtransaktion
- Scheduler, Cron-Job, Retry-Worker oder automatische Wiederholung
- Integrations-, Status- oder Fehleroberfläche
- Echte Dampsoft-, VDDS-, GDT-, KIM- oder andere Herstelleranbindung
- Speicherung oder Bedienung des Mock-PVS-Testzugangs
- Datenweitergabe, KI, Hosting, Deployment und Öffnung des Real-Data-Gates

## Akzeptanzkriterien

- [x] Bei gültiger lokaler Konfiguration kann der serverseitige Adapter die
  Mock-PVS-Version prüfen und jede spezifizierte `/v1`-Seite in kanonische
  Typen überführen.
- [x] Bei fehlender, ungültiger oder nichtlokaler Konfiguration erfolgt kein
  Netzwerkaufruf und es wird nur `configuration_invalid` geliefert.
- [x] Bei ungültigen Quellressourcen, unerwarteten Antworten oder
  Antwortgrößen über dem Limit liefert der Adapter eine neutrale Fehlerklasse,
  keinen Quelltext und keine Teilressource.
- [x] Bei 429 und 503 wird ein zulässiges `Retry-After` begrenzt in den
  technischen Status übernommen; der Adapter wiederholt den Aufruf nicht
  selbst.
- [x] Bei einem erfolgreichen Abruf kann ein technischer Erfolg gespeichert
  werden, ohne Patienten, Termine, URLs, Tokens, Cursor oder Antwortkörper in
  Fehlerereignissen abzulegen.
- [x] Ein Praxisadmin kann nur den cursorfreien Status der eigenen Praxis
  lesen. Andere Praxisrollen, Portaladmins, fremde Praxisadmins und anonyme
  Aufrufe erhalten keine Statusdaten und keine direkten Tabellenrechte.
- [x] Der lokale Seed legt nur die synthetische `mock_pvs`-Zuordnung an; er
  enthält keine Integrationszugangsdaten.
- [x] Unit-, HTTP- und pgTAP-Negativtests sowie `npm run verify:full` bestehen
  mit ausschließlich synthetischer Konfiguration.

## Teststrategie

- Unit-Tests prüfen Konfigurations- und Origin-Validierung, feste Pfade,
  Redirect-Verbot, Timeout, Größenlimit, Zod-Grenze und die fehlertextfreie
  Fehlerzuordnung.
- HTTP-Integrationstests starten den bestehenden Mock-PVS mit temporären
  Testwerten. Sie prüfen Health, Seiten, Änderungen, Tombstones,
  `invalid-source-data`, 429, 503 und die strikte Trennung des Test-Tokens.
- pgTAP prüft Tabellenrechte, RLS, die eigene Praxisgrenze, cursorfreie
  Ergebnisse, ausgeschlossene Portaladmins sowie 30-Tage-Löschung.
- Die Vollverifikation umfasst Lint, Typecheck, Vitest, pgTAP und die
  bestehenden Browser-/Edge-Prüfungen. Ein Scheduler- oder UI-Test gehört
  nicht zu PROJ-3.

## Technischer Entwurf

Der verbindliche Architekturentwurf steht in
[`docs/superpowers/specs/2026-09-13-proj-3-integration-adapter-design.md`](../docs/superpowers/specs/2026-09-13-proj-3-integration-adapter-design.md).
Der freigegebene Implementierungsplan wurde lokal umgesetzt; seine
Prüfevidenz ist unten dokumentiert.

## Decision Log

| Entscheidung | Begründung | Datum |
|---|---|---|
| Schmaler Adapter statt Provider-Plattform | Der MVP benötigt nur den Mock-PVS-Vertrag; ein Plugin-System würde reale Anbieteranforderungen vorwegnehmen. | 2026-09-13 |
| Persistenter technischer Zustand ohne Fachimport | Folgefeatures benötigen belegbare Quellgesundheit und Retry-Grenzen, besitzen aber noch keine Datenmodelle für Patienten oder Termine. | 2026-09-13 |
| Keine Runtime-Ausführung in PROJ-3 | Eine sichere Ausführungsidentität und der Scheduler sind eigenständige Architekturentscheidungen und dürfen nicht durch einen Service-Role-Shortcut entstehen. | 2026-09-13 |
| Cursor bleibt intern und bestätigungspflichtig | Ein Cursor darf niemals den Erfolg einer noch nicht transaktional verarbeiteten Fachänderung behaupten. | 2026-09-13 |

## Lokale Abnahmecheckliste

- [x] Konfiguration und Quellschemas: `src/features/integrations/mock-pvs-config.test.ts`
- [x] HTTP-Grenzen, Paging, Tombstones und neutrale Fehler: `src/features/integrations/mock-pvs-adapter.test.ts`
- [x] Cursorfreier serverseitiger Status: Policy- und Statusmapper-Tests
- [x] Tabellenrechte, Praxisgrenze, Zustandskonsistenz und Retention: `supabase/tests/proj_3_integration_adapter.test.sql`
- [x] Synthetischer idempotenter Seed: `supabase/seed.test.ts`
- [x] Repository- und Browserintegration: `npm run verify:full`
- [ ] Hosted-Betrieb, Scheduler/Ausführungsidentität, Status-UI, Fachimport und echte Anbieteranbindung bleiben separate Folgearbeit.
- [ ] Real-Data-Gate bleibt geschlossen; Datenschutz-, DSGVO- und EU-AI-Act-Gates sind nicht durch lokale Tests freigegeben.

## Lokale PROJ-3-Prüfevidenz — 14.09.2026

`npm run verify:full` endete mit Exit 0: Lint, Typecheck, 25 Vitest-Dateien /
233 Tests, Produktionsbuild, vier pgTAP-Dateien / 134 Assertions und
17 Playwright-Tests einschließlich Microsoft Edge. Zusätzlich liefen separat
`npm run test:mock-pvs` (84 Tests), `npm run lint`, `npm run typecheck`,
`npm test`, `npx supabase test db --local` und
`npm run test:e2e:edge-required` erfolgreich. Die finale Vollprüfung enthält
die Review-Korrekturen. `git diff --check` und beide Token-Grenzscans sind sauber.

Die fokussierte Evidenz umfasst 20 Konfigurations-/Schema-Tests, 24 HTTP-Tests,
13 Statusmapper-Tests, fünf Policy-Tests, sieben Seed-Tests und 26 PROJ-3-pgTAP-
Assertions. Die neuen Tests wurden vor der Implementierung rot ausgeführt.
Der lokale synthetische Reset und Seed waren erfolgreich.

Ein unabhängiger Review fand zwei Fehler: SQL-NULL-Umgehung der Retry-Constraint
und falsche Einordnung eines abgebrochenen Antwortstreams. Beide wurden mit
roten Negativtests reproduziert, korrigiert, grün geprüft und im Review bestätigt.
Keine neue App-Route, kein Scheduler, kein Fachimport und keine Hosted-Änderung.
Real-Data-Gate und alle betrieblichen Folgefreigaben bleiben offen.
