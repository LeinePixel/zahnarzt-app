# Product Requirements Document

## Vision
Wir bauen kein neues Praxisverwaltungssystem (PVS), sondern eine **Automatisierungs- und Intelligence-Schicht**, die sich per API an bestehende Zahnarztsoftware (Ziel-System: Dampsoft) und ein Gesprächstranskriptions-Tool (Soniox) anschließt. Das Add-on führt vorhandene Praxisdaten intelligent zusammen, leitet daraus relevante Aktionen ab und automatisiert administrative Prozesse, die heute manuell liegen bleiben oder über mehrere Insellösungen verteilt sind — eine Mischung aus CRM, Workflow Automation, Practice Analytics und Communication Layer. Positionierung: "Die Automatisierungs- und Intelligence-Schicht für Ihre bestehende Praxissoftware", nicht "KI-Software für Zahnärzte". Die Praxis muss ihre bisherige Software nicht ersetzen.

## Target Users
**Primäre Zielgruppe: Praxismanagement / Rezeption.** Sie arbeiten täglich mit dem Dashboard, offenen Aufgaben, Nachfassaktionen und der Terminübersicht — ihr größter Schmerzpunkt ist, dass Kostenvoranschläge, Recall-Fälle und Folgetermine heute manuell nachverfolgt werden müssen und dabei liegen bleiben.

**Sekundäre Zielgruppe: Behandelnde Ärzte.** Nutzen das System punktuell — insbesondere das Patientenprofil und die Freigabe von Kostenvoranschlagsentwürfen, die aus der KI-Zusammenfassung des Patientengesprächs vorbereitet werden.

Beide Gruppen arbeiten weiterhin primär in der bestehenden Praxissoftware für medizinische Dokumentation, Abrechnung und Behandlung — das Add-on ergänzt, ersetzt nicht.

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | Supabase Infrastructure Setup (Auth, Login, DB-Schema, Rollen, Tenant-Grundlage) | Planned |
| P0 (MVP) | Mock-PVS-Service (simuliertes externes Praxisverwaltungssystem, Dampsoft-Datenform) | Roadmap |
| P0 (MVP) | Integration-Adapter-Schicht (herstellerunabhängiges internes Datenmodell) | Roadmap |
| P0 (MVP) | Patientenübersicht & Patientenprofil (360°-Ansicht) | Roadmap |
| P0 (MVP) | Terminübersicht (Tages-/Wochen-/Monatsansicht, Sync aus Mock-PVS) | Roadmap |
| P0 (MVP) | Patienten-Timeline | Roadmap |
| P0 (MVP) | CRM / Nachfassaktionen (Aufgaben, Status, Tags) | Roadmap |
| P0 (MVP) | Regel-Engine (Trigger → Bedingung → Aktion) | Roadmap |
| P0 (MVP) | Kommunikationsautomatisierung (Terminerinnerung, PZR-Recall, KV-Nachfassung) | Roadmap |
| P0 (MVP) | Kommunikations-Templates (Editor für Praxisadmins) | Roadmap |
| P0 (MVP) | E-Mail-Versand-Integration (Resend) | Roadmap |
| P0 (MVP) | Transkript-Integration (Soniox-API, fertige Zusammenfassung) | Roadmap |
| P0 (MVP) | KI-Informationsextraktion (IONOS AI Model Hub: Behandlungsart, Zahn, nächste Schritte) | Roadmap |
| P0 (MVP) | Automatischer Kostenvoranschlagsentwurf (Behandlungsvorlagen + Freigabeprozess) | Roadmap |
| P0 (MVP) | Patientenkennzahlen (Termintreue, PZR-Frequenz, Umsatz, letzter/nächster Termin) | Roadmap |
| P0 (MVP) | Dashboard (Aufgaben, Chancen, Risiko, Kommunikation) | Roadmap |
| P0 (MVP) | Audit Logging & Rollenrechte | Roadmap |
| P1 | Analytics (Termin-KPIs, Recall-Quote, KV-Conversion, Patientenwert) | Roadmap |
| P1 | Erweitertes Patientenrating (Termintreue, PZR-Compliance, CLV, Praxisbindung als transparente Einzelkennzahlen) | Roadmap |
| P1 | Rohtranskript-Verarbeitung (eigene Zusammenfassung statt fertiger Soniox-Zusammenfassung) | Roadmap |
| P1 | Echte Dampsoft-Adapter-Anbindung (sobald API-Zugang verfügbar, siehe Constraints) | Roadmap |
| P1 | Anrufer-Erkennung (CTI-Popup mit Patientenübersicht bei eingehendem Anruf) | Roadmap |
| P1 | Automatische Sitzungssperre nach Inaktivität (vor Pilotbetrieb zwingend) | Roadmap |
| P2 | Benutzerverwaltung & Einladungen (Nutzer anlegen, einladen, deaktivieren) | Roadmap |
| P2 | Multi-Tenant-Migration (mehrere Praxen) | Roadmap |
| P2 | Praxis-Assistent (Freitext-Abfragen über Praxisdaten) | Roadmap |
| P2 | SMS / WhatsApp-Kommunikationskanäle | Roadmap |
| P2 | Wartelistenmanagement & automatische Terminlücken-Besetzung | Roadmap |
| P2 | Online-Terminbuchung | Roadmap |

## Success Metrics
Konkrete Zielwerte werden erst im Pilotbetrieb (Phase 6, mit echten Testpraxis-Daten) festgelegt. Für den MVP gelten folgende qualitative Erfolgsindikatoren:
- **Zeitersparnis:** administrative Minuten pro Patient, die durch Automatisierung eingespart werden
- **Kommunikation:** Anzahl automatisch statt manuell ausgelöster Nachfassaktionen
- **Recall:** Anzahl zusätzlicher Patienten, die durch automatisierten Recall zurückkommen
- **No-Shows:** Entwicklung der No-Show-Rate
- **Kostenvoranschläge:** Entwicklung der Annahmequote und Reaktionszeit
- **Offene Prozesse:** Anzahl der Fälle, die nicht mehr unbearbeitet liegen bleiben
- **Praxisumsatz:** zusätzliche Leistung durch bessere Nachverfolgung

Ausdrücklich **kein** Erfolgskriterium: "Wir haben eine KI eingebaut."

## Constraints
- **Team:** 2 Personen, davon **ein einzelner Entwickler**, der die gesamte Anwendung allein baut. Die zweite Person ist Zahnarzt und liefert das fachliche Wissen der Branche (Abläufe, Terminologie, Praxisrealität), entwickelt aber nicht mit. Konsequenz für die Planung: Es gibt keine parallele Entwicklung abzustimmen, aber auch keine zweite Person, die Entwicklungsarbeit übernehmen kann — der Umfang muss für eine Person tragbar bleiben.
- **Timeline:** orientiert an den Phasen 0–6 aus dem ursprünglichen Konzept (Phase 0 Discovery ca. 2–4 Wochen; kein hartes Gesamt-Enddatum definiert)
- **Budget:** noch nicht final definiert
- **Kein Backend-Ersatz:** Praxissoftware bleibt Source of Truth für Patient, Behandlung, medizinische Daten, Abrechnung, Termine. Das Add-on ist Source of Truth für Automatisierungsregeln, Kommunikationshistorie, Aufgaben, CRM-Status, Analytics, Nachfassprozesse, interne Tags, Workflow-Status.
- **Kein echter PVS-API-Zugang aktuell:** Es besteht kein API-Zugriff auf ein reales Praxisverwaltungssystem. Zielsystem ist **Dampsoft**; bis ein echter Zugang steht, wird ein **eigener Mock-PVS-Service** (separate API, Dampsoft-ähnliche Datenstruktur) gebaut, gegen den der Integration-Adapter entwickelt und getestet wird. Umstieg auf die echte API später = Adapter-Austausch, kein Umbau der Anwendung.
  - **Rechercheergebnis (24.08.2026):** Keiner der geprüften deutschen PVS-Anbieter (Dampsoft, CGM Z1, Evident, ivoris) bietet eine öffentlich zugängliche REST-API mit Self-Service-Doku/Sandbox. Für alle ist eine direkte Partnerschaftsanfrage nötig, vermutlich inkl. NDA und kommerzieller Vereinbarung. Dampsoft nutzt standardmäßig nur die dateibasierten Alt-Standards VDDS/GDT/KIM/TI, die für Echtzeit-Termin-/Patientendaten nicht geeignet sind; es gibt Hinweise auf ein kostenpflichtiges "API/SBI"-Modul (Umfang/Kosten nicht offiziell bestätigt, direkte Anfrage bei Dampsoft-Support nötig). **Evident** wirkt technisch am offensten (wirbt mit REST-API + SIDIfy-Standard). Als Alternative zur Direktintegration existieren Middleware-Anbieter (Dr. Flex, Dentero, iie Systems, Nelly), die bereits proprietäre Schnittstellen zu mehreren PVS betreiben, sowie RPA-/Screen-Scraping-Lösungen (z. B. legacy-use.com) als Notlösung für Dampsoft. Das bestätigt die Mock-PVS-Strategie für den MVP als richtige Entscheidung — ein echter Dampsoft-Zugang ist realistisch nicht kurzfristig zu erwarten.
- **Transkription:** eigenes Tool **Soniox** wird per eigener API-Anbindung angeschlossen. MVP verarbeitet **fertige Text-Zusammenfassungen** (kein Rohtranskript-Processing im MVP, folgt als P1).
- **KI-Anbieter:** **IONOS AI Model Hub** für interne KI-Aufgaben (Informationsextraktion aus Transkript-Zusammenfassungen, später Praxis-Assistent). Soniox bleibt für die reine Transkription/Zusammenfassung zuständig.
- **E-Mail-Versand:** Resend.
- **Backend:** Supabase (PostgreSQL + Auth + Storage), Row-Level-Security als spätere Grundlage für Multi-Tenant.
- **Tenancy:** MVP startet **Single-Tenant** in einer eigenen, synthetischen (nicht-echten) Testpraxis. Das Datenmodell enthält von Anfang an eine `Practice`-Entität, um die spätere Migration zu Multi-Tenant (mehrere Praxen) architektonisch vorzubereiten, ohne dass RLS-Komplexität bereits im MVP gelöst werden muss.
- **Datenschutz:** Da die MVP-Phase mit synthetischen Testdaten arbeitet, besteht kein unmittelbarer DSGVO-Zeitdruck durch echte Patientendaten. Rollenrechte, Audit-Log, Verschlüsselung und Löschkonzept werden dennoch von Anfang an architektonisch mitgedacht (siehe Non-Goals/Datenschutzprinzipien im ursprünglichen Konzept), da vor dem echten Pilotbetrieb (Phase 6) reale Patientendaten hinzukommen.
- **Design-System:** festgelegt am 24.08.2026 — siehe `docs/design/design-system.md`. Visuelle Richtung „Klinisch Hell" (heller, ruhiger Aufbau, Logo-Grünton als Hauptakzent, Plus Jakarta Sans), UX-Aufbau „Seiten-Navigation" (Sidebar wechselt ganze Seiten: Dashboard, Patientenprofil, Termine). Umsetzung mit Tailwind + shadcn/ui auf Basis der dort definierten Tokens. Klickbarer Referenz-Prototyp: `docs/design/assets/dentpilot-ux1-prototype.html`.

## Non-Goals
Im MVP explizit **nicht** gebaut:
- vollständige Abrechnung
- eigenes Patientenakten-System
- eigenes Befundsystem
- eigenes medizinisches Dokumentationssystem
- komplette Finanzbuchhaltung
- eigenes Telefoniesystem (keine eigene Telefonanlage, keine Gesprächsführung, keine Anrufaufzeichnung — die Anrufer-Erkennung PROJ-29 konsumiert lediglich Anruf-Ereignisse einer vorhandenen Anlage)
- eigener Transkriptionsdienst (Soniox wird angebunden, nicht ersetzt)
- vollständiges Patientenportal
- komplexer KI-Chat / Praxis-Assistent (Phase 2)
- WhatsApp / SMS als Kommunikationskanal
- Multi-Praxis-Analytics
- automatische medizinische Entscheidungen
- Online-Terminbuchung, Wartelistenmanagement, automatische Terminlücken-Besetzung

---

Use `/write-spec` to create detailed feature specifications for each item in the roadmap above.
