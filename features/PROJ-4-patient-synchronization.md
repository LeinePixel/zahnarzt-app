# PROJ-4: Patienten-Synchronisierung

## Status: In Review

**Created:** 2026-09-14
**Last Updated:** 2026-09-16
**Priority:** P0 (MVP)
**Freigabe:** Vollständige Spec und Architektur am 14.09.2026 vom Nutzer freigegeben.

## Ziel

Ein ausdrücklich gestarteter lokaler CLI-Lauf übernimmt ausschließlich synthetische
Patienten aus dem PROJ-3-Adapter in eine praxisgebundene DentPilot-Projektion.
Er verarbeitet Vollstand, Änderungen und Löschungen wiederholbar und bestätigt
den Patientenfortschritt zusammen mit der erfolgreichen Fachtransaktion.
Die Praxissoftware bleibt Source of Truth; Quellfelder sind in DentPilot nicht editierbar.

## Dependencies und Ausgangsstand

- PROJ-1: Praxiszuordnung und Datenbankfundament.
- PROJ-19: getrennte Portalidentität und bestehende Audit-/Supportgrenzen.
- PROJ-2: lokaler synthetischer Vollstand und gemischter Änderungsfeed.
- PROJ-3: server-only Adapter, strikte Quellvalidierung und technischer Status.
- PROJ-5 und PROJ-6 bleiben eigenständige Folgefeatures.

PROJ-3 ist lokal implementiert, sein PR #4 ist noch offen. PROJ-4 wird auf einem
separaten lokalen Branch vorbereitet. Ein Merge oder Push von PROJ-4 ist damit
nicht freigegeben. Die tatsächliche Implementierungsbasis ist vor dem TDD-Lauf
erneut zu prüfen; keine Änderungen am separaten PROJ-31-PR.

## User Stories

- Als Entwickler möchte ich einen begrenzten Patientensync lokal starten und
  erneut starten können, ohne doppelte Patienten oder verlorene Änderungen.
- Als Sicherheitsverantwortlicher möchte ich, dass der Ausführer nur seine
  Integration verarbeitet und weder Service-Role-Zugang noch Fachinhalte in Logs benötigt.
- Als Entwickler von PROJ-5 möchte ich Terminänderungen unabhängig lesen können,
  auch wenn der Patientensync bereits denselben gemischten Feed durchlaufen hat.

## Freigegebene Entscheidungen

| ID | Entscheidung |
|---|---|
| D01 | Expliziter lokaler CLI-Lauf ohne Scheduler, UI, Server Action oder Browserroute. |
| D02 | Eine eingeschränkte PostgreSQL-Loginidentität gehört genau einer Integration; der Sync verwendet keinen Supabase-Service-Role-Key. |
| D03 | Ein privater Patientencheckpoint ist unabhängig vom PROJ-3-Gesamtcursor und jedem künftigen Termincheckpoint. |
| D04 | Initialer Vollstand und nachfolgende Patientenereignisse werden vor dem ersten Commit vollständig validiert. |
| D05 | Patientenmutationen und Checkpoint werden in genau einer Fachtransaktion pro Lauf geschrieben. |
| D06 | Quellversionen verhindern Duplikate und veraltete Überschreibungen; gleiche Version mit abweichendem Inhalt ist ein Konflikt. |
| D07 | Ein Delete entfernt alle Patientenattribute und erhält nur eine minimale Versionsmarke gegen Wiederbelebung durch alte Ereignisse. |
| D08 | PROJ-4 gewährt Browserrollen noch keinen Patientenzugriff. PROJ-6 spezifiziert seine Lesefunktionen und Rollenrechte. |
| D09 | Ungültige oder verlorene Quellcursor stoppen den Lauf; es gibt keinen automatischen Rebootstrap. |

## Datenmodell

### `public.patient`: aktuelle Projektion

| Feld | Regel und Zweck |
|---|---|
| `id` | Interne UUID, verschieden von der PVS-Kennung; stabil bei Updates. |
| `practice_id` | Nichtleerer Praxis-FK; wird aus der Integration abgeleitet. |
| `integration_id` | Zugehörige Integration; zusammengesetzter FK sichert deren Praxiszuordnung. |
| `source_id` | Undurchsichtige externe Kennung, 1 bis 100 Zeichen. |
| `source_version` | Positive Ganzzahl, höchste erfolgreich verarbeitete Version. |
| `first_name`, `last_name` | Nichtleere Namen mit jeweils maximal 200 Zeichen. |
| `birth_date` | Gültiges ISO-Datum; Identifikationsmerkmal für das spätere Profil. |
| `phone_e164` | Bereits durch PROJ-3 validierte E.164-Nummer für PROJ-29. |
| `source_created_at`, `source_updated_at` | Validierte Quellzeitpunkte. |
| `created_at`, `updated_at` | Lokale Anlage-/Änderungszeitpunkte. |

`(integration_id, source_id)` ist eindeutig. Indizes sichern Praxis-/Integrations-
und Nummernabfragen. Keine Zusammenführung anhand Name, Telefonnummer oder Geburtsdatum:
gleichnamige Patienten und gemeinsame Familiennummern bleiben getrennte Ressourcen.

`email` wird bewusst nicht übernommen: PROJ-4 versendet keine Kommunikation.
PROJ-12/13 müssen einen später benötigten Kontaktvertrag ausdrücklich spezifizieren.
Behandlungs-, Befund-, Versicherungs-, Rechnungs-, Freitext- und Rohpayloadfelder fehlen.

### `private.patient_source_version`: minimale Versionsmarke

Pro Integration und externer Kennung: `practice_id`, `integration_id`, `source_id`,
`source_version`, `is_deleted`, `updated_at`. Zusammengesetzte Fremdschlüssel
erzwingen die gleiche Praxis wie die Integration. Die Marke enthält keine Namen,
Nummern, Geburtsdaten, Ereignispayloads oder HTTP-Daten. Sie existiert auch für ein
Delete einer noch unbekannten Ressource und verhindert spätere alte Upserts.

### `private.patient_sync_checkpoint`: nur Patientenfortschritt

Pro Integration: `practice_id`, `integration_id` als eindeutiger Schlüssel,
`initial_import_completed`, `confirmed_change_cursor`, `updated_at`.
Ein neues Ziel beginnt ohne Cursor und ohne abgeschlossenen Vollimport.
Cursor bleiben privat und undurchsichtig. `integration_sync_state.confirmed_change_cursor`
aus PROJ-3 wird durch PROJ-4 niemals verändert.

### `private.patient_sync_executor`: Ausführungszuordnung

`database_role` ist ein eindeutiger Rollenname; `practice_id`, `integration_id`
verweisen konsistent auf genau eine Integration. Die Tabelle speichert keinen
Login-Token, kein Passwort und keine Verbindungs-URL. Eine Identität kann nicht
selbst ihre Zuordnung anlegen oder verändern.

## Ablauf und Transaktionsgrenze

1. Private Konfiguration validieren, bevor ein Quell- oder Datenbankaufruf erfolgt.
2. Eigene Integration über die Datenbank-Loginidentität bestimmen und einen
   nichtblockierenden Session-Advisory-Lock pro Integration erwerben.
3. Den Checkpoint und eine gegebenenfalls bestehende Retry-Sperre laden. Ein
   zweiter Lauf oder ein noch nicht erlaubter Versuch beendet sich neutral ohne Quellabruf.
4. Health über den vorhandenen Adapter prüfen.
5. Nur beim ersten Lauf alle Patientenseiten lesen und auf die erlaubten Felder projizieren.
6. Den gemischten Änderungsfeed ab dem eigenen bestätigten Cursor lesen; beim
   ersten Lauf ab dessen Anfang. Patientenereignisse projizieren, Terminereignisse
   nur im Speicher passieren lassen. Keine Terminressourcen speichern.
7. Nach vollständig erfolgreicher Validierung den gesammelten Vollstand und die
   geordneten Patientenereignisse in einer Fachtransaktion anwenden. Der Kandidat
   für den neuen Checkpoint ist der Cursor des letzten tatsächlich gelesenen
   Ereignisses, auch wenn dieses ein Terminereignis ist. Bei leerem Feed bleibt
   der Cursor unverändert. `nextCursor: null` löscht keinen vorhandenen Checkpoint.
8. In derselben Transaktion Checkpoint, initialen Abschluss und technischen
   Erfolg schreiben. Erst nach COMMIT ist der Lauf erfolgreich.
9. Lock und Verbindung in jedem Pfad freigeben. Kein automatischer Folgelauf.

Ein Lauf nutzt `limit: 100`, höchstens 100 Seiten insgesamt und höchstens 10 MiB
projizierten In-Memory-Inhalt. Wiederholte Fortsetzungscursor und leere Seiten mit
Fortsetzung sind Protokollfehler. Eine 60-Sekunden-Frist beendet laufende Quellabrufe
und Datenbankoperationen; die Transaktion muss vor ihrem Beginn noch ausreichend
Zeit für ihr maximal fünf Sekunden langes Statement besitzen. Kein partieller
Import bei Größen-, Zeit-, Schema- oder Seitenfehlern.

Der maximale Zehn-MiB-Vertrag gilt auch für den SQL-Commit-Eingang. JSON wird als
gebundener Parameter übertragen, nie als SQL-String verkettet. Die Datenbank
validiert sämtliche projizierten Felder und Mutationsformen erneut.

## Idempotenz, Versionen und Löschungen

- Neue Kennung: Patient und Versionsmarke anlegen.
- Höhere Upsert-Version: Patient aktualisieren und Marke vorziehen; eine höhere
  Version darf einen zuvor gelöschten Patienten erneut als Quellressource anlegen.
- Niedrigere Version: keine Änderung.
- Gleiche Upsert-Version mit identischen projizierten Quellfeldern: keine Änderung.
- Gleiche Version mit abweichenden Feldern oder widersprüchlichem Delete/Upsert:
  neutraler Quellkonflikt, gesamter Lauf rollt zurück.
- Höheres Delete: Patient physisch entfernen, minimale Delete-Versionsmarke setzen.
- Gleiches Delete wiederholt: keine Änderung; altes Delete: keine Änderung.
- Fehlen im Vollstand allein löst kein Delete aus; nur ein ausdrückliches Tombstone
  ist ein Löschsignal. Ein initialer Vollstand startet keine Bereinigung vorhandener Daten.

Patientendaten und bestätigter Patientencheckpoint bleiben bei jedem Rollback
unverändert. Die SQL-Funktion akzeptiert den erwarteten vorherigen Checkpoint und
prüft ihn mit `IS NOT DISTINCT FROM`; ein veralteter Commit wird verweigert.
Die Commit-Funktion verlangt zusätzlich den gehaltenen Integrationslock.

## Autorisierung und Secrets

Die Migration stellt eine Gruppenrolle `dentpilot_patient_sync_executor` mit
`NOLOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`,
`NOREPLICATION` bereit. Sie erhält nur private Schema-USAGE und EXECUTE auf
die drei eigenen Einstiegspunkte für Lock/Checkpoint, Commit und Fehlerstatus.
Keine direkten Tabellenrechte und keine Ausführung der generischen PROJ-3-Writer.

Ein separater, ausdrücklich lokaler Verwaltungsprozess provisioniert eine
synthetische LOGIN-Rolle mit denselben Beschränkungen, Gruppenmitgliedschaft und
Zuordnung. Der Lauf verwendet nur deren Zugang. Passwortprovisionierung liegt
außerhalb der versionierten Migration; keine festen Passwörter oder Secrets in SQL.

SECURITY-DEFINER-Funktionen haben `search_path = ''`. Jede Funktion bestimmt ihre
Integration anhand des unveränderlichen `session_user`, prüft die Zuordnung neu
und nimmt keine frei wählbare Praxis oder Integration entgegen. Zuordnungszeile
und Checkpoint werden beim Commit gesperrt. Eine Änderung oder Entfernung der
Zuordnung während des Quellabrufs verhindert den Commit. Funktionenowner sind
administrative Datenbankidentitäten; der Ausführer kann sie nicht übernehmen.

Alle neuen Tabellen aktivieren RLS. `public`, `anon`, `authenticated` und die
Ausführergruppe besitzen keine direkten Patienten-, Versions- oder Checkpointrechte.
Portaladmins erhalten auch mit Supportfreigabe keinen Patientenzugriff.
CLI-Administration bleibt explizite Verwaltung; RLS und Funktionsprivilegien
bilden die Benutzergrenze. Patientenzugriff für PROJ-6 ist noch nicht implementiert.

Die ignorierte `.env.patient-sync.local` enthält private Konfiguration:
`PATIENT_SYNC_DATABASE_URL`, `MOCK_PVS_BASE_URL`, `MOCK_PVS_READ_TOKEN` und
die Pflichtbestätigung `PATIENT_SYNC_SYNTHETIC_ONLY=1`. Die CLI akzeptiert nur
lokale explizite Ports für PostgreSQL und Mock-PVS, keine Hosted-Verbindungen,
keinen privilegierten DB-Rollennamen und keinen Mock-Testtoken. Die Bestätigung
ist eine Entwicklungsgrenze und keine Prüfung, ob beliebige Eingaben echt sind.

Die Datenbank-URL bleibt ausschließlich CLI-intern und wird nie geloggt. Ihre
Verbindungsparameter sind nicht Patientendaten in HTTP-URLs. Sie wird nicht in
`.env.local` oder `.env.seed.local` gespeichert. Kein App-Server lädt diese Datei.

## Fehler und technischer Status

Adapterfehler behalten die sechs geschlossenen PROJ-3-Fehlerklassen. Ein ungültiger
Cursor, zyklische Seiten und ein überschrittenes Seiten-/Größenlimit ergeben
`source_protocol_invalid`; ein Quellversionskonflikt `source_contract_invalid`.
Für die Patientensync-Domain ergänzen `sync_busy`, `retry_not_due`,
`execution_denied` und `persistence_unavailable` neutrale Laufresultate. Sie
erweitern die PROJ-3-Anbieterfehlerenum nicht.

Quellfehler dürfen nach dem Fachrollback über den eigenen begrenzten Writer den
technischen Fehlerstatus und ein neutrales Ereignis aktualisieren. Die vorhandene
Retry-Logik wird wiederverwendet. Bei unerreichbarer Datenbank bleibt der letzte
bestätigte Status erhalten; die CLI behauptet keinen neuen gespeicherten Status.

CLI-Ausgabe: genau eine neutrale deutsche Ergebnismeldung ohne Patientenanzahl,
Namen, Nummern, externe IDs, Cursor, SQL-Details, Hostwerte oder Geheimnisse.
Exit 0 für Erfolg, Exit 2 für belegten Lock/noch nicht fälligen Retry, Exit 1 für
Fehler. Keine Payload-Dumps, Traces oder Screenshots. `integration_sync_event`
enthält weiterhin nur die bisher erlaubten technischen Felder und 30-Tage-Retention.

## Quellcursor und Grenzen des Mock-Vertrags

Der aktuelle Mock speichert Fortsetzungscursor im Prozessspeicher und bindet sie
an das aktivierte Szenario. Neustart, Reset und Szenariowechsel invalidieren sie.
Der Patientensync setzt in diesen Fällen den Checkpoint nicht zurück und
importiert nicht automatisch erneut. Ein frisches Szenario benötigt eine explizit
neu eingerichtete synthetische Testumgebung. Integrationstests verwenden hierfür
isolierte Ziele und starten nicht eigenmächtig produktionsähnliche Datenresets.

Der Mock besitzt kein atomisches Snapshot-/Feed-Wasserzeichen. Die lokale Abnahme
gilt deshalb nur für während eines Laufs unveränderte deterministische Szenarien.
Teststeuerung wird zwischen abgeschlossenen Läufen verwendet. Eine Zusage für
verlustfreien Bootstrap bei gleichzeitig veränderlicher echter Quelle gehört
zum künftigen Herstellervertrag und ist kein Ergebnis von PROJ-4.

## Datenschutz und Aufbewahrung

Zweck ist die synthetische Entwicklungsprojektion für spätere Praxisworkflows.
Es gibt keine realen Betroffenen; später wären Patienten und ihre Identitäts-/
Kontaktdaten betroffen. Die Rechtsgrundlagenprüfung für echte Verarbeitung ist
Teil des geschlossenen Real-Data-Gates und wird durch diese Spec nicht ersetzt.

Patientenattribute werden bei Quell-Delete unmittelbar aus der Projektion
entfernt. Minimale Versionsmarken bleiben für die Lebensdauer der synthetischen
Integration erhalten; nur damit lassen sich beliebig alte Ereignisse sicher
verwerfen. Sie verschwinden zusammen mit der Integration bzw. dem autorisierten
Testreset. Keine pauschale produktive Aufbewahrungsfrist wird daraus abgeleitet:
Rechtsgrundlage, Backup-Löschung und Fristen für spätere personenbezogene Marken
benötigen vor realem Betrieb eine eigene Freigabe.

Kein neuer externer Empfänger und keine KI-Funktion. DSGVO-/Datensicherheits-
und EU-AI-Act-Gates bleiben unverändert. Lokales unverschlüsseltes Loopback ist
auf synthetische Entwicklung begrenzt und kein Freigabenachweis für echte Daten.

## Akzeptanzkriterien

- [x] AC01: Zwei initiale Patientenseiten werden vollständig projiziert; der
  Initialimport wird erst nach erfolgreichem Gesamtcommit bestätigt.
- [x] AC02: Ein zweiter Lauf erzeugt keine Duplikate und startet keinen zweiten Vollimport.
- [x] AC03: Neuere Versionen aktualisieren, ältere verändern nichts, gleiche
  widersprüchliche Versionen rollen den gesamten Lauf zurück.
- [x] AC04: Delete entfernt Attribute und schützt über die Versionsmarke gegen alte Upserts.
- [x] AC05: Fehler auf einer späteren Quellseite und ein SQL-Fehler verändern weder
  Patientendaten noch den bestätigten Checkpoint oder Initialabschluss.
- [x] AC06: Endcursor wird aus dem letzten Ereignis bestimmt; leere Terminalseite
  bewahrt den bisherigen Cursor. Opaque Cursor werden nicht interpretiert.
- [x] AC07: Ein gemischter Feed verändert nur Patienten; PROJ-3-Gesamtcursor bleibt
  unverändert, ein unabhängiger künftiger Terminconsumer kann den Feed vollständig lesen.
- [x] AC08: Gleichzeitiger zweiter Lauf wird ohne Netzwerkabruf abgewiesen; Crash
  gibt den Sessionlock frei, veralteter oder ungesperrter Commit wird verweigert.
- [x] AC09: Zwei tatsächlich angemeldete DB-Ausführer können nur ihre eigene
  Integration verarbeiten; fehlende/entzogene Zuordnung und privilegierte CLI-Konfiguration scheitern.
- [x] AC10: Alle Tabellen nutzen RLS; Browser-/Portalrollen können weder direkt
  Patienten lesen/schreiben noch Sync-Writer ausführen, auch nicht mit Supportfreigabe.
- [x] AC11: Konfiguration, Frist, Seiten-/Byte-Grenzen und zyklische Paging-Antworten
  werden geprüft; Logs und technische Ereignisse bleiben frei von Fachinhalten und Secrets.
- [x] AC12: 429/503/Netzwerkfälle ergeben neutralen technischen Retry-Status ohne
  versteckte Wiederholung; Aufruf vor Retry-Zeitpunkt wird ohne Netzwerkabruf beendet.
- [x] AC13: Nach Quellneustart/Szenariowechsel wird ein ungültiger Cursor neutral
  verweigert; kein automatisches Löschen, Cursorreset oder Rebootstrap.
- [x] AC14: CLI-Prozess läuft mit begrenzten lokalen Zugangsdaten und liefert die
  festgelegten Exitcodes; kein Service-Role-Key gelangt in seine Umgebung.
- [x] AC15: Gezielte Unit-, HTTP-, pgTAP-, Rollen-/Prozessprüfungen und `verify:full`
  bestehen; ausschließlich tatsächlich ausgeführte Evidenz wird dokumentiert.

## Out of Scope

Scheduler, Status- oder Patienten-UI, Browser-Patientenleserechte, Terminimport,
CRM-Mutationen, E-Mail-Import/Versand, echte PVS-Anbindung, produktive Ausführungs-
provisionierung, Hosted-Migration, Deployment, Real-Data-Gate-Freigabe und PROJ-31.

## Technischer Entwurf

[Architekturentwurf](../docs/superpowers/specs/2026-09-14-proj-4-patient-sync-design.md).
Der detaillierte [TDD-Umsetzungsplan](../docs/superpowers/plans/2026-09-14-proj-4-patient-sync.md) liegt vor.
