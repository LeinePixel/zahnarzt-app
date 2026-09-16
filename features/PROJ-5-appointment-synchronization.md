# PROJ-5: Termin-Synchronisierung

## Status: Architected

**Created:** 2026-08-24
**Last Updated:** 2026-09-16
**Priority:** P0 (MVP)
**Freigabe:** Vollständige Spec und Architektur am 16.09.2026 vom Nutzer freigegeben.

## Ziel

Ein ausdrücklich gestarteter lokaler CLI-Lauf übernimmt ausschließlich synthetische
Termine aus dem PROJ-3-Adapter in eine praxisgebundene DentPilot-Projektion. Er
verarbeitet Vollstand, Änderungen und Löschungen wiederholbar und bestätigt den
Terminfortschritt zusammen mit der erfolgreichen Fachtransaktion. Die Praxissoftware
bleibt Source of Truth; Quellfelder sind in DentPilot nicht editierbar.

## Dependencies und Ausgangsstand

- PROJ-1: Praxiszuordnung und Datenbankfundament.
- PROJ-2: lokaler synthetischer Terminbestand und gemischter Änderungsfeed.
- PROJ-3: server-only Adapter, strikte Quellvalidierung und technischer Status.
- PROJ-4: praxisgebundene Patientenprojektion, auf die Termine intern verweisen.
- PROJ-7 und spätere Terminworkflows bleiben eigenständige Folgefeatures.

PROJ-3 und PROJ-4 sind lokal implementiert und vollständig verifiziert. Ihre
Browser-, Hosted-, Real-Data- und Deployment-Grenzen bleiben bestehen. PROJ-5
beginnt erst nach einem gesondert freigegebenen TDD-Umsetzungsplan mit Featurecode.

## User Stories

- Als Entwickler möchte ich einen begrenzten Terminsync lokal starten und erneut
  starten können, ohne doppelte Termine oder verlorene Änderungen.
- Als Entwickler möchte ich Termine zuverlässig mit bereits synchronisierten
  Patienten verbinden und einen unvollständigen Lauf vollständig zurückrollen.
- Als Sicherheitsverantwortlicher möchte ich, dass ein eigener Ausführer nur
  seine Integration verarbeitet und weder Service-Role-Zugang noch Fachinhalte
  in Logs benötigt.
- Als Entwickler von PROJ-7 möchte ich eine konsistente Terminprojektion erhalten,
  ohne in PROJ-5 bereits Browserzugriff oder eine Kalenderoberfläche zu öffnen.

## Freigegebene Entscheidungen

| ID | Entscheidung |
|---|---|
| D01 | Eigenständiger lokaler Termin-CLI-Lauf nach dem PROJ-4-Muster; kein gemeinsames generisches Sync-Framework. |
| D02 | Eigene NOLOGIN-Gruppenrolle und separat provisionierte LOGIN-Identität; keine Erweiterung der Patientenrolle. |
| D03 | Patienten- und Terminsync verwenden denselben integrationsbezogenen Advisory Lock und laufen nicht gleichzeitig. |
| D04 | Ein privater Termincheckpoint ist unabhängig vom Patientencheckpoint und vom technischen PROJ-3-Gesamtcursor. |
| D05 | Initialer Vollstand und nachfolgende Ereignisse werden vor dem ersten Commit vollständig validiert. |
| D06 | Terminmutationen, Patientenauflösung, Versionsmarken und Checkpoint werden in genau einer Fachtransaktion geschrieben. |
| D07 | Eine fehlende, gelöschte oder integrationsfremde Patientenreferenz verwirft den gesamten Lauf als `source_contract_invalid`. |
| D08 | `practitionerId` bleibt eine undurchsichtige, längenbegrenzte Quellreferenz; PROJ-5 führt keine Practitioner-Entität ein. |
| D09 | Quellversionen verhindern Duplikate und veraltete Überschreibungen; gleiche Version mit abweichendem Inhalt ist ein Konflikt. |
| D10 | Ein Delete entfernt die Terminprojektion und erhält nur eine minimale Versionsmarke gegen alte Ereignisse. |
| D11 | Browserrollen erhalten in PROJ-5 keinerlei Terminzugriff; PROJ-7 spezifiziert Lesefunktionen und Rollenrechte. |
| D12 | Ungültige oder verlorene Quellcursor stoppen den Lauf; es gibt keinen automatischen Rebootstrap. |

## Datenmodell

### `public.appointment`: aktuelle Projektion

| Feld | Regel und Zweck |
|---|---|
| `id` | Interne UUID, verschieden von der PVS-Kennung; stabil bei Updates. |
| `practice_id` | Nichtleerer Praxis-FK; wird aus der Integration abgeleitet. |
| `integration_id` | Zugehörige Integration; zusammengesetzter FK sichert deren Praxiszuordnung. |
| `source_id` | Undurchsichtige externe Kennung, 1 bis 100 Zeichen. |
| `source_version` | Positive Ganzzahl, höchste erfolgreich verarbeitete Version. |
| `patient_id` | Interne UUID auf `public.patient`; Patient und Termin müssen derselben Praxis und Integration angehören. |
| `starts_at`, `ends_at` | Zeitzonenbehaftete Zeitpunkte; Ende liegt strikt nach Beginn. |
| `status` | Geschlossener Vertrag: `confirmed`, `cancelled`, `no_show`, `rescheduled`, `completed`. |
| `practitioner_source_id` | Undurchsichtige Quellreferenz, 1 bis 100 Zeichen; keine fachliche Practitioner-Beziehung. |
| `source_created_at`, `source_updated_at` | Validierte Quellzeitpunkte. |
| `created_at`, `updated_at` | Lokale Anlage-/Änderungszeitpunkte. |

`(integration_id, source_id)` ist eindeutig. Geeignete Indizes sichern Praxis-/
Integrations-, Patienten- und Zeitraumsuchen für spätere Features. Die externe
`patientId` wird erst im atomaren Commit über `(integration_id, source_id)` in
die interne `patient_id` aufgelöst. Es werden keine Behandlungsart, Raum-, Notiz-,
Abrechnungs-, Versicherungs- oder Rohpayloadfelder gespeichert.

### `private.appointment_source_version`: minimale Versionsmarke

Pro Integration und externer Terminkennung: `practice_id`, `integration_id`,
`source_id`, `source_version`, `is_deleted`, `updated_at`. Die Marke enthält
keine Zeit-, Status-, Patienten- oder Practitioner-Daten. Sie bleibt nach einem
Delete bestehen und verhindert Wiederbelebung durch alte Ereignisse.

### `private.appointment_sync_checkpoint`: nur Terminfortschritt

Pro Integration: `practice_id`, `integration_id`, `initial_import_completed`,
`confirmed_change_cursor`, `updated_at`. Der Checkpoint ist unabhängig von
`private.patient_sync_checkpoint` und `integration_sync_state.confirmed_change_cursor`.

### `private.appointment_sync_executor`: Ausführungszuordnung

`database_role` ist ein eindeutiger Rollenname; `practice_id`, `integration_id`
verweisen konsistent auf genau eine Integration. Die Tabelle speichert keine
Passwörter oder Verbindungs-URLs. Eine Ausführungsidentität darf ihre Zuordnung
nicht selbst anlegen oder verändern.

## Ablauf und Transaktionsgrenze

1. Private lokale Konfiguration und synthetische Pflichtbestätigung validieren.
2. Integration aus `session_user` ableiten und denselben nichtblockierenden
   Session-Advisory-Lock wie PROJ-4 für diese Integration erwerben.
3. Eigenen Termincheckpoint und vorhandene Retry-Sperre laden; Busy oder noch
   nicht fälliger Retry endet neutral und vor jedem Quellabruf.
4. Health über den bestehenden Adapter prüfen.
5. Nur beim ersten Lauf alle Terminseiten über `listAppointments({limit: 100})`
   lesen und auf erlaubte Felder projizieren.
6. Den gemischten Änderungsfeed ab dem Termincheckpoint lesen. Terminereignisse
   werden projiziert; Patientenereignisse verändern keine Patienten, bestimmen
   aber den letzten tatsächlich gelesenen Cursor mit.
7. Nach vollständiger Validierung Vollstand und geordnete Terminereignisse in
   genau einer Fachtransaktion anwenden. Jede Patientenreferenz wird darin gegen
   die aktuelle, nicht gelöschte Patientenprojektion derselben Integration geprüft.
8. In derselben Transaktion Termincheckpoint, Initialabschluss und technischen
   Erfolg schreiben. Erst nach COMMIT gilt der Lauf als erfolgreich.
9. Lock und Verbindung in jedem Pfad freigeben. Kein automatischer Folgelauf.

Ein Lauf nutzt höchstens 100 Seiten insgesamt und höchstens 10 MiB projizierten
In-Memory-Inhalt. Wiederholte Fortsetzungscursor sowie leere Seiten mit Fortsetzung
sind Protokollfehler. Die Gesamtlaufzeit beträgt höchstens 60 Sekunden; vor dem
Commit bleiben fünf Sekunden für das begrenzte Datenbankstatement reserviert.
JSON wird gebunden übertragen, nie in SQL verkettet. Ein leerer Feed bewahrt den
bisherigen Cursor; `nextCursor: null` ist kein neuer bestätigter Offset.

## Idempotenz, Versionen und Löschungen

- Neue Kennung: Termin und Versionsmarke anlegen, sofern der Patient auflösbar ist.
- Höhere Upsert-Version: Termin aktualisieren und Marke vorziehen; eine höhere
  Version darf einen zuvor gelöschten Termin wieder anlegen.
- Niedrigere Version: keine Änderung.
- Gleiche Upsert-Version mit identischen projizierten Feldern: keine Änderung.
- Gleiche Version mit abweichenden Feldern oder widersprüchlichem Delete/Upsert:
  `source_contract_invalid`, gesamter Lauf rollt zurück.
- Höheres Delete: Termin physisch entfernen und minimale Delete-Marke setzen.
- Gleiches Delete wiederholt oder altes Delete: keine Änderung.
- Fehlen im Vollstand ist kein Delete; nur ein ausdrückliches Tombstone löscht.

Ist ein referenzierter Patient nicht vorhanden, gelöscht oder einer anderen
Integration zugeordnet, bleiben Terminprojektion, Versionsmarken, Initialabschluss
und Termincheckpoint vollständig unverändert. Der Commit verwendet einen
Compare-and-swap auf erwartetem Cursor und Initialstatus und verlangt den
gehaltenen gemeinsamen Integrationslock.

## Autorisierung und Secrets

Die Migration legt `dentpilot_appointment_sync_executor` als NOLOGIN-,
NOSUPERUSER-, NOBYPASSRLS-, NOCREATEDB-, NOCREATEROLE- und NOREPLICATION-Rolle
an. Sie erhält nur Schema-USAGE und EXECUTE für ihre eigenen drei privaten
Einstiegspunkte: Erwerb, Commit und Fehlerstatus. Direkte Tabellenrechte sowie
Ausführung der Patienten- und generischen PROJ-3-Writer bleiben entzogen.

Ein separater lokaler Verwaltungsprozess provisioniert eine synthetische LOGIN-
Rolle und ihre feste Praxis-/Integrationszuordnung. Alle SECURITY-DEFINER-Funktionen
verwenden einen leeren `search_path`, leiten den Scope aus `session_user` ab und
nehmen keine frei wählbare Praxis oder Integration entgegen. Zuordnung und
Checkpoint werden beim Commit gesperrt.

Alle neuen Tabellen aktivieren RLS. `public`, `anon`, `authenticated` und beide
Sync-Ausführergruppen besitzen keine direkten Terminrechte. Die ignorierte
`.env.appointment-sync.local` enthält ausschließlich
`APPOINTMENT_SYNC_DATABASE_URL`, Mock-PVS-Konfiguration und
`APPOINTMENT_SYNC_SYNTHETIC_ONLY=1`. Erlaubt sind nur lokale Hosts mit expliziten
Ports und ein unprivilegierter Termin-Sync-Login. Service-Role-, Seed-, Admin-
und Mock-Testzugänge werden zur Laufzeit abgelehnt und nie geloggt.

## Fehler und technischer Status

Adapterfehler behalten die sechs geschlossenen PROJ-3-Fehlerklassen. Ungültige
Cursor, Paging-Zyklen und überschrittene Seiten-/Größenlimits ergeben
`source_protocol_invalid`; fehlende Patienten und Versionskonflikte ergeben
`source_contract_invalid`. Die Domainresultate `sync_busy`, `retry_not_due`,
`execution_denied` und `persistence_unavailable` bleiben außerhalb der
Anbieterfehlerenum.

Nach einem Fachrollback darf ein begrenzter Fehlerwriter ausschließlich den
technischen Status und ein neutrales Ereignis aktualisieren. CLI und Logs nennen
keine Termine, Patienten, externen IDs, Practitioner-IDs, Cursor, SQL-Details,
Hostwerte oder Secrets. Exit 0 bedeutet Erfolg, Exit 2 Busy oder Retry noch nicht
fällig und Exit 1 Fehler. Es gibt keine versteckten Wiederholungen.

## Quellgrenzen, Datenschutz und Aufbewahrung

Der Mock besitzt weder dauerhafte Cursor noch ein atomisches Snapshot-/Feed-
Wasserzeichen. Die lokale Abnahme gilt nur für während eines Laufs unveränderte,
deterministische Szenarien. Neustart oder Szenariowechsel führt nicht zu einem
automatischen Reset oder Rebootstrap.

PROJ-5 verarbeitet ausschließlich synthetische Entwicklungsdaten. Später wären
Termine Gesundheits- und Patientenkontext; Rechtsgrundlage, Betroffenenprozesse,
Aufbewahrung, Backup-Löschung, Verschlüsselung und Herstellervertrag benötigen
vor echten Daten eine eigene Freigabe. Ein Quell-Delete entfernt die fachlichen
Termindaten unmittelbar; die minimale Versionsmarke bleibt für die Lebensdauer
der synthetischen Integration. Es gibt keinen neuen externen Empfänger und keine
KI-Funktion. DSGVO-, Datensicherheits-, EU-AI-Act- und Real-Data-Gates bleiben
geschlossen.

## Akzeptanzkriterien

- [ ] AC01: Alle initialen Terminseiten werden projiziert; der Initialimport wird
  erst nach erfolgreichem Gesamtcommit bestätigt.
- [ ] AC02: Ein zweiter Lauf erzeugt keine Duplikate und keinen zweiten Vollimport.
- [ ] AC03: Jeder Termin verweist auf den internen Patienten derselben Integration;
  fehlende, gelöschte oder fremde Patienten rollen den gesamten Lauf zurück.
- [ ] AC04: Zeitintervall, Status und längenbegrenzte Practitioner-Quellreferenz
  werden strikt validiert; nicht freigegebene Felder werden nicht gespeichert.
- [ ] AC05: Neuere Versionen aktualisieren, ältere verändern nichts und gleiche
  widersprüchliche Versionen rollen den gesamten Lauf zurück.
- [ ] AC06: Delete entfernt Fachattribute und schützt per Versionsmarke gegen alte Upserts.
- [ ] AC07: Ein Fehler auf später Quellseite oder im SQL verändert weder Termine
  noch Versionsmarken, Termincheckpoint oder Initialabschluss.
- [ ] AC08: Der Endcursor stammt vom letzten Ereignis einschließlich Patientenereignis;
  leerer Feed bewahrt den Termincheckpoint und PROJ-3-/PROJ-4-Cursor bleiben unverändert.
- [ ] AC09: Patienten- und Terminsync schließen einander über denselben
  integrationsbezogenen Advisory Lock aus, ohne vorab die Quelle zu lesen.
- [ ] AC10: Echte separate DB-LOGIN-Rollen sind auf ihre eigene Integration und
  ihre eigenen Funktionen begrenzt; Browserrollen besitzen keine Terminrechte.
- [ ] AC11: Konfiguration, Frist, Seiten-/Byte-Grenzen, Cursorzyklen, Retry und
  neutrale Log-/CLI-Ausgabe werden geprüft.
- [ ] AC12: 429/503/Netzwerkfälle schreiben nur neutralen technischen Status;
  ungültige Quellcursor lösen keinen automatischen Rebootstrap aus.
- [ ] AC13: Der tatsächliche lokale CLI-Prozess nutzt keine privilegierten Secrets
  und liefert die festgelegten Exitcodes.
- [ ] AC14: Gezielte Unit-, HTTP-, pgTAP-, Rollen-, Konkurrenz- und Prozessprüfungen
  sowie `npm run verify:full` bestehen; nur tatsächlich ausgeführte Evidenz wird dokumentiert.

## Out of Scope

Kalender- oder Status-UI, Browser-Terminleserechte, Terminbearbeitung, Erinnerungen,
Regelautomatisierung, Scheduler, Practitioner-Stammdaten, generisches Sync-Framework,
Umbau des Patientensyncs, echte PVS-Anbindung, produktive Provisionierung,
Hosted-Migration, Deployment, Real-Data-Gate-Freigabe und PROJ-31.

## Technischer Entwurf

[Architekturentwurf](../docs/superpowers/specs/2026-09-16-proj-5-appointment-sync-design.md).
Der detaillierte TDD-Umsetzungsplan wird nach der abschließenden Dokumentprüfung erstellt.
