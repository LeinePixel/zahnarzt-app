# Known Issues & Tech Debt

Stand 26.08.2026. PROJ-1 ist implementiert und automatisiert abgenommen; verbleibend sind Altlasten und bewusst aufgeschobene Punkte.

## Altlasten aus dem Starter-Kit-Template

| Punkt | Auswirkung | Zu erledigen mit |
|---|---|---|
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Ungenutzte Template-Assets | kann jederzeit aufgeräumt werden |
| `package.json` heißt `rl-coding-startup-kit` | Name und Beschreibung stammen vom Template, nicht vom Produkt | kann jederzeit angepasst werden |

## Bewusst aufgeschoben

Jeweils mit Begründung im Decision Log (`docs/architecture/decisions.md`).

| Punkt | Warum aufgeschoben | Nachzuholen mit |
|---|---|---|
| **Keine automatische Sitzungssperre/MFA** | Für rein synthetische Entwicklung vorübergehend akzeptiert | **PROJ-31/Auth-Hardening — Bestandteil des Real-Data-Gates** |
| Keine Rechtedurchsetzung | Rollen werden in PROJ-1 nur gespeichert und angezeigt | PROJ-19 |
| Kein Audit-Log | | PROJ-19 |
| Kein App-Grundgerüst | Hält PROJ-1 klein | PROJ-6 |
| Keine Benutzerverwaltung | Ein Entwickler, eine Testpraxis | PROJ-30 |
| Kein Passwort-Zurücksetzen | Im MVP über das Supabase-Dashboard | offen |
| Kein Löschkonzept, keine Aufbewahrungsregeln | Nur synthetische Daten | vor Pilotbetrieb |
| Kein Multi-Tenant-Betrieb | `practice_id` ist vorbereitet, wird aber nicht mehrmandantenfähig genutzt | PROJ-24 |
| DSFA, AV-Verträge, Löschkonzept und Anbieterprüfungen fehlen | Noch keine echten Daten oder angebundenen Anbieter | Bestandteil des Real-Data-Gates vor Pilotbetrieb |
| AI-Act-/Medizinprodukte-Einstufung fehlt | KI-Features sind noch unspezifiziert | Pflicht vor PROJ-15/16 |

## Bekannte Projektrisiken

| Risiko | Bewertung |
|---|---|
| **Kein Dampsoft-API-Zugang** | Recherche bestätigt: kein deutscher PVS-Anbieter hat eine öffentlich zugängliche REST-API. Der Mock-PVS entschärft das für den MVP, aber der Produktivbetrieb hängt an einer Partnerschaft, die noch nicht angebahnt ist. |
| **Telefonanlage unbekannt** | Blockiert PROJ-29. Gleiche Strategie wie beim PVS: Entwicklung gegen einen generischen Webhook. |
| **Ein einzelner Entwickler** | Kein Ausfallschutz, keine Möglichkeit, Arbeit zu verteilen. Der Umfang jeder Aufgabe muss für eine Person tragbar bleiben. |
| **Nur 1 von 31 Features spezifiziert** | Der Planungsvorlauf ist dünn. Vor jedem Feature ist eine Spec nötig; wer das überspringt, baut auf Vermutungen. |
