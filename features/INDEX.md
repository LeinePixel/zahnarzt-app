# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **In Progress** - `/frontend` or `/backend` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production

## Features

| ID | Feature | Priority | Status | Dependencies | Spec | Created |
|----|---------|----------|--------|---------------|------|---------|
| PROJ-1 | Supabase Infrastructure Setup (inkl. Login) | P0 | In Review | None | [Spec](PROJ-1-supabase-infrastructure-setup.md) | 2026-08-24 |
| PROJ-2 | Mock-PVS-Service (simuliertes externes Praxisverwaltungssystem) | P0 | In Progress | None | [Spec](PROJ-2-mock-pvs-service.md) | 2026-08-24 |
| PROJ-3 | Integration-Adapter-Schicht (internes Datenmodell) | P0 | Roadmap | PROJ-1, PROJ-2 | - | 2026-08-24 |
| PROJ-4 | Patienten-Synchronisierung | P0 | Roadmap | PROJ-3 | - | 2026-08-24 |
| PROJ-5 | Termin-Synchronisierung | P0 | Roadmap | PROJ-3 | - | 2026-08-24 |
| PROJ-6 | Patientenübersicht & Patientenprofil (360°) | P0 | Roadmap | PROJ-4 | - | 2026-08-24 |
| PROJ-7 | Terminübersicht (Tages-/Wochen-/Monatsansicht) | P0 | Roadmap | PROJ-5 | - | 2026-08-24 |
| PROJ-8 | Patienten-Timeline | P0 | Roadmap | PROJ-6, PROJ-7 | - | 2026-08-24 |
| PROJ-9 | CRM / Nachfassaktionen (Aufgaben, Status, Tags) | P0 | Roadmap | PROJ-4 | - | 2026-08-24 |
| PROJ-10 | Regel-Engine (Trigger → Bedingung → Aktion) | P0 | Roadmap | PROJ-1, PROJ-4, PROJ-5 | - | 2026-08-24 |
| PROJ-11 | Kommunikations-Templates-Editor | P0 | Roadmap | PROJ-1 | - | 2026-08-24 |
| PROJ-12 | E-Mail-Versand-Integration (Resend) | P0 | Roadmap | PROJ-1 | - | 2026-08-24 |
| PROJ-13 | Kommunikationsautomatisierung (Terminerinnerung, PZR-Recall, KV-Nachfassung) | P0 | Roadmap | PROJ-10, PROJ-11, PROJ-12 | - | 2026-08-24 |
| PROJ-14 | Transkript-Integration (Soniox-API) | P0 | Roadmap | PROJ-4, PROJ-5 | - | 2026-08-24 |
| PROJ-15 | KI-Informationsextraktion (IONOS AI Model Hub) | P0 | Roadmap | PROJ-14 | - | 2026-08-24 |
| PROJ-16 | Automatischer Kostenvoranschlagsentwurf | P0 | Roadmap | PROJ-15 | - | 2026-08-24 |
| PROJ-17 | Patientenkennzahlen (Termintreue, PZR-Frequenz, Umsatz) | P0 | Roadmap | PROJ-4, PROJ-5 | - | 2026-08-24 |
| PROJ-18 | Dashboard | P0 | Roadmap | PROJ-9, PROJ-13, PROJ-16, PROJ-17 | - | 2026-08-24 |
| PROJ-19 | Audit Logging & Rollenrechte | P0 | In Review | PROJ-1 | [Spec](PROJ-19-audit-logging-and-role-permissions.md) | 2026-08-26 |
| PROJ-20 | Analytics (Termin-KPIs, Recall-Quote, KV-Conversion) | P1 | Roadmap | PROJ-13, PROJ-16, PROJ-17 | - | 2026-08-24 |
| PROJ-21 | Erweitertes Patientenrating (transparente Einzelkennzahlen) | P1 | Roadmap | PROJ-17 | - | 2026-08-24 |
| PROJ-22 | Rohtranskript-Verarbeitung (eigene Zusammenfassung statt Soniox-Zusammenfassung) | P1 | Roadmap | PROJ-14, PROJ-15 | - | 2026-08-24 |
| PROJ-23 | Echte Dampsoft-Adapter-Anbindung | P1 | Roadmap | PROJ-3 | - | 2026-08-24 |
| PROJ-24 | Multi-Tenant-Migration | P2 | Roadmap | PROJ-1 | - | 2026-08-24 |
| PROJ-25 | Praxis-Assistent (Freitext-Abfragen) | P2 | Roadmap | PROJ-15, PROJ-20 | - | 2026-08-24 |
| PROJ-26 | SMS / WhatsApp-Kommunikationskanäle | P2 | Roadmap | PROJ-13 | - | 2026-08-24 |
| PROJ-27 | Wartelistenmanagement & automatische Terminlücken-Besetzung | P2 | Roadmap | PROJ-5 | - | 2026-08-24 |
| PROJ-28 | Online-Terminbuchung | P2 | Roadmap | PROJ-5 | - | 2026-08-24 |
| PROJ-29 | Anrufer-Erkennung (CTI-Popup mit Patientenübersicht bei eingehendem Anruf) | P1 | Roadmap | PROJ-4, PROJ-6, PROJ-17, PROJ-19 | - | 2026-08-24 |
| PROJ-30 | Benutzerverwaltung & Einladungen (Nutzer anlegen, einladen, deaktivieren) | P2 | Roadmap | PROJ-1, PROJ-19 | - | 2026-08-24 |
| PROJ-31 | Automatische Sitzungssperre, MFA und Re-Authentisierung | P1 | In Progress | PROJ-1 | [Spec](PROJ-31-session-hardening.md) | 2026-08-24 |

<!-- Add features above this line -->

### Notiz zu PROJ-23 (Echte Dampsoft-Adapter-Anbindung)
Recherche (24.08.2026) bestätigt: Dampsoft hat **keine öffentlich dokumentierte REST-API** mit Self-Service-Zugang. Bevor an dieser Feature-Spec gearbeitet wird, muss parallel zur Entwicklung ein **Direktkontakt zu Dampsoft** (support@dampsoft.de) aufgenommen werden, um den Umfang und die Konditionen des vermuteten "API/SBI"-Moduls zu klären (NDA/Partnervertrag wahrscheinlich). Fallback-Optionen, falls kein direkter Zugang zustande kommt:
- **Evident** als technisch offenster Alternativ-PVS-Anbieter (wirbt mit REST-API + SIDIfy)
- Bestehende **Middleware-Anbieter** (Dr. Flex, Dentero, iie Systems, Nelly), die bereits proprietäre PVS-Schnittstellen betreiben
- **RPA/Screen-Scraping** (z. B. legacy-use.com) als technische Notlösung ohne offiziellen API-Zugang

Diese Klärung sollte spätestens vor `/write-spec PROJ-23` abgeschlossen sein, da sie den technischen Ansatz der Spec bestimmt.

### Notiz zu PROJ-29 (Anrufer-Erkennung / CTI-Popup)
Hinzugefügt am 24.08.2026. Ziel: Bei eingehendem Anruf öffnet sich in der App automatisch ein Overlay mit der Patientenübersicht, sofern die Telefonnummer im System hinterlegt ist — die Rezeption sieht sofort, wer anruft und was bei dieser Person ansteht.

**Passt zur Produktleitfrage** aus dem Ursprungskonzept: Das Feature macht vorhandene Praxisdaten im entscheidenden Moment nutzbar und ersetzt das manuelle Nachschlagen während des Klingelns.

**Abgrenzung zum Non-Goal „eigenes Telefoniesystem":** PROJ-29 baut *keine* Telefonanlage und keine Gesprächsführung. Es konsumiert lediglich ein Anruf-Ereignis (Rufnummer + Zeitpunkt) aus einer vorhandenen Telefonanlage und schlägt die Nummer im eigenen Datenbestand nach. Der Non-Goal-Eintrag in der PRD wurde entsprechend präzisiert.

**Getroffene Entscheidungen (24.08.2026):**
- **Telefonanlage noch unbekannt** → gleiche Strategie wie bei Dampsoft: Entwicklung gegen einen **generischen Anruf-Webhook** (Mock), der ein normalisiertes Ereignis `{ rufnummer, zeitpunkt, richtung }` liefert. Die echte Anbindung wird später ein austauschbarer Adapter, kein Umbau. Cloud-PBX-Anbieter (Placetel, sipgate, 3CX) bieten in der Regel Webhooks und wären der einfache Weg; eine lokale Anlage mit TAPI würde einen Windows-Client am Arbeitsplatz erfordern und wäre deutlich aufwändiger.
- **Anrufhistorie wird NICHT gespeichert.** Das Popup zeigt den Anrufer flüchtig an, danach wird nichts persistiert. Damit entfallen Aufbewahrungsregeln und Einwilligungsprüfung für Anrufdaten. Die reine Rufnummernsuche wird dennoch im Audit-Log (PROJ-19) erfasst, da sie eine Verarbeitung personenbezogener Daten ist.

**Offene Vorbedingungen — vor `/write-spec PROJ-29` zu klären:**
1. **Telefonnummern müssen synchronisiert werden.** Der Mock-PVS-Service (PROJ-2) und die Patienten-Synchronisierung (PROJ-4) müssen Telefonnummern liefern; aktuell nicht im Datenmodell vorgesehen. **Dies ist die einzige Vorbedingung, die schon im MVP berücksichtigt werden muss** — sonst muss das Datenmodell für PROJ-29 nachträglich erweitert werden.
2. **Rufnummern-Normalisierung** nötig (E.164), sonst schlägt der Abgleich bei abweichenden Formaten fehl.
3. **Mehrdeutige Treffer** müssen definiert sein: gemeinsame Festnetznummer einer Familie, mehrere Patienten pro Nummer, unbekannte Nummer, unterdrückte Nummer.
4. **Rollenrechte:** Wer darf das Popup sehen?

**UI-Hinweis:** Im gewählten UX-Aufbau „Seiten-Navigation" (UX 1) wird das Popup ein Overlay über der aktuellen Seite, damit die laufende Arbeit nicht verloren geht — vergleichbar mit dem Slide-over-Panel aus dem verworfenen UX-3-Entwurf.

## Empfohlene Build-Reihenfolge (MVP, P0)

1. **PROJ-1** Supabase Infrastructure Setup
2. **PROJ-19** Audit Logging & Rollenrechte *(früh mitbauen, nicht nachträglich)*
3. **PROJ-31** Automatische Sitzungssperre, MFA und Re-Authentisierung
4. **PROJ-2** Mock-PVS-Service
5. **PROJ-3** Integration-Adapter-Schicht
6. **PROJ-4** Patienten-Synchronisierung
7. **PROJ-5** Termin-Synchronisierung
8. **PROJ-6** Patientenübersicht & Profil
9. **PROJ-7** Terminübersicht
10. **PROJ-9** CRM / Nachfassaktionen
11. **PROJ-11** Kommunikations-Templates-Editor
12. **PROJ-12** E-Mail-Versand-Integration
13. **PROJ-10** Regel-Engine
14. **PROJ-13** Kommunikationsautomatisierung
15. **PROJ-14** Transkript-Integration
16. **PROJ-15** KI-Informationsextraktion
17. **PROJ-16** Automatischer Kostenvoranschlagsentwurf
18. **PROJ-17** Patientenkennzahlen
19. **PROJ-8** Patienten-Timeline *(aggregiert Daten aus 6, 7, 9, 13, 14)*
20. **PROJ-18** Dashboard *(bündelt alles)*

Danach P1 (PROJ-20 bis PROJ-23, PROJ-29), dann P2 nach Bedarf.

**Betriebliche Abnahme vor P31-Umsetzung:** PROJ-1 bleibt bis zu Safari-Smoke, Browser-Neustart und kontrolliertem Dienstausfall `In Review`. PROJ-19 bleibt bis zum Hosted-Cron-Commissioning mit Monitoring `In Review`. Diese Nachweise und PROJ-31 müssen vor echten oder re-identifizierbaren Daten abgeschlossen sein.

## Verbindliche Compliance-Gates (25.08.2026)

- Für alle Features gilt `docs/architecture/privacy-security-ai-compliance.md`.
- Echte oder re-identifizierbare Patienten-/Gesundheitsdaten sind bis zur dokumentierten Freigabe des Real-Data-Gates untersagt.
- PROJ-19 und PROJ-31 müssen vor echten Daten abgeschlossen sein; PROJ-31 umfasst dabei auch MFA-/Re-Auth-Entscheidungen.
- Vor PROJ-12, PROJ-14 und PROJ-15 ist je externer Anbieter eine Datenschutz-, Subprozessor- und Transferprüfung erforderlich.
- Vor PROJ-15 und PROJ-16 ist ein AI-Impact-Check einschließlich AI-Act- und Medizinprodukte-Einstufung erforderlich.

## Next Available ID: PROJ-32
