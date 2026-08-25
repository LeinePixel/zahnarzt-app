# Product Vision — DentPilot

_Quelle: `docs/PRD.md`. Diese Datei fasst zusammen; die PRD bleibt maßgeblich._

## Das Problem
In Zahnarztpraxen bleiben administrative Vorgänge liegen: Kostenvoranschläge werden versendet und nie nachgefasst, PZR-Recalls laufen ab ohne dass jemand nachhakt, empfohlene Behandlungen bekommen keinen Folgetermin. Die Daten dafür liegen in der Praxissoftware — aber niemand wertet sie aus, und die Nachverfolgung ist Handarbeit.

## Was wir bauen
**Kein neues Praxisverwaltungssystem**, sondern eine **Automatisierungs- und Intelligence-Schicht**, die per API an eine bestehende Zahnarztsoftware (Zielsystem: Dampsoft) und ein Transkriptionstool (Soniox) andockt. Sie führt vorhandene Praxisdaten zusammen, leitet daraus Aktionen ab und automatisiert die Nachverfolgung.

Funktional eine Mischung aus CRM, Workflow-Automation, Practice Analytics und Kommunikationsschicht.

## Positionierung
> „Die Automatisierungs- und Intelligence-Schicht für Ihre bestehende Praxissoftware."

Ausdrücklich **nicht** „KI-Software für Zahnärzte". Der Vertriebsvorteil liegt darin, dass die Praxis ihre bisherige Software behalten kann.

## Zielgruppen

**Primär: Praxismanagement / Rezeption.** Arbeitet täglich mit Dashboard, offenen Aufgaben, Nachfassaktionen und Terminübersicht. Für diese Gruppe ist die Oberfläche optimiert.

**Sekundär: Behandelnde Ärzte.** Nutzen das System punktuell — Patientenprofil und Freigabe von Kostenvoranschlagsentwürfen.

Beide arbeiten weiterhin primär in der bestehenden Praxissoftware für medizinische Dokumentation, Abrechnung und Behandlung.

## Source-of-Truth-Prinzip
Eine zentrale Architekturentscheidung, die jedes Feature betrifft:

| System | Ist maßgeblich für |
|---|---|
| **Praxissoftware** | Patient, Behandlung, medizinische Daten, Abrechnung, Termine |
| **DentPilot** | Automatisierungsregeln, Kommunikationshistorie, Aufgaben, CRM-Status, Analytics, Nachfassprozesse, interne Tags, Workflow-Status |

DentPilot darf nicht zum führenden medizinischen Datensystem werden.

## Die Produktleitfrage
Bei jedem neuen Feature zu prüfen:

> Macht dieses Feature vorhandene Praxisdaten besser nutzbar, **oder** automatisiert es einen Prozess, der heute manuell liegen bleibt?

Wenn nein: nicht bauen. Diese Frage schützt davor, schleichend doch ein vollständiges Praxisverwaltungssystem zu bauen.

## Erfolgskriterien
Konkrete Zielwerte werden erst im Pilotbetrieb (Phase 6) festgelegt. Qualitativ:

- **Zeitersparnis** — eingesparte administrative Minuten pro Patient
- **Kommunikation** — Anteil automatisch statt manuell ausgelöster Nachfassaktionen
- **Recall** — zusätzlich zurückgewonnene Patienten
- **No-Shows** — Entwicklung der Quote
- **Kostenvoranschläge** — Annahmequote und Reaktionszeit
- **Offene Prozesse** — Fälle, die nicht mehr liegen bleiben

Ausdrücklich **kein** Erfolgskriterium: „Wir haben eine KI eingebaut."
