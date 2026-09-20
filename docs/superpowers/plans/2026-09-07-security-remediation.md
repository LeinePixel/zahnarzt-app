# DentPilot Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Die Ausführungsform ist erst beim Implementierungsauftrag festzulegen.

**Goal:** SEC-01 bis SEC-09 mit überprüfbaren technischen Korrekturen und Betriebsnachweisen schließen, ohne die bestehende Architektur oder das geschlossene Real-Data-Gate zu umgehen.

**Architecture:** Bestehende Auth-/Audit-Features verwenden zentrale Feature-Funktionen und Supabase-Clients. PostgreSQL bleibt für Tenant, Rolle, AAL, Sitzung und Supportfreigabe maßgeblich; Browser und Proxy ergänzen diese Grenze. Alle Schemaänderungen erfolgen vorwärtsmigrierend.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth/PostgreSQL/RLS, Zod, Vitest, pgTAP und Playwright; vorhandene npm-Skripte bleiben Ausgangspunkt.

**Spec:** [Anforderungs-/Entscheidungsentwurf](../specs/2026-09-07-security-remediation-design.md), [Audit](../../architecture/2026-09-06-security-audit.md), [PROJ-1](../../../features/PROJ-1-supabase-infrastructure-setup.md), [PROJ-19](../../../features/PROJ-19-audit-logging-and-role-permissions.md).

**Stand:** 07.09.2026. T00 ist technisch umgesetzt und mit `npm audit` ohne Befund geprüft. T01 ist mit der PROJ-31-Spec begonnen; T02 enthält die versionierten Verify-/Dependency-Audit-Workflows; T05 enthält CSP, Header und sichere Produktionscookies. Alle übrigen Implementierungs- und Betriebsnachweise bleiben offen. Dieser Plan erteilt keine Cloud-, Kosten- oder Echtdatenfreigabe.

## Global Constraints

- Ausschließlich synthetische Daten bis zur versionierten Real-Data-Freigabe.
- `portaladmin` bleibt von Praxisidentitäten getrennt; Praxisrollen lesen keine Auditdaten.
- Supportfreigaben: Standard acht Stunden, maximal 24 Stunden ab Aktivierung, Aktivierungsfenster 24 Stunden, Widerruf durch eigene Praxis.
- Historische Migrationen und historische Testergebnisse bleiben erhalten. Korrekturen verwenden neue Forward-Migrationen und neue Nachweise.
- Keine Service-Role-Zugriffe für normale App-Anfragen; keine Secrets in `.env.local`, Browser, Logs oder Testartefakten. Automationssecrets gehören in getrennte CLI-/CI-Konfiguration.
- Bestehende Arbeit im Checkout erhalten; vor Implementierung Status/HEAD prüfen und nötigenfalls isolierten Arbeitsbereich verwenden. Gezielte Commits nach abgeschlossenen Paketen, keine pauschalen `git add .`- oder Force-Updates.
- Neue Feature-Spec und Schnittstellenfreigabe gehen der abhängigen Implementierung voraus. T01 ist eine konkrete Entscheidungsaufgabe, kein stillschweigender Freibrief für Vorschlagswerte.

## Abdeckung, Zuständigkeit und Reihenfolge

| Finding | Arbeitspakete | Verantwortliche Rolle | Schließung |
|---|---|---|---|
| SEC-01 MFA/Re-Auth | T01, T03, T04 | Engineering + Security | AAL1 verweigert, passende AAL2-/Re-Auth-Fälle erlaubt, Wiederherstellung geprüft |
| SEC-02 Sitzung | T01, T03, T04 | Engineering + Praxis | Token-Replay/Sperre/Timeout direkt und über UI geprüft |
| SEC-03 Cookies/Browser | T05 | Engineering + Betrieb | tatsächliches HTTPS, Cookie-Erzeugung, CSP/Framing/CSRF geprüft |
| SEC-04 Missbrauch | T01, T06 | Engineering + Security | parallele und direkte RPC-Aufrufe begrenzt, Widerruf verfügbar |
| SEC-05 Aufbewahrung | T01, T08, T10 | Engineering + Datenschutz | Referenz-/Kontolöschung, Fristen und Restore geprüft |
| SEC-06 Widerruf | T07 | Engineering + Praxis | eigene Freigaben nach Reload sichtbar und widerrufbar |
| SEC-07 Betrieb/Datenschutz | T09–T12 | Betrieb + Verantwortliche | getrennte Betriebs-/Datenschutznachweise, explizite Freigabe |
| SEC-08 CI | T02, T12 | Engineering | geschützte verpflichtende Checks und Secret-Scan |
| SEC-09 Pakete | T00, T02 | Engineering | gemeldete Advisories beseitigt und Regression geprüft |

**Ablauf:** T00 sofort nach Implementierungsauftrag; T01 und T02 können unabhängig vorbereitet werden. T03 → T04; T05 nach D10; T06 nach D05/D06; T07 nach Freigabe der PROJ-19-Erweiterung; T08 nach D07. T09 nach T08 und D08; T10 nach D09 und T08. T11 kann dokumentarisch parallel beginnen. T12 erst nach allen nötigen technischen und betrieblichen Nachweisen. Betreibername, Budget und Rechtsentscheidungen werden nicht durch den Agenten erfunden.

## T00: Vier Paketbefunde gezielt beseitigen

**Files:** Modify `package.json` nur soweit kompatible Elternupdates nötig, `package-lock.json`; Evidence `docs/delivery/acceptance-tests.md` und `docs/delivery/known-issues.md`.

**Eingang:** SEC-09, aktueller Lockfile-Stand. **Ausgang:** installierter und gelockter Abhängigkeitsbaum ohne die fünf gemeldeten Advisories in vier Paketen.

- [ ] Baseline und aktuellen Advisory-Stand lesen; die Zustimmung zum npm-Abgleich ist bereits vorhanden. Keine erneute Freigabe für denselben unverändernden Abgleich anfragen.
- [ ] Kompatible Updates versuchen, ohne `--force` oder neue Anbieter:

```powershell
npm ls @humanfs/node browserslist fflate postcss-selector-parser --all
npm audit --json
npm update @humanfs/node browserslist fflate postcss-selector-parser
npm ls @humanfs/node browserslist fflate postcss-selector-parser --all
```

- [ ] Mindestens die im Audit geprüften Patchstände erreichen: `@humanfs/node` 0.16.8, Browserslist 4.28.7, fflate 0.8.3, postcss-selector-parser 6.1.3 im 6er-Zweig. Zum Ausführungszeitpunkt erneut gegen aktuelle Advisories prüfen. Bei Elternrestriktionen nur betroffene Eltern kompatibel aktualisieren und Diff begründen.
- [ ] `npm ci`, `npm audit --json`, `npm run verify` ausführen. Erwartung: gemeldete Advisories entfernt, reproduzierbare Installation, keine Regression. Neue unabhängige Befunde getrennt bewerten.
- [ ] Paketpfade, tatsächlich installierte Versionen, Befehle/Exitcodes dokumentieren; gezielten Dependency-Commit reviewen.

## T01: PROJ-31 und PROJ-19-Erweiterungen spezifikationsreif machen

**Files:** Create `features/PROJ-31-session-hardening.md`; Modify `features/PROJ-19-audit-logging-and-role-permissions.md`, `features/INDEX.md`, `docs/delivery/open-questions.md`, `docs/architecture/decisions.md`; neue Einzel-ADR nur für bestätigte schwer umkehrbare Entscheidungen.

**Eingang:** D01–D10 im Entwurf. **Ausgang:** vollständige Feature-Specs mit entschiedenen Parametern und freigegebener Architektur für T03–T08.

- [ ] D01–D10 einzeln mit Entscheidung, verantwortlicher Rolle, Datum und Begründung erfassen; nur abhängige Pakete auf die jeweilige Antwort warten lassen.
- [ ] PROJ-31: User Stories, AAL-/Recovery-Regeln, Timeoutsemantik, Hintergrund-/Offline-/Mehrtabverhalten, bereits laufende Anfragen und Fehlzustände vollständig spezifizieren.
- [ ] PROJ-19: eigene Freigabeliste, Quoten/Idempotenz, Auditaggregation und Referenz-/Aufbewahrungsmodell in einem ausdrücklich neuen Anforderungsabschnitt festlegen. Bestehende Rollen-/Supportgrenzen erhalten.
- [ ] Vollständige PROJ-31-Spec auf `Planned`, erst nach Architekturfreigabe auf `Architected` setzen. PROJ-1/19 bleiben `In Review`; ein Plan schließt kein Finding.
- [ ] Specs gegen den Audit und die zehn Entscheidungszeilen selbst prüfen; Schnittstellen der folgenden Pakete konkretisieren, bevor Schema-/Produktcode geschrieben wird.

## T02: Reproduzierbare Security-CI

**Files:** Create `.github/workflows/verify.yml`, `.github/workflows/security.yml`, `docs/production/ci-security.md`; Modify `package.json` nur für erforderliche reproduzierbare Checkbefehle; vorhandene Playwright-/Seed-Umgebungsgrenzen weiterverwenden.

**Eingang:** npm-Lockfile, lokale Tests. **Ausgang:** Checks ohne Produktionssecrets, mit dokumentierter Plattformabdeckung.

- [ ] Workflow mit read-only Repositoryrechten, `npm ci`, `npm run verify` und isoliertem synthetischem Supabase-Teststack planen; Actions und Scanwerkzeuge auf überprüfte Versionen/SHAs pinnen.
- [ ] Für `verify:full` Microsoft Edge verfügbar machen. Bestehende Edge-Erkennung ist Windows-spezifisch: entweder kompatiblen Runner bereitstellen oder plattformübergreifende Erkennung gezielt implementieren/testen. Einen Linux-Lauf ohne echten Edge nicht als vollständige Abnahme deklarieren.
- [ ] Secret-Scanner einschließlich abgestimmter Git-Historie ausführen; Ausgabe redigieren, keine Werte in Reports. Fundausnahmen eng begründen; ein echtes Secret erfordert Rotation und einen Vorfallentscheid.
- [ ] Negativprobe mit synthetischer Scanner-Testsignatur in einem isolierten Testbranch: Pipeline muss fehlschlagen; Probe vor Integration entfernen. Unvertrauenswürdige PRs dürfen keine Hosted-/Seed-/Upload-Secrets erhalten.
- [ ] Branch-Schutz/Required Checks separat im Repositorydienst prüfen und bei passender Beauftragung konfigurieren; lokale YAML-Dateien allein gelten nicht als aktive Durchsetzung.

## T03: Datenbankseitige Sitzungs- und AAL-Grenze

**Files:** Modify `src/features/auth/current-user.ts`, `src/features/authorization/policy.ts`, `supabase/config.toml`; Create `src/features/auth/session-policy.ts`, co-located Tests, `supabase/tests/session_authorization.test.sql`; neue Migration via `npx supabase migration new proj_31_session_authorization`.

**Eingang:** freigegebene D01–D04/PROJ-31. **Ausgang:** ein serverseitiger Sitzungsentscheid, den direkte Tabellenzugriffe und jede geschützte RPC ebenfalls erzwingen.

- [ ] Vor Umsetzung die installierte Supabase-API und Hosted-Fähigkeiten prüfen: Sitzungsfelder, Refresh-/Timeoutsemantik, AAL, Recovery und Tarif. Auth-Systemtabellen nicht eigenmächtig verändern.
- [ ] Failing pgTAP-Fälle schreiben: Rolle korrekt, aber AAL1; nicht vorhandene Sitzung; widerrufene Sitzung; Timeout exakt an Grenze; falsche Praxis; aktiver AAL2-Kontext. Geschützte Daten/Mutationen müssen in Negativfällen verweigert werden.
- [ ] Minimalen zentralen privaten Prüfpfad implementieren; aktuelle Sperrinformation statt ausschließlichem Vertrauen auf JWT-Laufzeit. Zusätzliche private Tabelle nur gemäß D04, mit RLS/Grants, Index, begrenzter Aufbewahrung und Negativtests. SECURITY-DEFINER-RPCs rufen die Prüfung explizit auf.
- [ ] Fail-closed bei fehlendem Zustand oder Prüffehler. Login, Faktorregistrierung und Recovery benötigen eng begrenzte Bootstrap-Wege ohne Zugriff auf Praxis-/Auditdaten; keine MFA-Einschleusung über diese Wege.
- [ ] `npx supabase test db --local`, fokussierte Vitest-Prüfung und `npm run verify:full`; neue Forward-Migration zusätzlich gegen bisherigen Schema-Stand testen. Lokaler Reset nur in einem ausdrücklich entbehrlichen Teststack.

**Beispiel für die Negativtest-Anforderung:**

```sql
-- In einer synthetischen Fixture mit Portalidentität, aktiver Freigabe und AAL1:
-- set_config verwendet nur simulierte Testclaims, keine echten Tokens.
select is(
  (select count(*) from public.read_audit_events(
    '96090000-0000-0000-0000-000000000003', now(), 100)),
  0::bigint,
  'AAL1 cannot read audit events despite an active grant'
);
```

Die Fixture erstellt Praxis, Identität und Freigabe innerhalb `BEGIN`/`ROLLBACK`; die Gegenprobe verwendet dieselbe Freigabe mit gültigem AAL2-/Sitzungszustand. Das Beispiel ersetzt keinen HTTP-Replay-Test.

## T04: MFA, Re-Authentisierung und Arbeitsplatzsperre

**Files:** Create `src/features/auth/mfa.ts`, `src/features/auth/session-activity.ts`, zugehörige Tests, `src/components/auth/session-lock.tsx`, `src/app/auth/mfa/page.tsx`, `src/app/auth/reauth/page.tsx`, `tests/session-security.spec.ts`; Modify geschützte Layouts/Seiten und bestehende Auth-Actions nach PROJ-31-Spec.

**Eingang:** Datenbankprüfung T03. **Ausgang:** bedienbarer MFA-/Sperrablauf mit unverändert maßgeblicher Datenautorisierung.

- [ ] Failing Tests für Einrichten/Bestätigen des Faktors, falschen/abgelaufenen Code, Recovery ohne Bypass und abgelaufene Re-Authentisierung schreiben; neutrale deutsche Fehler ohne Token-/QR-Secret-Ausgabe.
- [ ] Bestehende UI-Bausteine verwenden; sensible Zustände nur im notwendigen Arbeitsspeicher, keine persistenten Testmedien.
- [ ] Aktivität und Sperre nach freigegebener Semantik implementieren: Hintergrundrefresh ist keine menschliche Aktivität; Mehrtabverhalten, Offlinefall und Systemuhränderung explizit prüfen. Serverzeit entscheidet Berechtigung.
- [ ] Gestohlenes synthetisches Token vor Logout erfassen, danach direkte REST-/RPC-Aufrufe innerhalb/außerhalb der zugesagten Sperrfrist testen. UI-Redirect allein ist kein Erfolgskriterium.
- [ ] Browser-Neustart mit bestehendem Cookie prüfen: Sitzung darf innerhalb erlaubter Regeln wiederaufgenommen werden, aber niemals Inaktivitäts-/Maximalzeit umgehen. PROJ-1-Neustartkriterium entsprechend präzisieren.
- [ ] `npm run verify:full`; Safari-/Arbeitsplatz-Smoke als separate manuelle Evidenz dokumentieren.

## T05: Browser-, Cookie- und HTTPS-Härtung

**Files:** Modify `src/lib/supabase/client.ts`, `server.ts`, `proxy.ts`, `src/proxy.ts`, `next.config.ts`, zugehörige Tests, `tests/auth-security.spec.ts`, `docs/production/security-headers.md`.

**Eingang:** D10, unveränderte SSR-Architektur. **Ausgang:** echte sichere Cookies und passende Browserrichtlinien auf dem HTTPS-Ziel.

- [ ] Tests gegen tatsächliche Cookie-Erzeugung schreiben, nicht nur Weitergabe gemockter Flags. HTTPS-Cookies müssen `Secure` tragen; lokale HTTP-Entwicklung darf nur ausdrücklich lokal abweichen.
- [ ] CSP mit Nonces gemäß installierter Next.js-Dokumentation entwerfen und Hydration/Server Actions prüfen; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri` sowie erforderliche Verbindungen ausdrücklich festlegen. Keine pauschale Script-`unsafe-inline`-Freigabe.
- [ ] Report-Only zuerst auf synthetischem HTTPS-Ziel, Reports ohne URLs mit sensiblen Parametern/Bodies/Identitäten; anschließend CSP erzwingen. Framing, MIME, Referrer und benötigte Permissions-Policy testen.
- [ ] HSTS-Domainumfang/HTTPS-Redirects abnehmen; keine ungeprüfte Subdomain- oder Preload-Aktivierung. HttpOnly nur, wenn das abgestimmte Clientmodell funktioniert.
- [ ] Reale Login-/Logout-/MFA-/Supportflüsse einschließlich falschem Origin, Proxy-Headern und `private, no-store` prüfen; `npm run verify:full` und Hosted-Headernachweis.

## T06: Begrenzte Support-/Auditoperationen

**Files:** Modify `src/features/audit/support-access.ts`, `read-events.ts`, deren Tests und `supabase/tests/proj_19_audit_authorization.test.sql`; neue Migration via `npx supabase migration new proj_19_abuse_limits`; `docs/production/rate-limiting.md`.

**Eingang:** D05/D06 und freigegebene PROJ-19-Erweiterung. **Ausgang:** atomare Quoten/Idempotenz auch für direkten RPC-Zugriff.

- [ ] Failing Tests für Schwelle, Schwelle+1, Fensterwechsel und konkurrierende Aufrufe schreiben; Akteur/Practice ausschließlich aus verifiziertem DB-Kontext bestimmen.
- [ ] Begrenzung atomar innerhalb der autorisierenden Grenze implementieren; keine nur pro Next.js-Prozess geführten Zähler. Minimalen Speicher und Bereinigung gemäß Spec vorsehen.
- [ ] Wiederholte Freigabeanforderung mit demselben freigegebenen Idempotenzschlüssel darf nicht mehrere Freigaben erzeugen. Schlüssel hat keine fremde Praxiswirkung.
- [ ] Drosselungs-Audit nach D06 umsetzen; ein gedrosselter Aufruf darf keinen unbeschränkten eigenen Logstrom erzeugen. Audit-Schreibfehler bleiben für erlaubte Operationen fail-closed.
- [ ] Widerruf/Logout bei ausgeschöpfter Quote testen. Begrenzter Last-/Paralleltest ausschließlich auf isoliertem synthetischem Stack; Mengen und Abbruchgrenze vorher festlegen. `npm run verify:full`.

## T07: Eigene Freigaben zuverlässig widerrufen

**Files:** Modify `src/features/audit/support-access.ts`, `src/app/status/support-access-controls.tsx`, `page.tsx`, zugehörige Tests und `tests/audit-access.spec.ts`; neue Migration via `npx supabase migration new proj_19_own_grant_listing`.

**Eingang:** freigegebene eigene Freigabeliste; bestehende Rollen-/AAL-Grenze. **Ausgang:** begrenzte Liste eigener Freigaben mit Status, Aktivierung, Ablauf und Widerruf.

- [ ] Failing Tests: Praxisadmin A sieht eigene Freigaben nach Reload, Praxisadmin B und Praxisrollen ohne Verwaltungsrecht erhalten nichts. Portaladmins erhalten keine neue Listenfähigkeit.
- [ ] Zweckgebundene Listen-RPC ohne vom Nutzer wählbare Praxis implementieren; minimale Felder, explizites Limit/Paginierung, kein Auditinhalt und kein direkter Tabellen-SELECT-Grant.
- [ ] Statusseite lädt die Liste serverseitig und widerruft über bestehende autorisierte Aktion; mehrere Freigaben und eine andere berechtigte Praxisadministration derselben Praxis testen.
- [ ] Doppelte Widerrufe, abgelaufene Freigaben, Servicefehler und Refresh prüfen. `npm run verify:full` und Screen-Spec aktualisieren.

## T08: Aufbewahrung, Offboarding und referenzielle Löschung

**Files:** Create `docs/production/retention-and-offboarding.md`; Modify PROJ-19-Spec, `docs/architecture/data-model.md`, SQL-Tests; neue Migration via `npx supabase migration new proj_19_retention_offboarding`.

**Eingang:** D07, Kategorien-/Rechtsprüfung. **Ausgang:** nachvollziehbare Reihenfolge aus Sperre, Freigabeende, Aufbewahrung und zulässiger Löschung.

- [ ] Aufbewahrungsmatrix für Audit, Freigabe, Kontokontext, Auth-/Cron-Logs und Backups mit Fristbeginn, Ausnahmen, Zweck und Verantwortlicher erstellen. Rechtliche Fristen nicht aus Audit-90-Tagen ableiten.
- [ ] Failing SQL-Fälle: inaktive Freigabe vor/nach Frist, aktive Freigabe bleibt erhalten, Konto nach abgelaufenen Referenzen löschbar, Aufbewahrungsausnahme verhindert Löschung, fremde Praxis kann keine Löschung auslösen.
- [ ] Wartungsoperation gemäß freigegebenem Referenzmodell bauen; minimale Privilegien und bounded batches. Keine pauschale `ON DELETE CASCADE`-Änderung; keine historische Migration editieren.
- [ ] Offboarding entzieht Zugriff zuerst, unabhängig vom späteren Löschtermin. Kontolöschung ist keine normale Nutzer-RPC und keine Ausweitung auf PROJ-30-Benutzerverwaltung.
- [ ] Upgrade- und 90-Tage-Grenztests mit rein synthetischen Daten; `npm run verify:full`. Tatsächliche Rechts-/Backup-Ausnahmen im Runbook verlinken.

## T09: Schedulerüberwachung und Löschlaufnachweis

**Files:** Create `docs/production/audit-retention-operations.md`, `scripts/check-audit-retention.ts`, zugehörige Tests; neue Migration nur falls ein minimaler technischer Laufnachweis benötigt wird. Modify `docs/delivery/acceptance-tests.md`.

**Eingang:** T08/D08, Zielumgebung und vorhandener Cron. **Ausgang:** getrennte Lauf-, Wirkungs- und Alarmnachweise ohne Auditinhalt.

- [ ] Zuerst read-only Job-ID, Aktivstatus, Zeitzone und Laufhistorie im eindeutig bestimmten Ziel prüfen; kein neuer Job, falls der bestehende passt.

```sql
select jobid, jobname, schedule, active
from cron.job where jobname = 'dentpilot-purge-expired-audit-events';
select current_setting('cron.timezone', true);
select status, start_time, end_time
from cron.job_run_details
where jobid in (select jobid from cron.job
  where jobname = 'dentpilot-purge-expired-audit-events')
order by start_time desc limit 10;
```

- [ ] Synthetischen Wirkungstest mit Alt-/Grenz-/jungen Ereignissen isoliert durchführen; geplanten Hosted-Löschtest vor Ausführung hinsichtlich Ziel und Wirkung konkret abnehmen lassen. Ein `succeeded`/`SELECT 1`-Status ist keine Löschzahl.
- [ ] Checker-Ausgabe auf Jobkennung, Laufzeit, Status und aggregierte Kennzahlen beschränken. Fehler und Überfälligkeit nach D08 erkennen; synthetische Tests für nie gelaufen, erfolgreich, fehlgeschlagen und zu alt schreiben.
- [ ] Alarmempfänger, Kanal, Dienstbereitschaft und Eskalation benennen; Fehlalarmprobe zustellen und Empfang/Behebung belegen. Keine neue SaaS-Verbindung oder Nachricht ohne entsprechende Beauftragung.
- [ ] Aufbewahrung der Cron-/Monitorhistorie und Löschverzögerung dokumentieren. Bestehenden täglichen Job nicht durch unkontrollierte Paralleljobs ersetzen.

## T10: Wiederherstellung und Incident-Betrieb

**Files:** Create `docs/production/backup-restore.md`, `docs/production/incident-response.md`, `docs/production/administrative-access.md`; Modify `docs/production/error-tracking.md`.

**Eingang:** D09, reale Anbieter-/Tarifinformationen. **Ausgang:** nachgewiesene RPO/RTO, sichere Administration, getesteter Vorfallablauf.

- [ ] Tatsächliche DB-/PITR- und spätere Storage-Abdeckung, Regionen, Schlüssel, Rollen und Backupfristen erfassen. Anbieterfunktion und tatsächlich gebuchte/aktivierte Funktion unterscheiden.
- [ ] Synthetisches Backup in isoliertem Ziel wiederherstellen; Zeit/Datenverlust gegen D09 messen, fällige Löschungen erneut anwenden, Cross-Tenant- und Zugriffstests ausführen.
- [ ] Administrative MFA, minimal nötige Rechte, Notfallzuständigkeit, Secretrotation und Nachvollziehbarkeit von Administratoränderungen abnehmen; kein appseitiger Service-Role-Bypass.
- [ ] Tischübung zu Token-/Keyverlust und Datenabfluss: Erkennung, Eindämmung, Verantwortliche informieren, Risikobewertung, Meldeentscheidung/Fristen und Wiederanlauf dokumentieren. Keine echten Secrets als Testmaterial.
- [ ] Nur technische, minimierte Alarm-/Fehlerdaten zulassen. Ein installiertes Monitoring-SDK ist noch kein abgenommener Incident-Prozess.

## T11: Datenschutzakten und konkrete Real-Data-Grenze

**Files:** Create `docs/delivery/real-data-readiness.md`; Modify `docs/delivery/open-questions.md` und Compliance-Dokument. Vertragsakten nur in geeignetem zugriffsbeschränktem Ablageort; im Repository Referenzen und Status statt vertraulicher Inhalte.

**Eingang:** konkreter Pilotumfang und Datenflussinventar. **Ausgang:** fachkundig geprüfte Voraussetzungen, noch keine automatische Freigabe.

- [ ] Verantwortliche/Verarbeiter je Datenfluss, Zwecke, Art.-6-Grundlage und passende Art.-9-Ausnahme sowie Betroffenenrechte festhalten; Praxis-/Anbieterrolle nicht pauschal raten.
- [ ] DSFA nach Projektgate, AVV/Subprozessoren, Regionen/Transfers, Fristen und Informationspflichten prüfen lassen; Rechtsentscheidungen mit zuständiger Person und Evidenzreferenz dokumentieren.
- [ ] Für neue KI-Funktionen eigenen Zweck-/AI-Act-/Medizinprodukte-Check verlangen; heute keine KI-Klassifizierung für nicht implementierte Funktionen vortäuschen.
- [ ] Readiness-Matrix je Gate mit `offen`, `in Prüfung` oder `belegt`, Evidenzort, Umgebung, Version und Prüfer führen. Ein leeres Feld oder alter Nachweis wird nicht automatisch `belegt`.

## T12: Gesamtprüfung und Abschluss

**Files:** Modify `docs/delivery/acceptance-tests.md`, `known-issues.md`, `features/INDEX.md`, betroffene Feature-Specs, `HANDOFF.md`, `docs/handoff/manifest.yaml`, `SECURITY.md`, `ARCHITECTURE.md`; Create `docs/delivery/real-data-release.md` erst bei tatsächlicher Abnahme.

- [ ] Auf dem finalen Implementierungsstand `npm audit --json` und `npm run verify:full` ausführen; Hosted-/Safari-/Neustart-/Dienstunterbrechungsnachweise getrennt ergänzen. Fehlende Browser oder nicht ausgeführte Checks sind keine bestandenen Tests.
- [ ] Neue Angriffsfälle zusätzlich abnehmen: AAL1, Replay nach Logout/Sperre, direkte RPCs, fremde Praxis, Parallelquote, Widerruf nach Reload, Frist-/Referenzlöschung, Restore und Alarm.
- [ ] Sicherheitsreview und externen Pentest des tatsächlich deployten Umfangs durchführen lassen; Befunde bearbeiten und Retest belegen. Keine Behauptung absoluter Sicherheit.
- [ ] SEC-01 bis SEC-09 einzeln mit Korrekturcommit, Negativtest, Betriebsnachweis und Prüfer schließen; sonst offen lassen. Feature-Status nicht allein wegen grüner Unit-Tests hochstufen.
- [ ] Real-Data-Freigabe nur durch benannte Verantwortliche mit vollständiger Readiness-Matrix, Umgebung, Version, zulässigen Daten/Funktionen, Restrisiken und Datum dokumentieren. Bis dahin ausschließlich synthetische Daten.

## Planprüfung und Übergabe

Alle neun Findings haben Aufgaben und messbare Schließkriterien. Frühere PROJ-1/19-Pläne bleiben historische Umsetzungsevidenz; die Fortsetzungsroadmap verweist für aktuelle Sicherheitsarbeit hierher. Die technischen Details abhängiger neuer Schnittstellen werden in T01 freigegeben. Dieser Plan ist vollständig als Arbeitsfolge, aber kein Ersatz für noch offene Produkt-/Betriebs-/Rechtsentscheidungen.
