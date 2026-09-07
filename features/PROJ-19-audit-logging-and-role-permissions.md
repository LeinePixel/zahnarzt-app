# PROJ-19: Audit Logging & Rollenrechte

## Status: Implementiert — Hosted-Schema und synthetische Cloud-Abnahme verifiziert; Scheduler-Monitoring offen
**Created:** 2026-08-26
**Last Updated:** 2026-09-06
**Priority:** P0 (MVP)

## Zusammenfassung

PROJ-19 trennt Identität von Berechtigung, erzwingt eine zentrale Autorisierungsgrenze und führt ein datenminimiertes, mandantengebundenes Audit-Log ein. Praxisrollen erhalten keinen Audit-Zugriff. Ausschließlich getrennte `portaladmin`-Identitäten dürfen Audit-Ereignisse einer Praxis einsehen – und nur nach aktiver, widerrufbarer Praxisfreigabe für einen konkreten Supportfall.

Das Feature verarbeitet weiterhin ausschließlich synthetische Daten. Es öffnet weder das Real-Data-Gate noch einen allgemeinen Anbieter-Superuserzugang.

## Dependencies

- PROJ-1 (Supabase-Identität, `practice`, `user_profile`, verifizierte Server-Claims und RLS)

## User Stories

- Als **Praxisadmin** möchte ich einen zeitlich begrenzten Supportzugriff für meine eigene Praxis freigeben und widerrufen, damit ein Anbieterproblem nachvollziehbar untersucht werden kann.
- Als **Portaladmin** möchte ich innerhalb einer aktiven, freigegebenen Supportzeit Audit-Ereignisse genau einer Praxis einsehen, damit ich technische Probleme bearbeiten kann, ohne Fachinhalte oder Daten anderer Praxen zu sehen.
- Als **Sicherheitsverantwortliche** möchte ich, dass erlaubte und verweigerte sicherheitsrelevante Aktionen nachvollziehbar, aber ohne sensible Inhalte protokolliert werden.
- Als **Praxismitglied** möchte ich keine Auditdaten anderer Mitarbeitender oder anderer Praxen sehen, damit interne Kontrollinformationen geschützt bleiben.

## Umfang

### Rollen und Fähigkeiten

| Rolle | Freigegebene PROJ-19-Fähigkeit |
|---|---|
| `rezeption` | Keine Audit-Lesefähigkeit |
| `behandler` | Keine Audit-Lesefähigkeit |
| `praxisadmin` | Supportfreigabe ausschließlich für die eigene Praxis anlegen und widerrufen; keine Audit-Einsicht |
| `portaladmin` | Audit-Ereignisse ausschließlich während einer aktiven Supportfreigabe und nur für deren Praxis lesen |

`portaladmin` ist eine eigene Anbieteridentität und kein vierter `user_role`-Wert. Sie besitzt kein Praxisprofil und keine pauschale Praxisberechtigung.

### Verbindliche PROJ-31-Grenze (geplant)

PROJ-19 bleibt bis zur Umsetzung von PROJ-31 `In Review`. Für alle bestehenden
Praxisrollen und für `portaladmin` wird TOTP-MFA mit AAL2 erforderlich. Jede
Audit-Leseoperation, Supportfreigabe und sonstige geschützte PROJ-19-RPC muss
neben Rolle, Praxis- und Freigabeprüfung eine aktuelle server-/datenbankseitige
Sitzungsprüfung und AAL2 erzwingen. Für sensible Supportaktionen ist eine
frische Anmeldung von höchstens fünf Minuten erforderlich. UI-Zustand oder eine
offene Browserseite sind hierfür kein Nachweis.

Diese Anforderungen sind beschlossen, aber noch nicht implementiert. Sie
ersetzen weder die bestehende Supportfreigabe noch die Grenzen „kein Export“,
90-Tage-Auditlöschung und „kein Break-Glass“.

### Supportfreigabe

- Ein Praxisadmin kann nur für die eigene Praxis eine Supportfreigabe anlegen oder widerrufen.
- Ein Portaladmin aktiviert eine freigegebene Supportfreigabe mit einer strukturierten Kategorie; Freitext ist nicht Teil des MVP.
- Das Anlegen liefert eine undurchsichtige Freigabe-ID. Sie wird im bestehenden Supportfall an den Anbieter übermittelt; das Portal listet oder sucht Freigaben/Praxen nicht.
- Zugriff gilt standardmäßig acht Stunden ab Aktivierung; eine Praxisfreigabe darf höchstens 24 Stunden aktive Zugriffszeit geben. Eine nicht innerhalb von 24 Stunden aktivierte Freigabe verfällt und braucht eine neue Praxisfreigabe.
- Nach Ablauf oder Widerruf ist Audit-Lesen sofort untersagt. Eine Verlängerung benötigt eine neue Freigabe durch die Praxis.
- Ein Supportfall kann länger offen bleiben als seine Zugriffsfreigabe.

### Audit-Ereignisse

Jedes Ereignis enthält nur Akteurtyp/-kennung, Praxiskennung, kontrollierte Aktion, Objektart/-referenz, Ergebnis, Zeitpunkt und Korrelations-ID. Audit-Ereignisse enthalten niemals Freitext, medizinische oder sonstige Fachinhalte, Patientennamen, Request-/Response-Bodies, Tokens, Passwörter, Prompts, IP-Adressen oder Exportdaten.

Die Einsicht eines Portaladmins ist selbst ein Audit-Ereignis. Audit-Ereignisse können weder exportiert noch über die Anwendung geändert oder einzeln gelöscht werden. Eine begrenzte Datenbank-Wartungsroutine löscht Ereignisse nach 90 Tagen; sie ist für alle Anwendungsrollen unzugänglich.

### Autorisierung und Datenbank

- Serveraktionen und geschützte Komponenten verwenden einen zentralen Autorisierungsmodul; UI-Ausblendung allein ist nie eine Berechtigung.
- Jede neue Tabelle erhält RLS, explizite Least-Privilege-Grants und positive sowie negative Mandantentests.
- Auditpflichtige Mutationen und Audit-Lesezugriffe verwenden zweckgebundene, atomare Datenbankoperationen. Schlägt das Audit-Schreiben fehl, darf die Mutation oder Audit-Anzeige nicht erfolgreich sein. Verweigerte Aufrufe liefern ein neutrales verweigertes Ergebnis ohne Ereignisinhalte, damit ihr `denied`-Audit-Ereignis dauerhaft gespeichert wird; sie geben keinen SQL-Fehler mit Existenz- oder Berechtigungsdetails nach außen.

## Out of Scope

- Break-Glass- oder Notfallzugang
- Zugriff eines Portaladmins auf Patienten-, Behandlungs-, Termin-, Kommunikations- oder andere Fachinhalte
- Audit-Export oder Freitextsuche in Audit-Ereignissen
- Anbieter- oder Praxis-Benutzerverwaltung, Kontenentsperrung und Rollenpflege (PROJ-30)
- Externe Ticketing-Integration, dauerhaftes Anbieter-Backoffice und providerseitige Konfigurationsänderungen
- Konkrete Rechte für noch nicht spezifizierte künftige Fachfunktionen
- KI-Verarbeitung und eine EU-AI-Act-Einstufung; diese bleiben PROJ-15/16 vorbehalten
- Verarbeitung echter oder re-identifizierbarer Daten

## Acceptance Criteria

- [ ] Angenommen ich bin `rezeption`, `behandler` oder `praxisadmin`, wenn ich einen Audit-Leseweg aufrufe, dann sehe ich keine Audit-Ereignisse, die Datenbank führt keine Lesefunktion aus und der Versuch wird neutral verweigert sowie auditiert.
- [ ] Angenommen ich bin ein `praxisadmin`, wenn ich eine Supportfreigabe für meine Praxis anlege, dann kann sie ausschließlich dieser Praxis zugeordnet und jederzeit widerrufen werden.
- [ ] Angenommen ich bin ein `praxisadmin`, wenn ich eine Supportfreigabe für eine fremde Praxis anzulegen oder zu widerrufen versuche, dann wird die Aktion server- und datenbankseitig neutral verweigert und auditiert.
- [ ] Angenommen ich bin ein `portaladmin` ohne aktive Supportfreigabe, wenn ich Audit-Ereignisse aufrufe, dann wird der Zugriff neutral verweigert, auditiert und es werden keine Ereignisinhalte ausgeliefert.
- [ ] Angenommen ich bin ein `portaladmin` und habe eine Freigabe-ID im bestehenden Supportfall erhalten, wenn ich sie mit einer strukturierten Ursache aktiviere, dann wird nur diese Freigabe aktiviert; das Portal liefert keine Liste oder Suche offener Freigaben.
- [ ] Angenommen ich bin ein `portaladmin` mit aktiver Freigabe, wenn ich Audit-Ereignisse der freigegebenen Praxis aufrufe, dann erhalte ich ausschließlich deren datenminimierte Ereignisse und die Einsicht wird selbst protokolliert.
- [ ] Angenommen PROJ-31 ist umgesetzt und ich erfülle für eine geschützte PROJ-19-RPC nicht AAL2 oder die höchstens fünf Minuten alte Re-Authentisierung für eine sensible Supportaktion, dann verweigert die RLS-/RPC-Grenze den Zugriff unabhängig vom UI-Zustand.
- [ ] Angenommen ich bin ein `portaladmin` mit aktiver Freigabe für Praxis A, wenn ich Audit-Ereignisse von Praxis B aufrufe, dann wird der Zugriff neutral verweigert und auditiert.
- [ ] Angenommen eine Freigabe ist widerrufen oder abgelaufen, wenn ein Portaladmin anschließend Audit-Ereignisse abfragt, dann wird der Zugriff sofort neutral verweigert und auditiert.
- [ ] Angenommen eine neue Freigabe aktiviert wird, wenn keine Dauer angegeben ist, dann läuft sie acht Stunden nach Aktivierung ab; eine Laufzeit über 24 Stunden wird abgewiesen.
- [ ] Angenommen eine auditpflichtige Mutation oder Audit-Einsicht ausgeführt wird, wenn das Audit-Schreiben fehlschlägt, dann wird weder die Mutation ausgeführt noch die Auditansicht ausgeliefert.
- [ ] Angenommen ein Audit-Ereignis geschrieben wird, wenn Eingaben Freitext, medizinische Inhalte, Request-Bodies, Tokens, Passwörter, Prompts oder IP-Adressen enthalten, dann werden sie nicht gespeichert.
- [ ] Angenommen ein Anwendungsnutzer versucht, Audit-Ereignisse zu ändern, einzeln zu löschen oder zu exportieren, dann verweigert die Anwendung und die Datenbank die Aktion.
- [ ] Angenommen eine Audit-Einsicht erfolgt, wenn die Ereignisse älter als oder genau 90 Tage sind, dann entfernt die Wartungsroutine sie; jüngere Ereignisse bleiben unverändert.
- [ ] Angenommen die Wartungsroutine läuft, wenn sie Ereignisse einer Praxis löscht, dann kann sie keine neueren Ereignisse oder Ereignisse vor Ablauf der 90-Tage-Grenze entfernen.

## Edge Cases

- **Parallelzugriff beim Widerruf:** Widerruf zwischen Autorisierung und Anzeige darf keine Ereignisse ausliefern; die Datenbankoperation entscheidet atomar.
- **Ablauf während einer Sitzung:** Jede Audit-Abfrage prüft Ablaufzeit, AAL2 und server-/datenbankseitigen Sitzungszustand neu; eine offene Browserseite verlängert weder Freigabe noch Sitzung.
- **Doppelte Aktivierung:** Eine Freigabe kann nicht parallel von mehreren Portaladmins aktiviert werden.
- **Fehlende Anbieteridentität:** Ein Auth-Konto ohne Portaladmin-Zuordnung erhält keinen Fallback-Zugriff.
- **Unvollständiger Auditkontext:** Fehlen kontrollierte Pflichtwerte, schlägt die Operation sicher fehl statt ein teilweise aussagekräftiges Ereignis zu speichern.
- **Löschgrenze:** Ereignisse mit einem Zeitpunkt genau 90 Tage vor der Wartung werden gelöscht; jüngere Ereignisse nicht.
- **Ausfall der Datenbankroutine:** Es wird keine clientseitige Ersatzlöschung ausgelöst; der Fehler wird ohne Ereignisinhalte betrieblich behandelt.

## Datenschutz, Sicherheit und KI-Gates

- Zweck von Auditdaten ist Sicherheits-, Nachweis- und Supportkontrolle; sie sind personenbezogen, wenn Akteure zuordenbar sind.
- Die 90-Tage-Frist ist eine bestätigte MVP-Produktentscheidung. Vor echten Daten sind Zweck, Rechtsgrundlage, Art.-9-Kontext, Aufbewahrungs-/Löschweg, Backups, Wiederherstellung, Empfänger und DSFA-Schwelle im Real-Data-Gate fachkundig freizugeben.
- Anbieterzugriff ist auf Auditmetadaten begrenzt. Eine Auftragsverarbeiter-/Verantwortlichenbewertung, AVV, Subprozessor- und Transferprüfung bleiben vor echten Daten zwingend.
- PROJ-19 enthält keine KI-Funktion. AI-Act-Einstufung, KI-Kompetenz und medizinprodukterechtliche Prüfung werden nicht vorweggenommen und bleiben Gates für PROJ-15/16.
- Die verbindlichen Querschnittsanforderungen in `docs/architecture/privacy-security-ai-compliance.md` und die Quellenableitung in `docs/architecture/proj-19-regulatory-research.md` gelten ergänzend.

## Technical Design

Die detaillierte Architektur ist in [`docs/superpowers/specs/2026-08-26-proj-19-audit-and-authorization-design.md`](../docs/superpowers/specs/2026-08-26-proj-19-audit-and-authorization-design.md) festgehalten. Sie definiert eine zentrale Autorisierungsgrenze, getrennte Anbieteridentitäten, atomare Auditoperationen, RLS/Grants sowie Unit-, pgTAP- und Playwright-Nachweise. Die verbindlichen Begriffe stehen in `CONTEXT.md`; die Anbieterzugriffsentscheidung in ADR-0001.

## Abnahmeevidenz — 05.09.2026

Alle nachstehenden Daten sind ausschließlich lokal und synthetisch. Die
Verifikation auf dem aktuellen HEAD ergab:

- `npm run lint`: bestanden (Exit 0).
- `npm test`: bestanden, 17 Testdateien und 90 Tests.
- `npm run typecheck`: bestanden (Exit 0).
- `npm run build`: bestanden (Exit 0).
- Der benutzerdefinierte Rollback-only-Harness für historische Migrationen
  bestand mit 25/25 und 26/26.
- Nach einem ausschließlich lokalen `npx supabase db reset --local`:
  `npx supabase test db --local` bestanden, 3 Dateien und 108 pgTAP-Tests.
  Der Reset entfernt nur lokale Testdaten, damit vorangegangene E2E-
  Auditereignisse die globalen Zählassertionen nicht beeinflussen.
- Der Nutzer führte im selben Worktree in einer normalen, nicht erhöhten
  PowerShell mit `$env:E2E_PORT = '3135'` den Befehl
  `npm run test:e2e:edge-required` aus. Der Produktions-Build und alle 17
  Browser-Tests bestanden in 44,3 Sekunden: Chromium 13, Firefox 1, WebKit 1
  und Microsoft Edge 2, einschließlich des Audit-Zugriffsfalls.

Der zuvor ausschließlich in der Codex-Sandbox reproduzierbare Firefox-
Playwright-Laufzeitfehler ist damit umgebungsspezifisch; er ist kein
fehlgeschlagener Produkt- oder Browserabnahmenachweis. Die frische
Task-7-Sicherheitsprüfung fand keine neuen Critical- oder Important-Befunde:
SECURITY-DEFINER-Funktionen setzen einen leeren `search_path`, direkte
Anwendungsgrants auf Audit-/Freigabetabellen sind entzogen, RLS/RPC-Tests
prüfen fremde Praxen sowie Ablauf und Widerruf atomar, und das Auditmodell
beschränkt sich auf kontrollierte Metadaten ohne Freitext, medizinische
Inhalte, Bodies, Tokens, Passwörter, Prompts oder IP-Adressen.

Die vollständige Migrationskette ist am 06.09.2026 im gehosteten Zielprojekt
nachgewiesen; die PROJ-19-Migration richtet den täglichen Produktions-Scheduler
`dentpilot-purge-expired-audit-events` um 03:17 Uhr ein. Der synthetische
Seed und die 17/17 Cloud-Browserabnahme sind ebenfalls belegt. Offen bleiben
das laufende Scheduler-Monitoring und der Nachweis eines ausgeführten
Löschlaufs. Die beschlossenen MFA-/Re-Authentisierungsanforderungen aus
PROJ-31 sind noch nicht umgesetzt. Diese Evidenz ist ausdrücklich keine Real-Data-Gate-Freigabe; das
Real-Data-Gate bleibt geschlossen.

## Open Questions

- [ ] Das Scheduler-Monitoring und der Nachweis eines ausgeführten 90-Tage-Löschlaufs sind vor der Produktionsfreigabe festzulegen und zu dokumentieren.
- [ ] Die beschlossenen PROJ-31-Kontrollen (TOTP-MFA/AAL2, serverseitiger Sitzungszustand und Re-Authentisierung) müssen implementiert und nachgewiesen werden; ohne sie bleibt die Verarbeitung echter Daten gesperrt.
- [ ] Ein externer Ticketing-Prozess und die spätere Bearbeitung von Supportfällen mit Fachinhalten benötigen eine eigene Spezifikation und Anbieterprüfung.

## Decision Log

| Entscheidung | Begründung | Datum |
|---|---|---|
| Audit-Lesen ausschließlich durch zeitlich freigegebene Portaladmins | Praxisrollen sollen keine interne Kontrollrolle ausüben; Anbieterzugriff bleibt nachweisbar und begrenzt. | 2026-08-26 |
| Praxisfreigabe: acht Stunden standardmäßig, höchstens 24 Stunden | Ein Supportfall kann länger dauern, der direkte Zugriff verfällt aber regelmäßig und braucht erneut die Zustimmung der Praxis. | 2026-08-26 |
| Kein Export und keine Freitextsuche | Verringert Datenabfluss und verhindert, dass Inhaltsdaten in Audit- oder Suchprotokolle geraten. | 2026-08-26 |
| Automatische Löschung nach 90 Tagen | Bestätigte MVP-Produktentscheidung; vor echten Daten gegen konkrete Aufbewahrungspflichten prüfen. | 2026-08-26 |
| Kein Break-Glass im MVP | Keine klinisch kritischen Abläufe im synthetischen MVP; ein Notfallzugang braucht eine eigene Risikoentscheidung. | 2026-08-26 |
| Neutrales Ergebnis bei verweigerten PROJ-19-Aufrufen | Ein anschließender SQL-Fehler würde den verlangten `denied`-Audit-Eintrag zurückrollen. Eine neutrale Antwort bewahrt Mandantengeheimnis und Auditierbarkeit zugleich. | 2026-08-28 |
