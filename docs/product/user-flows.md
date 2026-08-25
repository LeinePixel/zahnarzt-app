# User Flows

## Status dieser Datei
Nur **ein Flow ist spezifiziert** (Anmeldung, PROJ-1). Der End-to-End-Zielablauf ist aus dem Ursprungskonzept dokumentiert, aber die beteiligten Features sind noch nicht spezifiziert — er dient als Orientierung, nicht als Bauanweisung.

---

## Flow 1 — Anmeldung (PROJ-1) · spezifiziert

Bindende Akzeptanzkriterien: `features/PROJ-1-supabase-infrastructure-setup.md`

```
Nicht angemeldete Person ruft eine beliebige Seite auf
   │
   ▼
Türsteher-Schicht (Middleware) prüft Sitzung
   │
   ├── keine gültige Sitzung ──► Weiterleitung zur Anmeldeseite
   │                                │
   │                                ▼
   │                          E-Mail + Passwort eingeben
   │                                │
   │           ┌────────────────────┼────────────────────┐
   │           ▼                    ▼                    ▼
   │     Felder leer          Zugangsdaten         Dienst nicht
   │     oder ungültig            falsch            erreichbar
   │           │                    │                    │
   │           ▼                    ▼                    ▼
   │     Validierungs-       Einheitliche          Unterscheidbare
   │     meldung am Feld     Fehlermeldung*        Fehlermeldung
   │                         (Eingabe bleibt erhalten)
   │                                │
   │                          Zugangsdaten korrekt
   │                                │
   │                                ▼
   └── gültige Sitzung ──────► Geschützte Seite
                                    │
                              Anzeige: Name, Rolle, Praxis
                                    │
                                    ▼
                              Abmelden ──► zurück zur Anmeldeseite
```

\* **Einheitlich heißt:** Bei falschem Passwort und bei nicht existierender E-Mail erscheint **dieselbe** Meldung. Sonst ließe sich ausprobieren, welche Personen Konten besitzen.

**Sonderfall:** Existiert ein Anmeldekonto ohne zugehöriges Profil, erscheint ein erklärender Hinweis („Konto unvollständig eingerichtet") statt eines Absturzes.

---

## Flow 2 — Ziel-Ablauf End-to-End · NICHT spezifiziert

Aus dem Ursprungskonzept als Demo-Fall beschrieben. **Alle beteiligten Features stehen auf Roadmap** — dieser Ablauf ist die Richtung, kein Auftrag.

```
Patient existiert im Praxissystem
   │  (PROJ-4)
   ▼
Patient wird nach DentPilot synchronisiert
   │  (PROJ-5)
   ▼
Termin erscheint in DentPilot
   │  (PROJ-10, PROJ-13)
   ▼
48 Stunden vorher: Terminerinnerung wird automatisch versendet
   │
   ▼
Termin findet statt — Arztgespräch
   │  (PROJ-14)
   ▼
Transkriptionstool erstellt Zusammenfassung, DentPilot importiert sie
   │  (PROJ-15)
   ▼
KI erkennt: „Krone Zahn 26 empfohlen"
   │  (PROJ-16)
   ▼
System schlägt passende Behandlungsvorlage vor
   │
   ▼
Mitarbeiterin prüft und gibt frei ──► Kostenvoranschlag wird versendet
   │  (PROJ-10, PROJ-13)
   ▼
Nach 7 Tagen ohne Reaktion: automatische Nachfass-Mail + Aufgabe
   │  (PROJ-9)
   ▼
Patient nimmt an ──► Status aktualisiert
   │  (PROJ-18)
   ▼
Dashboard zeigt nächsten Schritt: Termin vereinbaren
```

**Wichtig für die Arbeitsteilung KI vs. Regeln** (Architekturprinzip aus dem Ursprungskonzept):
- Die **KI** extrahiert aus dem Gespräch: Behandlungsart, Zahn, Parameter, besprochene Optionen
- Die **Regel-Engine** entscheidet anhand hinterlegter Vorlagen: welche Positionen, welche Preise, welche Dokumentvorlage, welche Folgeaufgaben

Dadurch bleibt der Prozess nachvollziehbar, reproduzierbar, auditierbar und korrigierbar. Nicht die gesamte Kostenvoranschlagslogik gehört in die KI.

---

## Navigationsmuster (festgelegt)

UX-Aufbau „Seiten-Navigation" — siehe `docs/design/design-system.md`:

- Sidebar wechselt **ganze Seiten**: Dashboard · Patienten · Termine · Aufgaben · Kommunikation · Analytics · Einstellungen
- Jede Listenzeile (Aufgabe, Termin) **öffnet das Patientenprofil** als Vollseite
- **Breadcrumb** führt zurück zur Herkunftsseite

Klickbarer Referenz-Prototyp: `docs/design/assets/dentpilot-ux1-prototype.html`
