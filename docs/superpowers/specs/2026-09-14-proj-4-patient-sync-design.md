# PROJ-4 Patienten-Synchronisierung — Architekturentwurf

**Status:** Lokal implementiert und am 16.09.2026 vollständig verifiziert; In Review
**Datum:** 2026-09-14
**Verbindliche Anforderungen:** [PROJ-4-Spec](../../../features/PROJ-4-patient-synchronization.md)

## Gewählte Lösung

Ein lokaler CLI-Ausführer liest über den bestehenden `IntegrationAdapter` und
überträgt eine begrenzte, validierte Patientenprojektion über private PostgreSQL-
Funktionen. Seine DB-Identität gehört genau einer Integration. Ein Sessionlock
verhindert parallele Läufe; die Fachtransaktion enthält Projektion,
Versionsmarken, Patientencheckpoint und technischen Erfolgsstatus.

```text
lokale private CLI-Konfiguration
          |
          v
runPatientSync(adapter, repository)
          |                     |
          v                     v
PROJ-3 IntegrationAdapter    eigene PostgreSQL-Loginrolle
          |                     |
          v                     v
lokaler Mock-PVS          private Sync-Einstiegspunkte
                                |
                                v
                     eine atomare Fachtransaktion
                     patient / version / checkpoint
                     PROJ-3 technischer Erfolg
```

Das Diagramm zeigt die geplante Lösung, keine bereits implementierte Kontrolle.
Prozessstart, Provisionierung und sämtlicher Datenbankzugriff sind auf die
synthetische lokale Umgebung begrenzt.

## Betrachtete Alternativen

| Ansatz | Bewertung |
|---|---|
| Begrenzter CLI-Lauf, einmaliger Gesamtcommit | Empfohlen und vom Umfang her freigegeben: keine teilweise abgeschlossenen Läufe, kleine deterministische Mock-Daten. |
| Commit pro Quellseite | Spart Speicher bei großen Quellen, erfordert aber zusätzliche Bootstrap-/Wiederherstellungszustände und erschwert die zugesagte Gesamtatomarität. Nicht PROJ-4. |
| Scheduler mit Worker und Job-Lease | Automatisiert Betrieb, braucht jedoch eigene Zeitpläne, Monitoring und Ausfallregeln. Im freigegebenen Umfang zurückgestellt. |

Bei der Identität wurde eine direkte, eingeschränkte PostgreSQL-Loginrolle gewählt.
Sie vermeidet eine zusätzliche Supabase-Maschinenkonto-/JWT-Rollenarchitektur.
Der vorhandene Seed-Service-Role-Key bleibt ausschließlich Verwaltung und wird
von diesem Ausführer nicht gelesen oder verwendet.

## Komponenten

| Geplanter Pfad | Verantwortung |
|---|---|
| `src/features/patients/source-projection.ts` | Strikter minimaler Quellfeldvertrag und deterministische Feldprojektion. |
| `src/features/patients/sync-patients.ts` | Ablauf, Frist-/Paging-Grenzen, Vollstand, gemischter Feed, neutrales Laufresultat. |
| `src/features/patients/sync-repository.ts` | Schmaler Port für Erwerb von Lock/Checkpoint, Commit und Fehlerstatus. |
| `src/features/patients/postgres-sync-repository.ts` | Ein dedizierter `pg`-Client, gebundene Parameter, Verbindungs-/Transaktionsgrenzen. |
| `src/features/patients/sync-config.ts` | Private lokale DB-/Mock-Konfiguration und synthetische Pflichtbestätigung. |
| `scripts/run-patient-sync.ts` | Prozessstart, neutraler Exitcode, Aufräumen; keine Fachlogik. |
| `.env.patient-sync.local.example` | Namen und wertfreie Platzhalter, keine Zugangsdaten. |
| `supabase/migrations/20260914170000_proj_4_patient_sync.sql` | Tabellen, RLS, Gruppenrolle, private Funktionen und Indizes. |
| `supabase/tests/proj_4_patient_sync.test.sql` | Funktionale SQL-, RLS-, Konsistenz- und Privilegienprüfungen. |
| Co-located `*.test.ts` | Projektion, Orchestrator, echter Mock, echte DB-Loginrollen und CLI-Prozess. |

`pg` und seine TypeScript-Typen sind noch keine vorhandenen Projektabhängigkeiten.
Ihre gezielte Ergänzung ist Teil des späteren Plans, keine bereits vorgenommene
Installation. Es wird keine allgemeine DB-Schicht für andere Features gebaut.

Die produktiven CLI-Module bleiben server-only. Der vorgeschlagene lokale
Prozessstart verwendet Node mit `--conditions=react-server`, `--import=tsx` und
`--env-file=.env.patient-sync.local`; dadurch kann der bestehende server-only
Adapter im expliziten Serverprozess geladen werden. Der Prozess lädt weder
Next.js-Seiten noch die App-/Seed-Umgebungsdateien.

## SQL-Einstiegspunkte und Verträge

Alle Funktionen sind im privaten Schema, haben leeren search_path und leiten
Praxis und Integration aus `session_user` ab. Der PostgreSQL-Client verwendet
einen einzelnen, dedizierten Verbindungsprozess; kein gemeinsam genutzter Pool,
in dem ein Sessionlock fremden Nutzern zugeordnet werden könnte.

### `private.acquire_patient_sync()`

Keine Argumente. Prüft Loginzuordnung und Gruppenmitgliedschaft, dann Retry-
Zeitpunkt und `pg_try_advisory_lock` für die eigene Integration. Bei zulässigem
Start liefert sie nur private Laufdaten: Integrations-ID, Initialabschluss und
bestätigten Patientencheckpoint. Busy, zu früh oder verweigert sind kontrollierte
Laufresultate. Wiederholter Erwerb derselben Session ist ausgeschlossen, damit
Lock-Reentranz nicht unbemerkt eine zusätzliche Locksperre hinterlässt.

### `private.commit_patient_sync(expected_cursor, expected_initial_completed, snapshot, mutations, candidate_cursor)`

Nur begrenzte private Eingaben; keine frei wählbare Praxis oder Integration.
`snapshot` ist die Liste projizierter Patienten beim Initialimport, danach leer.
`mutations` enthält ausschließlich Patienten-Upserts bzw. Delete-Identität und
Version, ohne Quellereignis-ID, Ereigniscursor oder Terminpayload. Der neue
Checkpoint ist ein separater Parameter. Der gesamte Eingang ist auf 10 MiB
begrenzt; projektiertes Feldschema und Mengenlimits werden erneut geprüft.

Die Funktion prüft die aktuelle Ausführungszuordnung, hält sie beim Commit
gesperrt und verlangt den Integrationslock dieser DB-Session. Sie sperrt den
Checkpoint, vergleicht erwarteten Cursor und Initialabschluss und wendet die
Versionierungsregeln aus der Spec an. SQL prüft insbesondere widersprüchliche
gleiche Versionen und die konsistente Praxis aller Foreign Keys.

Ein Fehler innerhalb der Funktion wird in einem PL/pgSQL-Exception-Block
behandelt, sodass alle Fachmutationen dieses Aufrufs zurückrollen. Die Funktion
liefert nur ein geschlossenes neutrales Resultat; Constraint-Details, Failing-Row-
Werte und gebundene Patientenparameter gelangen nicht als ungefilterte Exception
zum Client. Verbindungs-/Statement-Abbruch führt außerdem zum Client-ROLLBACK.
SQL-Statement-/Parameterlogging und Tracing bleiben für diesen Pfad abgeschaltet.

Die Funktion schreibt den bestehenden technischen PROJ-3-Erfolg innerhalb
derselben Transaktion. Kein EXECUTE der generischen Writer wird an den
CLI-Ausführer vergeben. Der gemeinsame bestätigte PROJ-3-Cursor bleibt unverändert.

### `private.record_patient_sync_failure(error_code, retry_at)`

Prüft die eigene aktuelle Zuordnung und den Integrationslock erneut. Akzeptiert
nur die bestehenden sechs Anbieterfehler und begrenzte Retry-Zeitpunkte. Sie
delegiert intern an den PROJ-3-Statuswriter; Fachprojektion und Checkpoint werden
nicht verändert. Kein Fachdatenargument und keine Freitextmeldung.

Die Sessionfreigabe erfolgt im `finally` durch Advisory-Unlock und Schließen der
Verbindung. Eine gestorbene Session verliert ihren Lock automatisch.

## Datenfluss und Fehleratomarität

Es gibt keine offene Fachtransaktion während der HTTP-Abrufe. Der Sessionlock
bleibt bei diesen Abrufen bestehen, damit ein zweiter Ausführer nicht dieselbe
Integration parallel verarbeitet. Der In-Memory-Batch ist explizit begrenzt.

Beim Initialimport werden Vollstand und vollständiger aktueller Änderungsfeed
gesammelt; anschließend erfolgen Snapshot-Upserts und Ereignisse in Quellreihenfolge
innerhalb einer einzigen Transaktion. Versionsmarken entscheiden pro Ressource.
Beim Folgelauf werden nur Änderungen ab dem eigenen Checkpoint gesammelt.

Die Patientenprojektion ist der Commit-Eingang, kein unvalidierter Source-Body.
Terminereignisse werden validiert, danach verworfen; nur der Stream-Fortschritt
des Patientenconsumers darf an ihnen vorbeigehen. Ein anderer Consumer besitzt
seinen eigenen Start und Checkpoint. PROJ-5 muss seine getrennte Umsetzung erst
spezifizieren; PROJ-4 legt noch keine Termintabelle oder Terminausführungsrolle an.

Schlägt die letzte Quellseite fehl, gibt es noch keine Fachmutation. Schlägt das
SQL-Anwenden eines späteren Patienten fehl, rollt der Gesamtcommit zurück. Ein
anschließender technischer Fehlerstatus ist ausdrücklich kein Fachimport-Erfolg.

## Bootstrap und Quellneustart

Cursor sind kein Zeitstempel und dürfen nicht nachgebaut, sortiert oder aus einer
Kennung abgeleitet werden. Terminales `nextCursor: null` ist ein Paging-Ende,
nicht der bestätigte Feed-Offset. Dafür gilt der letzte tatsächliche Ereigniscursor.

Der existierende Mock stellt keine konsistente Bootstrap-Wasserzeichengrenze
und keine dauerhaften Cursor bereit. Der Testvertrag lautet deshalb: während
eines Laufs unverändertes deterministisches Szenario. Neustart/Szenariowechsel
wird mit ungültigem Cursor verweigert. Testfälle für separate Szenarien werden
mit getrennten synthetischen Integrationen und neu provisionierten Zielen aufgebaut.

Es wird in PROJ-4 kein Mock-Vertrag stillschweigend erweitert. Für einen echten
Hersteller wären ein konsistenter Snapshot-Start und dauerhafte Feed-Retention
gesondert zu spezifizieren und zu testen.

## Datenminimierung, Rollen und Aufbewahrung

Die Spec ist die einzige Quelle für Patientenfelder und Versionierungsregeln.
Die Versionsmarke ist privat und enthält nach einem Delete nur minimale
Identitäts-/Versionsmetadaten. Ihre Lebensdauer entspricht der synthetischen
Integration. Produktive Fristen, Backups und Betroffenenprozesse bleiben vor
Realbetrieb ausdrücklich abnahmebedürftig.

PROJ-4 führt keinen Patientenlese-RPC, keine UI und keine neue Auditaktion ein.
Technische Integrationsereignisse bleiben von Nutzer-Audit getrennt und behalten
ihre bestehende 30-Tage-Frist. Spätere Patientenlesefunktionen benötigen eigene
Fähigkeiten, RLS-/RPC-Prüfungen und Auditentscheidungen in PROJ-6.

Die Gruppenrolle und provisionierten Logins besitzen keinen Tabellenzugriff,
keinen BYPASSRLS, keine Rollenverwaltung, keine Datenbankverwaltung und keine
Ausführung nicht freigegebener Funktionen. Autorisierte lokale CLI-Administration
provisioniert ausschließlich synthetische Zugangsdaten; Betriebsprovisionierung
und Hosted-Rollen sind nicht Teil dieser Arbeit.

## Teststrategie und Verifikation

- Projektionstests: exakt erlaubte Felder, fehlende/überlange/ungültige Werte,
  erhaltene E.164-Nummern, kein email- oder Payloadfeld.
- Orchestratortests: initiale Seiten, Delta, leere Terminalseite, letzter
  Ereigniscursor, gemischter Feed, zyklische Seiten, Mengen-/Zeitgrenzen,
  Busy/Retry vor Quellabruf, abschließendes Aufräumen und neutrale Resultate.
- HTTP-Tests: echter bestehender Mock-PVS; Upserts, Tombstones, 429/503,
  invalid-source-data, Neustart-/Szenario-Cursor; getrennte Testziele.
- pgTAP: Praxis-FKs, Versionen, echte Gesamtatomarität bei spätem Konflikt,
  Checkpoint-CAS, Delete-Versionsmarke, kein Fortschreiben des Gesamtcursors,
  RLS und sämtliche nicht erteilten Tabellen-/Funktionsrechte.
- Echte DB-Verbindungstests: zwei unterschiedliche provisionierte LOGIN-Rollen,
  Fremdzuordnung, Entzug während HTTP, Integrationslock, Sessionabbruch und
  Wiederanlauf. `SET ROLE` allein beweist kein `session_user`-Scoping.
- CLI-Prozesstests: reale lokale Rolle, Pflichtbestätigung und Konfigurations-
  Ablehnung vor I/O, neutrale Ausgabe, Exitcodes und fehlende privilegierte Secrets.
- Abschluss: gezielte Prüfungen, vollständiges `npm run verify:full`,
  Secret-/Log-/Diff-Grenzprüfung, unabhängiger Review und dokumentierte Evidenz.

## Selbstprüfung und Umsetzung

Die Anforderungen AC01–AC15 sind den Testgruppen zugeordnet. Geplante Pfade,
Funktionen, Rollen und Datenstrukturen sind benannt. Es gibt keine produktiven
Credentials, Quellpayloadspeicherung, Scheduler- oder Terminimplementierung.
Quellcursor- und Snapshot-Limitierungen sind ausdrücklich ausgewiesen.

Die vollständige Spec und dieser Entwurf sind freigegeben. Der
[TDD-Umsetzungsplan](../plans/2026-09-14-proj-4-patient-sync.md) liegt vor.
Featurecode und Datenbankrollen werden erst bei seiner Ausführung implementiert.
