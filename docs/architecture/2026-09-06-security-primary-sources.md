# Sicherheitsprüfung: Primärquellen und Freigabegrenzen

Stand und Abrufdatum: 06.09.2026. Ergänzung zum technischen Audit; keine Zertifizierung, Rechtsberatung oder Real-Data-Freigabe. Recherchiert wurden ausschließlich Primärquellen. Die Hosted-Konfiguration wurde in dieser Recherche nicht abgefragt. Lokale Einordnung: `SECURITY.md`, `privacy-security-ai-compliance.md`, PROJ-1/19-Specs und `docs/delivery/acceptance-tests.md`.

## Datenschutz: gesetzliche Anforderungen und Projektregeln

Art. 5 verlangt unter anderem Zweckbindung, Datenminimierung, Speicherbegrenzung und Nachweisbarkeit. Jede Verarbeitung benötigt eine Grundlage nach Art. 6; Gesundheitsdaten zusätzlich einen passenden Art.-9-Ausnahmetatbestand. Art. 25 betrifft Datenschutz durch Gestaltung und Voreinstellungen. Art. 28 verlangt bei Auftragsverarbeitung einen entsprechenden Vertrag und geregelte Unterauftragsverarbeitung. Art. 32 fordert risikogerechte technische und organisatorische Maßnahmen, Wiederherstellbarkeit und regelmäßige Wirksamkeitsprüfung. Art. 33 sieht grundsätzlich eine Meldung an die Aufsicht binnen 72 Stunden nach Bekanntwerden vor, außer wenn voraussichtlich kein Risiko besteht; Auftragsverarbeiter informieren Verantwortliche unverzüglich. Art. 35 knüpft die DSFA an voraussichtlich hohes Risiko. Die Verordnung schreibt nicht pauschal jeder App MFA oder einen externen Pentest als benannte Einzelmaßnahme vor. [DSGVO, Art. 5, 6, 9, 25, 28, 32, 33, 35](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04?locale=de).

Eine DSFA muss vor einer voraussichtlich hochriskanten Verarbeitung erfolgen. Bleibt trotz Maßnahmen ein nicht hinreichend reduziertes hohes Risiko, ist vor Beginn die Aufsichtsbehörde zu konsultieren. [EDPB: Datenschutz-Folgenabschätzung](https://www.edpb.europa.eu/topics/accountability-and-compliance-tools/data-protection-impact-assessment_en).

Bei Drittlandübermittlungen müssen die Voraussetzungen des Kapitels V erfüllt sein, etwa ein anwendbarer Angemessenheitsbeschluss oder geeignete Garantien. Bei Garantien kann eine Prüfung des Drittlandrechts mit zusätzlichen Maßnahmen erforderlich sein. Eine EU-Datenbankregion beantwortet die Frage nach Zugriffen anderer Anbieter- oder Supportstandorte daher nicht allein. [EDPB: Internationale Datenübermittlungen](https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en).

**Einordnung für DentPilot:** Das vorhandene Real-Data-Gate verlangt ausdrücklich DSFA, MFA, Re-Authentisierung und externen Pentest. Diese strengeren Projektkriterien bleiben verbindlich. Sie sind vor echten Daten anhand des tatsächlichen Funktionsumfangs zu erfüllen und fachkundig zu bewerten. Die bestehende 90-Tage-Auditfrist ist laut PROJ-19 eine Produktentscheidung, keine allgemeine gesetzliche Löschfrist für Patientenakten. Re-identifizierbare beziehungsweise pseudonymisierte Daten bleiben vom Projektgate umfasst.

## Authentifizierung: Claims sind keine sofortige Sitzungssperre

Supabase beschreibt `getClaims()` als Prüfung der JWT-Signatur und des Ablaufs; der SSR-Leitfaden unterscheidet dies ausdrücklich von einer aktuellen Prüfung beim Auth-Server. Browserlesbare Auth-Cookies sind Bestandteil des vorgesehenen SSR-Modells. Ihr fehlendes `HttpOnly` allein beweist deshalb keine Implementierungslücke; XSS-Schutz und die tatsächlichen Cookie-Attribute müssen zusammen geprüft werden. Authentifizierte beziehungsweise Cookies setzende Antworten dürfen nicht gemeinsam gecacht werden. [Supabase SSR Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

Supabase-Sitzungen sind standardmäßig zeitlich unbegrenzt. Konfigurierte Maximaldauer und Inaktivität werden beim Refresh geprüft; die JWT-Laufzeit beeinflusst die effektive Verzögerung. Ein ausgegebenes JWT kann nach Logout bis zum Ablauf nutzbar bleiben. Für eine sofortige Prüfung nennt Supabase den Abgleich der JWT-`session_id` mit `auth.sessions`. Das ist gesondert von Timeoutprüfungen zu betrachten, weil zeitlich abgelaufene Sitzungszeilen verzögert entfernt werden können. [Supabase Sessions](https://supabase.com/docs/guides/auth/sessions).

MFA wird mit dem JWT-Claim `aal2` an der Datenzugriffsgrenze durchgesetzt, beispielsweise durch restriktive RLS-Policies. Eine MFA-Oberfläche allein verhindert keinen direkten Datenbankzugriff mit einem lediglich per Passwort authentifizierten JWT. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa).

**Prüfauftrag für DentPilot:** PROJ-31 muss definieren, wie schnell Logout, Kontosperre und Arbeitsplatz-Inaktivität Zugriffe tatsächlich verhindern. Direkte REST-/RPC-Zugriffe sind dabei ebenso zu testen wie Seiten und Server Actions. Bei `SECURITY DEFINER`-RPCs ist die AAL-/Sitzungsanforderung ausdrücklich innerhalb der autorisierenden Grenze zu prüfen. Ein pauschaler Austausch von `getClaims()` löst diese gesamte Anforderung nicht. Diese Recherche behauptet weder einen bereits erfolgreichen Angriff noch ein getestetes Supabase-Liveverhalten.

## Scheduler-Monitoring und Löschlaufnachweis

Supabase Cron legt Jobs in `cron.job` und Ausführungen samt Status in `cron.job_run_details` ab; SQL und Dashboard können beide zur Prüfung verwendet werden. [Supabase Cron](https://supabase.com/docs/guides/cron).

Die pg_cron-Dokumentation zeigt für einen erfolgreichen Funktionsaufruf über `SELECT` den Rückgabetext `SELECT 1`. Das beschreibt nicht die Zahl gelöschter Auditereignisse. Die Laufhistorie wird durch pg_cron nicht automatisch bereinigt; Jobbenutzer dürfen ihre eigenen Historieneinträge löschen. Sie ist daher kein manipulationssicherer Langzeitnachweis. Die Scheduler-Zeitzone ist konfigurierbar und standardmäßig GMT. [pg_cron: Monitoring und Konfiguration](https://github.com/citusdata/pg_cron).

**Im Repository dokumentierter Stand:** Der Job `dentpilot-purge-expired-audit-events` wurde mit der Hosted-Migration eingerichtet; angegeben ist täglich 03:17. Ein belegter Lauf und laufende Überwachung sind als offen markiert. Diese Dokumentation wurde gelesen, der Cloud-Zustand hier nicht neu verifiziert. 03:17 darf ohne Prüfung von `cron.timezone` nicht als deutsche Ortszeit kommuniziert werden.

**Empfohlene konkrete Abnahme:**

1. Zielumgebung, Job-ID, Aktivstatus, Zeitplan, tatsächliche Zeitzone und Routinen-/Migrationsversion dokumentieren.
2. Einen tatsächlichen Schedulerlauf mit Start, Ende und Erfolg belegen. Auch ein Lauf mit null fälligen Ereignissen ist ein gültiger Ausführungsnachweis.
3. Separat die Löschwirkung mit ausschließlich synthetischen Alt-, Grenz- und jüngeren Kontrollereignissen nachweisen: fällige entfernt, jüngere erhalten, keine unzulässigen Mandanten- oder Berechtigungseffekte. Ein grüner Laufstatus allein belegt das nicht.
4. Überfällige oder fehlgeschlagene Läufe und lange Laufzeiten erkennen; Alarmempfänger, Reaktionszeit und Eskalation festlegen. Alarme enthalten nur technische Kennzahlen, keine Audit- oder Gesundheitsinhalte. Historienaufbewahrung festlegen und einen Fehleralarm testen.

Ein täglicher Lauf bedeutet zudem ein zeitliches Intervall zwischen Erreichen der Altersgrenze und tatsächlicher Entfernung. Die zulässige Verzögerung und das Verhalten nach einem Ausfall gehören ausdrücklich in die Löschabnahme. Diese Schritte sind Vorschläge für Betrieb und Abnahme, keine bereits eingerichtete Überwachung.

## Backups und Löschung

Supabase-Datenbankbackups enthalten keine über die Storage API gespeicherten Objekte, sondern deren Datenbankmetadaten. Backup- und PITR-Verfügbarkeit beziehungsweise Aufbewahrung hängen von Konfiguration und Tarif ab. [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).

**Ableitung für DentPilot:** Ein SQL-Löschlauf ist kein Nachweis einer Entfernung aus vorhandenen Backups, Exporten oder zukünftigen Integrationen. Ein abgenommenes Konzept muss deren Fristen, Zugriffsbeschränkung und das erneute Anwenden fälliger Löschungen nach Restore regeln. RPO/RTO und ein Wiederherstellungstest benötigen eigene Nachweise. Diese Recherche bestätigt keine aktivierten Backups oder PITR im Zielprojekt.

## Wer muss was freigeben?

Die Projektregel verlangt eine versionierte Real-Data-Freigabe. Empfohlen wird ein benannter Freigabeverantwortlicher auf Betreiber-/Verantwortlichenseite, mit technischer Betriebs-/Security-Abnahme und fachkundiger Datenschutzprüfung. Ein gegebenenfalls bestellter Datenschutzbeauftragter berät und überwacht; die Verantwortung wird nicht durch seine Beteiligung auf ihn oder auf einen Coding-Agenten verlagert. Die datenschutzrechtliche Verantwortlichkeit liegt nach Art. 24 beim Verantwortlichen. [DSGVO, Art. 24 und 39](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04?locale=de).

Für die angefragte Sicherheitsprüfung und die Erklärung dieser offenen Punkte ist keine erneute Nutzerfreigabe erforderlich. Vor einer konkreten Cloud-Änderung, einem gezielten Löschtest im Hosted-System oder einer kostenpflichtigen Betriebsmaßnahme sind Ziel und Wirkung reviewbar vorzubereiten und die vorhandene Autorisierung zu prüfen. Die Auditbeauftragung allein gibt weder einen destruktiven Cloud-Löschlauf noch die Verarbeitung echter Gesundheitsdaten frei. Eine Real-Data-Freigabe kann erst nach Erfüllung und dokumentierter Abnahme aller Projektkriterien erfolgen; ein einfaches „Ja“ ersetzt fehlende Evidenz nicht.
