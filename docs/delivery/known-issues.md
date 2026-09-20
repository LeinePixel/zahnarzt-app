# Known Issues & Tech Debt

**Sicherheitsfortsetzung 07.09.2026:** Aktuelle Arbeitspakete und Abnahmekriterien stehen im [Security-Umsetzungsplan](../superpowers/plans/2026-09-07-security-remediation.md). SEC-09 ist mit dem aktuellen `npm audit` technisch behoben; SEC-01 bis SEC-08 bleiben bis zu ihren jeweiligen Nachweisen offen.

Stand 05.09.2026. PROJ-1 und PROJ-19 sind lokal verifiziert; PROJ-19 bleibt bis zur betrieblichen Freigabe `In Review`. Verbleibend sind bewusst aufgeschobene Punkte und betriebliche Risiken. Die Starter-Kit-Metadaten und ungenutzten Standard-Assets wurden bereinigt.

## Bewusst aufgeschoben

Der [Sicherheitsaudit vom 06.–07.09.2026](../architecture/2026-09-06-security-audit.md) konkretisiert die offenen Echtbetriebs-Gates und ergänzt SEC-01 bis SEC-09: MFA/Sitzungssperre, Cookie-/Browserschutz, RPC-Missbrauchsbegrenzung, Freigabeaufbewahrung/Kontolöschung, Widerrufsbedienung, Betrieb/Datenschutz, CI und vier betroffene transitive Entwicklungsabhängigkeiten. Diese Befunde sind offen; der Bericht enthält Belege und Abnahmekriterien.

Jeweils mit Begründung im Decision Log (`docs/architecture/decisions.md`).

| Punkt | Warum aufgeschoben | Nachzuholen mit |
|---|---|---|
| **Keine automatische Sitzungssperre/MFA** | Für rein synthetische Entwicklung vorübergehend akzeptiert | **PROJ-31/Auth-Hardening — Bestandteil des Real-Data-Gates** |
| Kein App-Grundgerüst | Hält PROJ-1 klein | PROJ-6 |
| Keine Benutzerverwaltung | Ein Entwickler, eine Testpraxis | PROJ-30 |
| Kein Passwort-Zurücksetzen | Im MVP über das Supabase-Dashboard | offen |
| Kein Löschkonzept, keine Aufbewahrungsregeln | Nur synthetische Daten | vor Pilotbetrieb |
| Kein Multi-Tenant-Betrieb | `practice_id` ist vorbereitet, wird aber nicht mehrmandantenfähig genutzt | PROJ-24 |
| Hosted-CSP-/HSTS-Nachweis | Nonce-CSP und Browserheader sind im Proxy implementiert; noch kein Produktions-Deployment | Deployment- und Real-Data-Gate |
| CI ohne Secret-Scanning/Branch-Protection | Verify- und Dependency-Audit-Workflows sind versioniert; Plattformdurchsetzung und Secret-Scan stehen aus | vor Teamarbeit oder Deployment |
| Scheduler-Monitoring für Auditlöschung | Die 90-Tage-Datenbankroutine ist im Zielbetrieb terminiert; laufende Überwachung und Nachweis eines Löschlaufs fehlen noch | vor PROJ-19-Produktivfreigabe |
| DSFA, AV-Verträge, Löschkonzept und Anbieterprüfungen fehlen | Noch keine echten Daten oder angebundenen Anbieter | Bestandteil des Real-Data-Gates vor Pilotbetrieb |
| AI-Act-/Medizinprodukte-Einstufung fehlt | KI-Features sind noch unspezifiziert | Pflicht vor PROJ-15/16 |

## Bekannte Projektrisiken

| Risiko | Bewertung |
|---|---|
| **Kein Dampsoft-API-Zugang** | Recherche bestätigt: kein deutscher PVS-Anbieter hat eine öffentlich zugängliche REST-API. Der Mock-PVS entschärft das für den MVP, aber der Produktivbetrieb hängt an einer Partnerschaft, die noch nicht angebahnt ist. |
| **Telefonanlage unbekannt** | Blockiert PROJ-29. Gleiche Strategie wie beim PVS: Entwicklung gegen einen generischen Webhook. |
| **Ein einzelner Entwickler** | Kein Ausfallschutz, keine Möglichkeit, Arbeit zu verteilen. Der Umfang jeder Aufgabe muss für eine Person tragbar bleiben. |
| **Nur 2 von 31 Features spezifiziert** | Der Planungsvorlauf ist dünn. Vor jedem Feature ist eine Spec nötig; wer das überspringt, baut auf Vermutungen. |
