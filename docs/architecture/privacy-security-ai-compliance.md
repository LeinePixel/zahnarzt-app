# Privacy, Security & AI Compliance Architecture

**Stand:** 25.08.2026  
**Geltung:** verbindliche Querschnittsanforderung für alle Features

> Dieses Dokument übersetzt Datenschutz-, Sicherheits- und KI-Regulierungsanforderungen in Produkt- und Architekturregeln. Es ersetzt keine Rechtsberatung. Rechtsgrundlagen, Verträge, DSFA und regulatorische Einstufungen müssen vor dem Pilotbetrieb fachkundig freigegeben werden.

## Schutzbedarf und Grundsatz

DentPilot verarbeitet im späteren Betrieb Identitäts-, Termin-, Kommunikations-, Abrechnungs- und Gesundheitsinformationen. Gesundheitsdaten sind besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO. Zusätzlich werden Informationen aus PVS, Kommunikation und Transkripten zusammengeführt und teilweise durch KI ausgewertet. Für Architektur und Betrieb gilt deshalb **hoher bis sehr hoher Schutzbedarf**.

Das MVP nutzt ausschließlich synthetische Daten. Dies erlaubt Entwicklung ohne reale Betroffene, senkt aber nicht den geforderten Architekturstandard. Produktcode, Datenmodell, Logging und Integrationen müssen so entstehen, dass vor dem Pilotbetrieb keine grundlegende Sicherheitsmigration nötig wird.

## Verbindliches Real-Data-Gate

Echte oder re-identifizierbare Patienten- und Gesundheitsdaten dürfen erst verarbeitet werden, wenn alle folgenden Punkte dokumentiert und freigegeben sind:

- Rechtsgrundlage und Zweck jeder Verarbeitung sind festgelegt; Art.-9-Ausnahme und nationale Rechtsgrundlage sind fachkundig geprüft.
- Verantwortlichkeiten sind geklärt; notwendige Auftragsverarbeitungsverträge und Subprozessorlisten liegen vor.
- Datenstandorte und Drittlandtransfers aller Anbieter sind geprüft; falls erforderlich bestehen SCC, Transfer Impact Assessment und Zusatzmaßnahmen.
- Verzeichnis der Verarbeitungstätigkeiten und Datenschutzinformationen sind erstellt.
- Eine Datenschutz-Folgenabschätzung nach Art. 35 DSGVO wurde durchgeführt und Rest-Risiken wurden freigegeben.
- Lösch-, Aufbewahrungs-, Auskunfts-, Berichtigungs- und Exportprozesse sind implementiert und getestet.
- PROJ-19 (Rollenrechte und Audit-Logging) und PROJ-31 (Inaktivitätssperre) sind abgenommen.
- MFA, sichere Passwort- und Wiederherstellungsprozesse sowie erneute Authentisierung für kritische Aktionen sind aktiv.
- Mandantentrennung und RLS sind durch negative Cross-Tenant-Tests nachgewiesen.
- Verschlüsselung bei Transport, Speicherung und Backups sowie Schlüsselverwaltung sind dokumentiert.
- Backup-Wiederherstellung, Incident Response und Datenschutzverletzungsprozess wurden geprobt.
- Security Header, CSP, CSRF-Schutz, Rate-Limits, Dependency-/Secret-Scanning und externer Penetrationstest sind abgenommen.
- Demo-Konten und bekannte Demo-Zugangsdaten sind aus dem Zielsystem entfernt.

Die Freigabe wird als versioniertes Dokument protokolliert. Ein Umgebungsname wie `production` allein gilt nicht als Freigabe.

## Privacy by Design

Für jede Feature-Spec sind folgende Punkte Pflicht:

1. Zweck und Rechtsgrundlage der Verarbeitung.
2. Betroffene Personengruppen und Datenkategorien.
3. Minimal benötigte Felder; nicht benötigte PVS-Daten werden nicht synchronisiert.
4. Datenfluss einschließlich aller externen Empfänger und Subprozessoren.
5. Aufbewahrungsfrist und überprüfbarer Löschweg.
6. Rollen, erlaubte Aktionen und negative Berechtigungstests.
7. Audit-Ereignisse ohne medizinische Freitexte oder unnötige Inhaltsdaten.
8. Risiko für Vertraulichkeit, Integrität, Verfügbarkeit und Betroffenenrechte.
9. Prüfung, ob DSFA, Einwilligung, Transparenzhinweis oder erneute Rechtsprüfung nötig werden.

Verboten sind insbesondere:

- Patienten- oder Gesundheitsdaten in URL, Query-String, Browser-Storage oder unverschlüsseltem Cache.
- Personenbezogene Inhalte in allgemeinen Logs, Analytics, Session Replay, Fehlertracking oder Support-Screenshots.
- Service-Role-Keys, KI-Schlüssel oder andere Secrets in Client-Bundles oder Repository.
- Produktivdaten in Entwicklungs-, Test- oder Preview-Umgebungen.
- Datenexporte ohne Zweck, Berechtigung, Audit-Ereignis und Schutz gegen Massenabfluss.

## Sicherheitsarchitektur

### Identität und Sitzung

- Supabase Auth mit Cookie-basierter SSR-Sitzung; serverseitiger Schutz verwendet verifizierte Claims, nicht ungeprüfte Session-Daten.
- Sichere Cookie-Attribute, Schutz gegen CSRF, Session Fixation, Replay und Hijacking.
- Login-Rate-Limits und Supabase-Brute-Force-Schutz sind bereits für synthetische Umgebungen verbindlich.
- Vor echten Daten: MFA, definierte Inaktivitäts- und Maximaldauer sowie erneute Anmeldung für kritische Aktionen.
- Logout invalidiert die Sitzung; geschützte Antworten sind nicht im Browser oder CDN zwischenzuspeichern.

### Autorisierung und Mandantenisolation

- Authentifizierung und Autorisierung sind getrennte Kontrollen.
- Jede praxisbezogene Tabelle besitzt `practice_id`, RLS und einen Index auf den Isolationsspalten.
- Zugriff wird bei jeder Datenoperation geprüft; UI-Ausblendung oder Proxy allein sind keine Autorisierung.
- Für jede Tabelle existieren Positiv- und Negativtests für anonymen, fremden und berechtigten Zugriff.
- Der Service-Role-Key ist nur in expliziten serverseitigen Verwaltungsprozessen erlaubt und darf keine normalen Benutzeranfragen bedienen.

### Daten und Protokollierung

- TLS ist auf jedem Übertragungsweg erforderlich; kein Fallback auf unverschlüsselte Verbindungen.
- Verschlüsselung von Datenbank, Storage und Backups wird je Anbieter vertraglich und technisch verifiziert.
- Zusätzliche Feldverschlüsselung beziehungsweise Pseudonymisierung wird je Datenklasse und Suchanforderung entschieden; Schlüssel werden getrennt verwaltet.
- Audit-Logs enthalten Akteur, Praxis, Aktion, Objektart, Objekt-ID, Ergebnis und Zeit, aber keine medizinischen Freitexte.
- Sicherheitslogs, Audit-Logs und fachliche Kommunikationshistorie sind getrennte Datenbestände mit getrennten Fristen.

### Betrieb und Lieferkette

- Restriktive CSP, HSTS, `X-Content-Type-Options`, Frame-Schutz, restriktive Referrer- und Permissions-Policy.
- Abhängigkeiten und Secrets werden automatisiert geprüft; Sicherheitsupdates erhalten priorisierte Fristen.
- Backups sind verschlüsselt; Restore-Tests und dokumentierte Wiederanlaufziele sind Pflicht.
- Sicherheitsvorfälle besitzen Melde-, Eindämmungs-, Beweissicherungs- und Wiederherstellungsabläufe. Die 72-Stunden-Frist aus Art. 33 DSGVO wird organisatorisch berücksichtigt.

## Externe Anbieter

Vor Anbindung von Supabase, Vercel, Soniox, IONOS AI Model Hub, Resend, Sentry oder weiteren Diensten wird eine Anbieterakte angelegt mit:

- Rolle im Datenfluss und verarbeitete Datenkategorien,
- Region und tatsächlichen Speicher-/Supportzugriffsorten,
- AV-Vertrag, Subprozessoren und Transfermechanismus,
- Aufbewahrung, Löschung, Backup und Exit-/Exportverfahren,
- Verschlüsselung und Schlüsselverantwortung,
- Nutzung der Kundendaten zu Training oder Produktverbesserung,
- Incident-Meldepflichten und Nachweisen/Zertifizierungen.

Ohne abgeschlossene Anbieterprüfung dürfen nur synthetische Daten übertragen werden.

## EU AI Act und KI-Governance

Für PROJ-15, PROJ-16, PROJ-22 und PROJ-25 gelten zusätzlich:

- Beabsichtigter Zweck, Anbieter-/Betreiberrolle und AI-Act-Einstufung werden vor Implementierung dokumentiert.
- Eine mögliche Einstufung als Medizinprodukt oder sicherheitsrelevante Komponente wird fachkundig geprüft. Der bloße Einsatz im Gesundheitsbereich entscheidet die Einstufung nicht.
- KI extrahiert oder bereitet vor; medizinische, abrechnungsrelevante oder sonst wesentlich wirkende Entscheidungen bleiben bei qualifizierten Menschen.
- Kein ausschließlich automatisiertes Profiling und keine Entscheidung mit rechtlicher oder ähnlich erheblicher Wirkung.
- Nutzer erkennen KI-Ausgaben, deren Zweck, Grenzen und erforderliche Prüfung. Seit 02.08.2026 geltende Transparenzpflichten werden je Funktion geprüft.
- Eingaben werden minimiert und möglichst pseudonymisiert. Externe Anbieter dürfen Inhalte nicht zum Training verwenden, sofern dies nicht ausdrücklich freigegeben ist.
- Modelle, Prompts, Schemata und Freigaberegeln werden versioniert; relevante Ausgaben sind nachvollziehbar, ohne unnötig sensible Prompts zu protokollieren.
- Qualitäts-, Robustheits-, Halluzinations-, Bias- und Sicherheitsprüfungen sind Teil der Abnahme.
- Nutzer können Ergebnisse verwerfen, korrigieren und melden; es existieren Abschalt- und Rückfallverfahren.
- Betreiber und Nutzer erhalten aufgabengerechte KI-Kompetenzschulung.

Vor PROJ-15 wird ein eigener AI-Impact-Check abgenommen. Vor echten Daten wird die Einstufung erneut anhand des tatsächlichen vorgesehenen Zwecks geprüft.

## Definition of Done für jedes Feature

Ein Feature mit personenbezogenen oder sicherheitsrelevanten Daten ist erst abnahmefähig, wenn:

- Dateninventar, Zweck, Empfänger und Frist dokumentiert sind,
- serverseitige Validierung und Berechtigungsprüfung existieren,
- RLS-/Cross-Tenant- und Missbrauchstests bestanden sind,
- Logs und Fehlerpfade auf Datenabfluss geprüft wurden,
- Löschung und Auditierbarkeit getestet sind,
- neue Anbieter, Variablen und Subprozessoren dokumentiert sind,
- bei KI-Funktionen zusätzlich Human Oversight, Transparenz und Qualitätsgrenzen getestet sind.

## Primärquellen

- DSGVO: Verordnung (EU) 2016/679, insbesondere Art. 5, 9, 25, 28, 30, 32–35.
- EU AI Act: Verordnung (EU) 2024/1689, insbesondere Art. 4, 6, 9–15, 26 und 50.
- BSI: Anforderungen an Webanwendungen und TR-03161 als Sicherheitsorientierung für Anwendungen mit sensiblen Gesundheitsdaten.

