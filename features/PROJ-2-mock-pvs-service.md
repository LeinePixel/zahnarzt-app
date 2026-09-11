# PROJ-2: Mock-PVS-Service

## Status: In Review
**Created:** 2026-09-10
**Last Updated:** 2026-09-10
**Priority:** P0 (MVP)

## Zusammenfassung

PROJ-2 stellt einen eigenständigen, lokalen HTTP-Dienst bereit, der eine externe Praxissoftware simuliert. Er liefert ausschließlich deterministische, synthetische Patienten- und Termindaten. Der Dienst ist eine realistische Quellgrenze für PROJ-3, nicht Teil der DentPilot-Anwendung und kein Patientendaten-Speicher.

Die echte Praxissoftware bleibt für Patienten, Termine, Behandlungen und Abrechnung führend. Der Mock bildet weder eine echte Dampsoft-Schnittstelle noch eine Zusage über deren späteren Vertrag ab. Er schafft einen bewusst kleinen, versionierten Testvertrag, der später von einem herstellerspezifischen Adapter ersetzt werden kann.

## Dependencies

PROJ-2 hat keine technische Feature-Abhängigkeit. Es folgt der empfohlenen
Baufolge nach PROJ-31, setzt dessen Abschluss aber nicht als Funktionsgrenze
voraus.

Es übernimmt lediglich die bereits geltenden Querschnittsgrenzen aus PROJ-1
und PROJ-31: lokale Secret-Behandlung, ausschließlich synthetische Daten und
keine Umgehung serverseitiger Anwendungsgrenzen.

PROJ-2 ist die Voraussetzung für PROJ-3 (Integration-Adapter-Schicht), PROJ-4 (Patientensynchronisierung) und PROJ-5 (Terminsynchronisierung).

## Beschlossene Entscheidungen

| ID | Entscheidung |
|---|---|
| D01 | Der Mock läuft als eigenständiger TypeScript-HTTP-Prozess in diesem Repository, nicht als Next.js-Route und nicht als Supabase-Funktion. |
| D02 | Die reguläre Schnittstelle ist eine versionierte, lesende REST-/JSON-API unter `/v1`. |
| D03 | Ein späterer Adapter authentisiert sich ausschließlich serverseitig per Bearer-Token. Der Token gelangt nie in Browser, Repository, URLs, Logs oder Testartefakte. |
| D04 | Der Dienst enthält ausschließlich deterministische, eindeutig synthetische Fixtures und keine persistente Datenbank. Ein Neustart stellt den Grundzustand wieder her. |
| D05 | Der reguläre Vertrag liefert nur Patienten- und Terminressourcen. Behandlungen, medizinische Inhalte, Freitext, Versicherungs-, Rechnungs- und Abrechnungsdaten sind ausgeschlossen. |
| D06 | Neben paginierten Vollständen liefert der Dienst einen cursor-basierten Änderungsstrom für `upsert`- und `delete`-Ereignisse. |
| D07 | Ein getrennter, zweiter Bearer-Token schützt ausschließlich Teststeuerung für vordefinierte Szenarien. Er ist kein fachlicher PVS-Schreibzugang. |

## User Stories

- Als Entwicklerin oder Entwickler des späteren Adapters möchte ich eine erreichbare, authentisierte PVS-Quelle mit stabilem Vertrag verwenden, damit der Adapter unabhängig von einem echten Herstellerzugang entwickelt und getestet werden kann.
- Als Entwicklerin oder Entwickler des späteren Syncs möchte ich Vollstände, Seitenwechsel, Änderungen, Löschungen und vorübergehende Fehler reproduzierbar auslösen, damit Wiederholungen und Fehlerbehandlung nachweisbar bleiben.
- Als Sicherheitsverantwortliche möchte ich sicherstellen, dass der Mock weder echte noch re-identifizierbare Gesundheitsdaten verarbeitet und dass seine Zugangsdaten nicht in die Browseranwendung gelangen.

## Umfang

### Servicegrenze und Laufzeit

Der Dienst liegt unter `services/mock-pvs/` und wird über ein eigenes npm-Skript lokal gestartet. Er verwendet keinen Supabase-Client, liest und schreibt keine DentPilot-Tabellen und enthält keine Next.js-Anwendungsroute. Er hält den aktivierten Fixture-Zustand nur im Speicher. Die reguläre API ist lesend; ausschließlich der getrennte Testzugang darf den In-Memory-Zustand auf ein vordefiniertes Szenario umstellen oder ihn zurücksetzen.

Die künftige DentPilot-Anwendung ruft den Dienst erst in PROJ-3 über eine serverseitige Basis-URL und den regulären Bearer-Token auf. PROJ-2 erzeugt keine DentPilot-Daten, keine Synchronisierung und keine Benutzeroberfläche.

### Regulärer API-Vertrag

Alle regulären Endpunkte verlangen `Authorization: Bearer <mock-pvs-read-token>`.

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/v1/health` | datenlose Erreichbarkeits- und Vertragsversionsprüfung |
| `GET` | `/v1/patients?cursor=&limit=` | stabil paginierter Patienten-Vollstand |
| `GET` | `/v1/patients/:id` | ein Patient über seine externe PVS-Kennung |
| `GET` | `/v1/appointments?patientId=&from=&to=&cursor=&limit=` | stabil paginierter Termin-Vollstand |
| `GET` | `/v1/changes?cursor=&limit=` | sortierte, inkrementelle Änderungen |

`limit` hat den Standardwert 25 und darf höchstens 100 sein. Cursor sind undurchsichtige Fortsetzungswerte, nicht auswertbare Zeitstempel oder IDs. Jede Listenantwort enthält genau die Schlüssel `data` und `nextCursor`; der letzte Abschnitt setzt `nextCursor` auf `null`. `/v1/health` liefert `{ data: { apiVersion: "v1" } }`.

Ein Patient enthält nur diese Felder:

| Feld | Bedeutung |
|---|---|
| `id` | stabile externe PVS-Kennung |
| `version` | pro Kennung steigender Quellversionswert |
| `firstName`, `lastName` | synthetische Namen |
| `birthDate` | ISO-8601-Datum ohne Uhrzeit |
| `email` | optionale synthetische Kontaktadresse |
| `phoneE164` | E.164-Telefonnummer |
| `sourceCreatedAt`, `sourceUpdatedAt` | ISO-8601-Quellzeitstempel |

Ein Termin enthält nur diese Felder:

| Feld | Bedeutung |
|---|---|
| `id` | stabile externe PVS-Kennung |
| `version` | pro Kennung steigender Quellversionswert |
| `patientId` | externe Patientenkennung |
| `startsAt`, `endsAt` | ISO-8601-Zeitpunkte mit Offset |
| `status` | `confirmed`, `cancelled`, `no_show`, `rescheduled` oder `completed` |
| `practitionerId` | undurchsichtige Quellreferenz, kein internes Benutzerkonto |
| `sourceCreatedAt`, `sourceUpdatedAt` | ISO-8601-Quellzeitstempel |

Das Feld `email` ist immer vorhanden und enthält entweder eine synthetische Kontaktadresse oder `null`. Es wird durch PROJ-2 weder nach DentPilot importiert noch angezeigt. Die Folge-Spezifikation entscheidet jeweils ausdrücklich, welche Quellfelder sie minimal übernimmt.

Der Terminfilter `patientId` verlangt eine exakte externe Kennung. `from` schließt Termine mit `startsAt` vor diesem Zeitpunkt aus, `to` Termine mit `startsAt` auf oder nach diesem Zeitpunkt. Sind beide Filter vorhanden, muss `from` vor `to` liegen; andernfalls antwortet der Dienst mit HTTP 422.

### Änderungsstrom

`GET /v1/changes` liefert Ereignisse in unveränderlicher Reihenfolge. Ein Ereignis enthält `eventId`, `cursor`, `occurredAt`, `entityType` (`patient` oder `appointment`), `operation` (`upsert` oder `delete`), `entityId` und `version`.

Ein `upsert` enthält zusätzlich den vollständigen aktuellen Patienten- oder Termindatensatz als `resource`. Ein `delete` enthält keine Ressource. Damit kann PROJ-3 idempotente Wiederholungen, verspätete Antworten und Tombstones testen, ohne für jedes Ereignis eine zusätzliche Abfrage durchführen zu müssen.

### Testzugang und Szenarien

Der Testzugang verlangt `Authorization: Bearer <mock-pvs-test-token>`.

Er ist ausschließlich für lokale Tests bestimmt und bietet nur das Aktivieren eines vordefinierten Szenarios sowie das Zurücksetzen auf `baseline`. Er nimmt keine frei eingegebenen Fachdaten an und stellt keine allgemeinen Schreiboperationen bereit. Die Konfiguration verwendet die ignorierten lokalen Variablen `MOCK_PVS_PORT`, `MOCK_PVS_READ_TOKEN` und `MOCK_PVS_TEST_TOKEN`; eine Beispielkonfiguration nennt nur diese Namen.

| Szenario | Zweck |
|---|---|
| `baseline` | gültiger, mehrseitiger Grundbestand |
| `changes` | deterministische Patienten- und Terminänderungen einschließlich Verschiebung |
| `deletions` | Tombstones für entfernte Quellen |
| `invalid-source-data` | absichtlich ungültige Quellwerte für spätere Boundary-Tests; die reguläre Datenroute liefert dann gezielt eine verletzte Ressourcenform |
| `rate-limited` | HTTP 429 mit `Retry-After` für reguläre Datenendpunkte |
| `temporarily-unavailable` | HTTP 503 mit `Retry-After` für reguläre Datenendpunkte |

### Fehlervertrag

| Bedingung | Antwort |
|---|---|
| fehlender oder ungültiger Bearer-Token | HTTP 401 mit neutralem, datenlosem Fehlercode |
| ungültiger Cursor, Filter oder `limit` | HTTP 422 mit neutralem Validierungsfehler |
| aktiviertes Rate-Limit-Szenario | HTTP 429 und `Retry-After` |
| aktiviertes Ausfall-Szenario | HTTP 503 und `Retry-After` |
| unbekannte Ressource | HTTP 404 ohne Angaben zu anderen Datensätzen |

Antworten enthalten keine Stacktraces, Token, Konfigurationswerte oder nicht angeforderten Fixture-Inhalte. Der Dienst protokolliert keine `Authorization`-Header und keine vollständigen Antwortkörper. Das Szenario `invalid-source-data` ist die einzige, explizit testgesteuerte Ausnahme vom normalen Ressourcenvertrag; es erlaubt dem späteren Adapter, seine Quellvalidierung zu beweisen.

## Sicherheits- und Datenschutzgrenzen

- Alle Fixtures müssen offensichtlich fiktiv sein und dürfen weder reale noch re-identifizierbare Patienten-, Gesundheits-, Kontakt- oder Beschäftigtendaten nachbilden.
- Bearer-Token werden ausschließlich über lokale, ignorierte Integrationskonfiguration bereitgestellt. Beispiel-Dateien dokumentieren nur Variablennamen, niemals Werte.
- Kein Token, Cursor oder Fixture-Inhalt darf in URLs, Browser-Storage, Screenshots, allgemeinen Logs, Testreports oder Quellcode erscheinen.
- Der Dienst ist kein Ersatz für einen echten Anbieter-, Datenschutz-, Vertrags-, Transfer- oder Real-Data-Gate-Nachweis.
- PROJ-2 enthält keine KI-Funktion, keine medizinische Entscheidung und keine Übertragung an externe Anbieter.

## Out of Scope

- Echte Dampsoft-, VDDS-, GDT-, KIM- oder sonstige Herstellerintegration
- Adapter, Retry- oder Backoff-Logik in DentPilot (PROJ-3)
- Persistente Synchronisierung oder interne Patienten-/Termintabellen (PROJ-4 und PROJ-5)
- Webhooks, Polling-Scheduler, Benutzeroberfläche, Benutzeranmeldung oder Browserzugriff auf den Dienst
- Behandlung, Befund, Diagnose, Freitext, Abrechnung, Versicherung, Dokumente, Bilder oder medizinische Inhalte
- Mehrpraxisbetrieb, Produktion, Deployment oder Öffnung des Real-Data-Gates

## Akzeptanzkriterien

- [x] Angenommen der Dienst startet mit gültiger lokaler Konfiguration, wenn ein Client den regulären Bearer-Token sendet, dann sind ausschließlich die versionierten, lesenden `/v1`-Endpunkte erreichbar.
- [x] Angenommen ein Token fehlt oder ist ungültig, wenn ein regulärer oder Testendpunkt aufgerufen wird, dann antwortet der Dienst neutral mit HTTP 401 und liefert keine Fixture- oder Konfigurationsdaten.
- [x] Angenommen der `baseline`-Zustand ist aktiv, wenn Patienten oder Termine über mehrere Seiten abgefragt werden, dann ist die Reihenfolge stabil, jeder Datensatz erscheint höchstens einmal und der letzte Cursor ist `null`.
- [x] Angenommen ein regulärer Client ruft den Änderungsstrom wiederholt auf, wenn ein Ereignis erneut geliefert wird, dann sind Kennung, Version, Reihenfolge und bei `upsert` die vollständige Ressource unverändert.
- [x] Angenommen `changes` oder `deletions` ist aktiv, wenn der Änderungsstrom abgefragt wird, dann liefert er die definierten Änderungen beziehungsweise Tombstones reproduzierbar.
- [x] Angenommen ungültige Quellwerte, Rate Limiting oder ein temporärer Ausfall aktiviert sind, wenn reguläre Datenendpunkte aufgerufen werden, dann entsprechen Statuscode und Header dem Fehlervertrag.
- [x] Angenommen ein Testlauf abgeschlossen oder der Dienst neu gestartet ist, wenn `baseline` aktiviert wird, dann stellt der Dienst ohne persistente Nebenwirkung exakt den Ausgangszustand wieder her.
- [x] Angenommen die Service-Fixtures, Konfiguration und Tests geprüft werden, dann enthalten sie ausschließlich synthetische Daten und keine Tokens oder Geheimnisse.
- [x] Angenommen die direkte Service-Test-Suite und die Repository-Vollverifikation laufen, dann bestehen sie mit dem gestarteten Mock-PVS; vorhandene Auth-, RLS- und Real-Data-Gates bleiben unverändert.

### Lokale Abnahmeevidenz (10.09.2026)

Die lokale, ausschließlich synthetische Verifikation besteht aus `npm run test:mock-pvs` (5 Testdateien, 84 Tests), `npm run lint`, `npm run typecheck`, `npm test` (16 Vitest-Testdateien, 142 Tests) und `npm run build` sowie `npx supabase test db --local` (2 pgTAP-Dateien, 36 Tests) und `npm run test:e2e:edge-required` (15 Browserfälle in Chromium, Firefox, WebKit und Microsoft Edge). Die Suite prüft die getrennten Bearer-Grenzen, nur lesende `/v1`-Routen, opaque Cursor, Pagination, Filter, Upserts, Tombstones, feste Fehlerszenarien und den separaten Prozessstart. PROJ-2 bleibt `In Review`: Der Dienst ist lokal, unhosted und kein Nachweis für einen echten PVS-Zugang oder das Real-Data-Gate.

## Teststrategie

- Unit-Tests für Konfigurationsvalidierung, Token-Grenze, Cursor-Kodierung, Pagination, Schema-Validierung und Szenariozustand.
- HTTP-Integrationstests gegen einen gestarteten Dienst für jeden regulären Endpunkt sowie 401, 404, 422, 429 und 503.
- Vertragsfälle für alle Fixture-Szenarien, insbesondere Wiederholbarkeit, Versionssprünge, Vollressourcen bei `upsert` und ressourcenlose Tombstones.
- Ein lokaler Prozess-Smoke-Test, der den Dienst startet, `/v1/health` abfragt und kontrolliert beendet.
- Vor Abschluss die bestehende Vollverifikation; PROJ-2 fügt keine Datenbankmigration und daher keine neue RLS-Oberfläche hinzu.

## Technischer Entwurf

Der verbindliche Entwurf steht in [`docs/superpowers/specs/2026-09-10-proj-2-mock-pvs-service-design.md`](../docs/superpowers/specs/2026-09-10-proj-2-mock-pvs-service-design.md). Der Folge-Implementierungsplan wird erst nach Prüfung und Freigabe dieser Spezifikation erstellt.

## Offene Voraussetzungen

- Ein echter Dampsoft- oder anderer PVS-Zugang bleibt ausschließlich PROJ-23 vorbehalten und blockiert PROJ-2 nicht.
- Die spätere Zuordnung eines PVS-Zugangs zu einer DentPilot-Praxis, Synchronisationsstatus, Retry/Backoff und Konfliktbehandlung werden in PROJ-3 entschieden.
- Das Real-Data-Gate bleibt geschlossen. PROJ-2 liefert keinen betrieblichen, rechtlichen oder Anbieter-Nachweis.

## Decision Log

| Entscheidung | Begründung | Datum |
|---|---|---|
| Eigenständiger HTTP-Prozess statt Next.js-Route | Der spätere Adapter soll eine echte Netz-, Konfigurations- und Geheimnisgrenze testen. | 2026-09-10 |
| REST-/JSON mit Cursor-Pagination | Der Vertrag bleibt klein, gut testbar und von späteren Herstellerformaten entkoppelt. | 2026-09-10 |
| Zwei getrennte Bearer-Token | Reguläres Lesen und lokale Szenariosteuerung erhalten unterschiedliche, minimal nötige Rechte. | 2026-09-10 |
| Patienten und Termine, aber keine Fachinhalte | Die Folgefeatures PROJ-3 bis PROJ-5 erhalten eine Quelle, ohne medizinische oder abrechnungsbezogene Daten vorwegzunehmen. | 2026-09-10 |
| Cursor-basierter Änderungsstrom | Adapter- und Sync-Folgeschritte können Wiederholungen, Änderungen und Löschungen reproduzierbar prüfen. | 2026-09-10 |
