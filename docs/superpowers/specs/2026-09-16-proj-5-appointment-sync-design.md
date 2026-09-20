# PROJ-5 Termin-Synchronisierung — Architekturentwurf

**Umsetzungsstatus:** Lokal implementiert und verifiziert, `In Review` seit 2026-09-20.

**Status:** Lokal implementiert und verifiziert; `In Review`
**Datum:** 2026-09-16
**Verbindliche Anforderungen:** [PROJ-5-Spec](../../../features/PROJ-5-appointment-synchronization.md)

## Gewählte Lösung

Ein eigener lokaler CLI-Ausführer liest Termine über den bestehenden
`IntegrationAdapter` und schreibt eine begrenzte, validierte Projektion über
private PostgreSQL-Funktionen. Seine DB-Identität gehört genau einer Integration.
Er verwendet denselben Session-Advisory-Lock wie PROJ-4, sodass Patienten- und
Terminsync nicht gleichzeitig dieselbe Integration verändern. Projektion,
Patientenauflösung, Versionsmarken, Termincheckpoint und technischer Erfolg
werden in einer atomaren Fachtransaktion geschrieben.

```text
lokale private Termin-CLI-Konfiguration
                 |
                 v
runAppointmentSync(adapter, repository)
          |                         |
          v                         v
PROJ-3 IntegrationAdapter      eigene PostgreSQL-Loginrolle
          |                         |
          v                         v
lokaler Mock-PVS         gemeinsame Integrationssperre
                                    |
                                    v
                         eine atomare Fachtransaktion
                         patient lookup / appointment
                         version / checkpoint / status
```

## Betrachtete Alternativen

| Ansatz | Bewertung |
|---|---|
| Eigenständiger Terminconsumer nach PROJ-4-Muster | Gewählt: klare fachliche und Berechtigungsgrenze, eigener Fortschritt, kleine kohärente Änderung. |
| PROJ-4 zu einem generischen Sync-Framework umbauen | Zurückgestellt: vergrößert Risiko und Reviewumfang ohne Bedarf für den Terminvertrag. |
| Patienten und Termine in einem kombinierten Lauf synchronisieren | Verworfen: koppelt Checkpoints und Fehlerdomänen und widerspricht der bereits zugesagten unabhängigen Feed-Verarbeitung. |

Eine eigene Termin-Sync-LOGIN-Rolle statt einer Erweiterung der Patientenrolle
hält die Berechtigungen prüfbar. `practitionerId` bleibt eine Quellreferenz, weil
weder PROJ-3 noch PROJ-5 einen belastbaren Practitioner-Stammdatenvertrag besitzen.

## Komponenten

| Geplanter Pfad | Verantwortung |
|---|---|
| `src/features/appointments/source-projection.ts` | Minimaler Terminvertrag, Feldprojektion und Terminmutationen. |
| `src/features/appointments/sync-appointments.ts` | Health, Vollstand, gemischter Feed, Paging-/Zeit-/Byte-Grenzen und neutrales Resultat. |
| `src/features/appointments/sync-repository.ts` | Port für Lock/Checkpoint, atomaren Commit und Fehlerstatus. |
| `src/features/appointments/postgres-sync-repository.ts` | Dedizierter `pg`-Client, gebundene Parameter und Sessionlebenszyklus. |
| `src/features/appointments/sync-config.ts` | Eigene lokale DB-/Mock-Konfiguration und synthetische Pflichtbestätigung. |
| `scripts/run-appointment-sync.ts` | Prozessstart, neutrale Ausgabe und Exitcodes; keine Fachlogik. |
| `.env.appointment-sync.local.example` | Namen und wertfreie Platzhalter ohne Zugangsdaten. |
| `supabase/migrations/20260916*_proj_5_appointment_sync.sql` | Projektion, private Zustände, RLS, Rolle, Funktionen und Indizes. |
| `supabase/tests/proj_5_appointment_sync.test.sql` | SQL-, Atomaritäts-, RLS-, Lock- und Privilegienprüfungen. |
| Co-located `*.test.ts` | Projektion, Orchestrator, echter Mock, echte DB-Logins und CLI-Prozess. |

Bestehende Adapter-, `pg`- und technische Statusabstraktionen werden verwendet.
PROJ-4-Code wird nur dort geteilt, wo bereits ein absichtlich gemeinsamer Vertrag
besteht; es entsteht keine neue allgemeine Sync-Engine.

## SQL-Einstiegspunkte und Rollenvertrag

Alle Funktionen liegen im privaten Schema, haben `search_path = ''` und leiten
Praxis und Integration aus `session_user` ab. Der Client hält genau eine dedizierte
Verbindung, damit der Sessionlock eindeutig bleibt.

### `private.acquire_appointment_sync()`

Prüft Terminrollenmitgliedschaft und feste Ausführungszuordnung. Sie lehnt eine
Session ab, die den gemeinsamen Lock bereits hält, und versucht anschließend
`pg_try_advisory_lock(20260914, hashtext(integration_id::text))`. Dieser Schlüssel
ist absichtlich identisch zu PROJ-4. Bei Erfolg liefert sie nur den Termincheckpoint
und notwendige private Laufmetadaten. Busy, Retry und fehlende Zuordnung sind
geschlossene neutrale Resultate.

### `private.commit_appointment_sync(expected_cursor, expected_initial_completed, snapshot, mutations, candidate_cursor)`

Die Funktion nimmt keine Praxis- oder Integrations-ID entgegen. `snapshot` enthält
projizierte Termine beim Erstlauf, `mutations` nur Termin-Upserts oder minimale
Delete-Identität und Version. Ereignis-ID, Ereigniscursor, Patientenpayload und
Rohantwort werden nicht gespeichert.

Innerhalb eines Exception-geschützten atomaren Blocks prüft die Funktion:

- aktuelle Rollen- und Ausführungszuordnung;
- gehaltenen gemeinsamen Integrationslock;
- Checkpoint per Compare-and-swap;
- Größen-, Feld-, Status-, Zeit- und Versionsvertrag;
- Auflösung jeder externen `patientId` über dieselbe Integration auf eine
  vorhandene Zeile in `public.patient`;
- Konsistenz aller Praxis-/Integrations-Fremdschlüssel.

Ein nicht auflösbarer Patient oder gleicher widersprüchlicher Versionsstand
ergibt ein neutrales `source_contract_invalid`; sämtliche vorherigen Mutationen
des Aufrufs rollen zurück. Erfolgsstatus und Termincheckpoint werden erst nach
allen Fachmutationen innerhalb derselben Transaktion geschrieben.

### `private.record_appointment_sync_failure(error_code, retry_at)`

Prüft Zuordnung und Lock erneut und akzeptiert nur die vorhandenen sechs PROJ-3-
Anbieterfehlerklassen sowie begrenzte Retry-Zeitpunkte. Sie darf nur den technischen
Status aktualisieren. Fachprojektion und Termincheckpoint bleiben unverändert.

Der Ausführer erhält ausschließlich EXECUTE auf diese drei Funktionen. Direkter
Tabellenzugriff sowie Patienten-Sync- und generische Statuswriter bleiben entzogen.

## Datenfluss und Fehleratomarität

Während der HTTP-Abrufe ist keine Datenbanktransaktion offen; der gemeinsame
Sessionlock bleibt jedoch bis zum Schließen des Repositories gehalten. Der Batch
im Speicher ist auf 10 MiB und insgesamt 100 Quellseiten begrenzt.

Beim ersten Lauf werden alle Seiten von `listAppointments()` und anschließend
der vollständige gemischte Änderungsfeed gesammelt. Folgeläufe lesen nur den
Feed ab dem eigenen bestätigten Termincheckpoint. Terminereignisse werden in
Quellreihenfolge projiziert. Patientenereignisse werden verworfen, aber ihr Cursor
kann Kandidat des Termincheckpoints werden. So überspringt kein unabhängiger
Consumer eine Position und keiner verändert den Checkpoint des anderen.

Die externe Patientenkennung bleibt bis zum Commit Teil der begrenzten Projektion.
Erst dort wird sie auf die interne UUID aufgelöst. Weil der gemeinsame Lock den
Patientensync ausschließt, kann PROJ-4 währenddessen keinen Patienten ändern oder
löschen. Andere administrative Löschungen werden durch Fremdschlüssel, Zeilensperren
und die atomare Prüfung abgefangen.

Fehler vor dem Commit erzeugen keine Fachmutation. Fehler während des Commits
rollen alle Termin- und Zustandsänderungen zurück. Ein anschließender technischer
Fehlerstatus ist kein Fachimport-Erfolg.

## Bootstrap, Cursor und Grenzen

Cursor bleiben undurchsichtige Strings und werden weder interpretiert noch aus
Zeit oder IDs rekonstruiert. Der bestätigte Kandidat ist der Cursor des letzten
tatsächlich gelesenen Ereignisses. Ein leerer Feed und `nextCursor: null` ändern
einen vorhandenen Checkpoint nicht.

Der aktuelle Mock liefert kein atomisches Snapshot-/Feed-Wasserzeichen und hält
Cursor nur im Prozess und Szenario. Die Abnahme verwendet deshalb unveränderte
deterministische Szenarien pro Lauf und isolierte synthetische Ziele. Ein ungültiger
Cursor stoppt neutral; PROJ-5 löscht keinen Checkpoint und startet keinen Vollimport
automatisch neu. Ein echter Herstellervertrag muss Snapshotkonsistenz und
Feed-Retention später ausdrücklich zusagen.

## Sicherheit, Datenschutz und Betrieb

`dentpilot_appointment_sync_executor` ist NOLOGIN, NOSUPERUSER, NOBYPASSRLS,
NOCREATEDB, NOCREATEROLE und NOREPLICATION. Die separat provisionierte LOGIN-Rolle
erhält nur Gruppenmitgliedschaft und eine feste private Zuordnung. Tabellen sind
per RLS geschlossen; Browser-, Portal-, Patienten-Sync- und öffentliche Rollen
erhalten weder Fachzugriff noch Termin-Sync-Funktionen.

Die CLI akzeptiert ausschließlich Loopback-URLs mit expliziten Ports, den eigenen
unprivilegierten Rollennamen und `APPOINTMENT_SYNC_SYNTHETIC_ONLY=1`. Sie lehnt
Service-Role-, Seed-, Admin- und Teststeuerungsvariablen vor jedem I/O ab. Gebundene
Parameter, neutrales Error-Mapping und deaktivierte Payload-/Statementlogs schützen
vor Inhaltsoffenlegung. Das lokale unverschlüsselte Loopback ist nur für synthetische
Entwicklung zugelassen.

Termindaten können im Realbetrieb Gesundheitsbezug offenbaren. PROJ-5 erteilt
keine Freigabe für echte Daten: DSGVO-Rechtsgrundlage, Herstellervertrag,
Verschlüsselung, Aufbewahrung, Backups, Betroffenenrechte, Hosted-Betrieb und
Datenschutz-Folgenprüfung bleiben eigene Gates. Es gibt keine KI-Verarbeitung;
EU-AI-Act-Gates bleiben unberührt.

## Teststrategie und Verifikation

- Projektionstests: exakt erlaubte Felder, Längengrenzen, Status, Zeitintervall,
  Patient-/Practitioner-Referenzen und keine Roh- oder Zusatzfelder.
- Orchestratortests: Erstlauf, Delta, Delete, gemischter Feed, leerer Feed,
  Endcursor, Paging-Zyklen, Seiten-/Byte-/Zeitgrenzen, Busy und Retry vor HTTP.
- HTTP-Tests: echter Mock-PVS für Vollstand, Changes, Deletions,
  `invalid-source-data`, 429/503 sowie Neustart-/Szenario-Cursor.
- pgTAP: atomare Patientenauflösung, Versionsregeln, Deletes, Checkpoint-CAS,
  Praxis-FKs, unveränderte fremde Checkpoints, RLS und Privilegien.
- Echte DB-Login-Tests: zwei Terminrollen, Fremdzuordnung, Entzug während HTTP,
  verweigerte direkte Rechte und verweigerte Patientenfunktionen.
- Konkurrenztests: Patientenrolle hält gemeinsamen Lock und Terminrolle erhält
  Busy sowie der umgekehrte Fall; nach Sessionabbruch ist der Lock wieder frei.
- CLI-Prozesstests: echte lokale Terminrolle, Konfigurationsablehnung vor I/O,
  neutrale Ausgabe, Exitcodes und keine privilegierten Secrets.
- Abschluss: gezielte Prüfungen, `npm run verify:full`, Diff-/Secret-/Log-Prüfung,
  unabhängiger Review und nur tatsächlich ausgeführte Evidenz.

## Umsetzung und Scope

Die Anforderungen AC01–AC14 sind den Testgruppen zugeordnet. Geplante Pfade,
Tabellen, Rollen, Funktionen und Grenzen sind benannt. Der Entwurf enthält keine
UI, Browserrechte, Scheduler, Practitioner-Entität, allgemeine Sync-Abstraktion,
echte Anbieteranbindung, Hosted-Migration, Deployment oder Real-Data-Freigabe.

Spec und Architektur sind fachlich freigegeben. Der detaillierte
[TDD-Umsetzungsplan](../plans/2026-09-16-proj-5-appointment-sync.md) liegt zur
Freigabe vor; Featurecode wird erst nach dessen Freigabe geschrieben.
