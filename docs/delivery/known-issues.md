# Known Issues & Tech Debt

Stand 05.09.2026. PROJ-1 und PROJ-19 sind lokal verifiziert; PROJ-19 bleibt bis zur betrieblichen Freigabe `In Review`. Verbleibend sind bewusst aufgeschobene Punkte und betriebliche Risiken. Die Starter-Kit-Metadaten und ungenutzten Standard-Assets wurden bereinigt.

## Bewusst aufgeschoben

Jeweils mit Begründung im Decision Log (`docs/architecture/decisions.md`).

| Punkt | Warum aufgeschoben | Nachzuholen mit |
|---|---|---|
| **Keine automatische Sitzungssperre/MFA** | Für rein synthetische Entwicklung vorübergehend akzeptiert | **PROJ-31/Auth-Hardening — Bestandteil des Real-Data-Gates** |
| Kein App-Grundgerüst | Hält PROJ-1 klein | PROJ-6 |
| Keine Benutzerverwaltung | Ein Entwickler, eine Testpraxis | PROJ-30 |
| Kein Passwort-Zurücksetzen | Im MVP über das Supabase-Dashboard | offen |
| Kein Löschkonzept, keine Aufbewahrungsregeln | Nur synthetische Daten | vor Pilotbetrieb |
| Kein Multi-Tenant-Betrieb | `practice_id` ist vorbereitet, wird aber nicht mehrmandantenfähig genutzt | PROJ-24 |
| Keine Security Header/CSP in `next.config.ts` | Noch kein Produktions-Deployment | Deployment- und Real-Data-Gate |
| Keine CI-Workflows | Kern- und Vollverifikation laufen derzeit nur lokal und werden nicht automatisch erzwungen | vor Teamarbeit oder Deployment |
| Hosted-Cron-Commissioning für Auditlöschung | Die 90-Tage-Datenbankroutine ist lokal geprüft, aber im Zielbetrieb noch nicht terminiert und überwacht | vor PROJ-19-Produktivfreigabe |
| DSFA, AV-Verträge, Löschkonzept und Anbieterprüfungen fehlen | Noch keine echten Daten oder angebundenen Anbieter | Bestandteil des Real-Data-Gates vor Pilotbetrieb |
| AI-Act-/Medizinprodukte-Einstufung fehlt | KI-Features sind noch unspezifiziert | Pflicht vor PROJ-15/16 |

## Bekannte Projektrisiken

| Risiko | Bewertung |
|---|---|
| **Kein Dampsoft-API-Zugang** | Recherche bestätigt: kein deutscher PVS-Anbieter hat eine öffentlich zugängliche REST-API. Der Mock-PVS entschärft das für den MVP, aber der Produktivbetrieb hängt an einer Partnerschaft, die noch nicht angebahnt ist. |
| **Telefonanlage unbekannt** | Blockiert PROJ-29. Gleiche Strategie wie beim PVS: Entwicklung gegen einen generischen Webhook. |
| **Ein einzelner Entwickler** | Kein Ausfallschutz, keine Möglichkeit, Arbeit zu verteilen. Der Umfang jeder Aufgabe muss für eine Person tragbar bleiben. |
| **Nur 1 von 31 Features spezifiziert** | Der Planungsvorlauf ist dünn. Vor jedem Feature ist eine Spec nötig; wer das überspringt, baut auf Vermutungen. |
