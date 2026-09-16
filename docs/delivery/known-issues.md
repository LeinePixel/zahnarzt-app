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

## PROJ-3: offene Folgegates

Kein Scheduler und keine Runtime-Ausführungsidentität, keine Status-UI, kein
Patienten-/Terminimport und keine echte PVS-Anbindung. Die 30-Tage-Löschfunktion
ist implementiert; ihre betriebliche Ausführung ist nicht eingerichtet.
Hosted-Betrieb, Deployment und Real-Data-Gate sind nicht freigegeben.

Auf der freigegebenen Basis 3feed77 fehlen AGENTS.md, ARCHITECTURE.md, SECURITY.md
und DECISIONS.md; operative Nutzeranweisungen und vorhandene vertiefende
Architekturdokumente gelten weiter. Die fehlenden verify-Skripte wurden aus den
vorhandenen Lint-, Typecheck-, Test-, Build-, pgTAP- und Edge-Befehlen ergänzt.
Der pgTAP-Dateipfad wird als Positionsargument verwendet, da CLI 2.115.0 kein
`--file` unterstützt.

`npm ci` meldete am 14.09.2026 zehn bestehende Dependency-Audit-Funde
(1 low, 5 moderate, 3 high, 1 critical). Dependency-Upgrades gehören nicht zur
PROJ-3-Adapterumsetzung; Sicherheitsremediation und Betriebsfreigabe bleiben offen.

## PROJ-4: offene Folgegates

Der lokale Patientensync ist ausschließlich mit synthetischen Daten verifiziert.
Herstellervertrag und Bootstrap-Wasserzeichen, produktive Rollenprovisionierung,
Aufbewahrung und Backup-Löschung der Versionsmarken, Scheduler, UI, Hosting,
Deployment und Real-Data-Gate bleiben offen. Der Mock-PVS-Cursor wird bei Neustart
oder Szenariowechsel absichtlich ungültig; es gibt keinen automatischen Rebootstrap.
