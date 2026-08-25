# Scope & Priorities

_Quelle: `docs/PRD.md` und `features/INDEX.md` (Stand 24.08.2026). `features/INDEX.md` bleibt maßgeblich für den aktuellen Status._

## Status-Realität — wichtig für Codex

**Nur PROJ-1 hat eine vollständige Spezifikation und einen technischen Entwurf.** Alle übrigen 30 Features stehen auf *Roadmap*: Sie sind benannt, priorisiert und mit Abhängigkeiten versehen, haben aber **keine User Stories und keine Akzeptanzkriterien**.

Das ist kein Versäumnis dieses Handoffs, sondern der bewusste Arbeitsstand: Spezifiziert wird Feature für Feature kurz vor der Umsetzung. **Codex sollte für Roadmap-Features keinen Code schreiben**, ohne dass vorher eine Spec entsteht.

## Must-have — MVP (P0)

Reihenfolge = empfohlene Baureihenfolge aus `features/INDEX.md`.

| # | ID | Feature | Status |
|---|---|---|---|
| 1 | PROJ-1 | Supabase Infrastructure Setup (inkl. Login) | **Architected** |
| 2 | PROJ-19 | Audit Logging & Rollenrechte | Roadmap |
| 3 | PROJ-2 | Mock-PVS-Service | Roadmap |
| 4 | PROJ-3 | Integration-Adapter-Schicht | Roadmap |
| 5 | PROJ-4 | Patienten-Synchronisierung | Roadmap |
| 6 | PROJ-5 | Termin-Synchronisierung | Roadmap |
| 7 | PROJ-6 | Patientenübersicht & Profil (360°) | Roadmap |
| 8 | PROJ-7 | Terminübersicht | Roadmap |
| 9 | PROJ-9 | CRM / Nachfassaktionen | Roadmap |
| 10 | PROJ-11 | Kommunikations-Templates-Editor | Roadmap |
| 11 | PROJ-12 | E-Mail-Versand-Integration (Resend) | Roadmap |
| 12 | PROJ-10 | Regel-Engine (Trigger → Bedingung → Aktion) | Roadmap |
| 13 | PROJ-13 | Kommunikationsautomatisierung | Roadmap |
| 14 | PROJ-14 | Transkript-Integration (Soniox) | Roadmap |
| 15 | PROJ-15 | KI-Informationsextraktion (IONOS AI Model Hub) | Roadmap |
| 16 | PROJ-16 | Automatischer Kostenvoranschlagsentwurf | Roadmap |
| 17 | PROJ-17 | Patientenkennzahlen | Roadmap |
| 18 | PROJ-8 | Patienten-Timeline | Roadmap |
| 19 | PROJ-18 | Dashboard | Roadmap |

**Hinweis zu PROJ-19:** bewusst früh in der Reihenfolge — Rechte und Audit-Log nachträglich einzuziehen ist deutlich teurer.

## Should-have (P1)

| ID | Feature | Anmerkung |
|---|---|---|
| PROJ-20 | Analytics | |
| PROJ-21 | Erweitertes Patientenrating | |
| PROJ-22 | Rohtranskript-Verarbeitung | |
| PROJ-23 | Echte Dampsoft-Adapter-Anbindung | **Blockiert** — kein API-Zugang, siehe open-questions.md |
| PROJ-29 | Anrufer-Erkennung (CTI-Popup) | **Blockiert** — Telefonanlage unbekannt |
| PROJ-31 | Automatische Sitzungssperre nach Inaktivität | **Zeitkritisch** — muss vor Pilotbetrieb mit echten Patientendaten stehen |

## Could-have (P2)

| ID | Feature |
|---|---|
| PROJ-24 | Multi-Tenant-Migration |
| PROJ-25 | Praxis-Assistent (Freitext-Abfragen) |
| PROJ-26 | SMS / WhatsApp-Kanäle |
| PROJ-27 | Wartelistenmanagement & Terminlücken-Besetzung |
| PROJ-28 | Online-Terminbuchung |
| PROJ-30 | Benutzerverwaltung & Einladungen |

## Explizit NICHT im MVP

Aus `docs/PRD.md`, Non-Goals:

- vollständige Abrechnung
- eigenes Patientenakten-System
- eigenes Befundsystem
- eigenes medizinisches Dokumentationssystem
- komplette Finanzbuchhaltung
- **eigenes Telefoniesystem** — keine Telefonanlage, keine Gesprächsführung, keine Anrufaufzeichnung. PROJ-29 konsumiert lediglich Anruf-Ereignisse einer vorhandenen Anlage.
- eigener Transkriptionsdienst (Soniox wird angebunden, nicht ersetzt)
- vollständiges Patientenportal
- komplexer KI-Chat
- WhatsApp / SMS
- Multi-Praxis-Analytics
- automatische medizinische Entscheidungen
- Online-Terminbuchung, Wartelisten, automatische Lückenbesetzung

## Rahmenbedingungen

- **Team:** ein einzelner Entwickler. Die zweite Person im Projekt ist Zahnarzt und liefert Fachwissen, entwickelt nicht mit. **Konsequenz: Der Umfang jeder Aufgabe muss für eine Person tragbar bleiben.**
- **Timeline:** orientiert an den Phasen 0–6 des Ursprungskonzepts, kein hartes Enddatum.
- **Budget:** nicht final definiert.
- **Daten:** MVP arbeitet ausschließlich mit **synthetischen Testdaten** in einer fiktiven Testpraxis. Echte Patientendaten kommen erst im Pilotbetrieb (Phase 6) hinzu.
