# API Contracts

## Status: ein externer Mock-PVS-Vertrag spezifiziert

**Es existiert keine interne API-Route im Projekt** (`git ls-files src/app/api/` liefert nichts). PROJ-2 definiert jedoch einen versionierten Vertrag für einen eigenständigen, lokalen Mock-PVS-Service. Er ist keine Next.js-Route und liefert nur synthetische Daten.

Das ist kein Versäumnis, sondern folgt aus zwei Entscheidungen:

**1. PROJ-1 braucht bewusst keine API-Routen.** Anmelden und Abmelden laufen über Next.js Server Actions direkt gegen Supabase. Eine zusätzliche API-Schicht würde nur durchreichen und nichts beitragen. Siehe `decisions.md`.

**2. Alle übrigen Features haben keine Spec.** Ihre Verträge entstehen mit der jeweiligen Spezifikation.

---

## Absehbare Schnittstellen

Aus den Feature-Beschreibungen in `features/INDEX.md` und den zugehörigen Spezifikationen. Nicht ausdrücklich dokumentierte Formate bleiben offen.

### Eingehend (DentPilot empfängt)

| Schnittstelle | Feature | Bekannt | Offen |
|---|---|---|---|
| **Mock-PVS-API** | PROJ-2, PROJ-3 | Eigenständiger lokaler REST-/JSON-Dienst mit Bearer-Token, `/v1`-Ressourcen für Patienten, Termine und cursor-basierten Änderungsstrom; ausschließlich synthetische Fixtures. | Adapter-Normalisierung, Praxiszuordnung, Retry/Backoff, Sync-Status und Konfliktbehandlung entstehen mit PROJ-3. |
| **Soniox-Transkripte** | PROJ-14 | MVP verarbeitet **fertige Text-Zusammenfassungen**, kein Rohtranskript. Zuordnung über Patienten-ID und Termin-ID. | Abrufverfahren (Webhook oder Polling), Datenformat, Fehlerbehandlung |
| **Anruf-Ereignis** | PROJ-29 | Entwurf sieht ein normalisiertes Ereignis vor: Rufnummer, Zeitpunkt, Richtung. Bewusst herstellerneutral, damit die echte Telefonanlage später ein Adapter-Austausch ist. | Konkrete Anlage unbekannt — siehe open-questions.md |

### Ausgehend (DentPilot ruft auf)

| Schnittstelle | Feature | Bekannt | Offen |
|---|---|---|---|
| **Resend** (E-Mail-Versand) | PROJ-12 | Anbieter festgelegt | Templates, Fehler-/Retry-Verhalten, Zustellstatus-Rückmeldung |
| **IONOS AI Model Hub** | PROJ-15 | Anbieter festgelegt. Aufgabe: Extraktion von Behandlungsart, Zahn, nächsten Schritten aus der Gesprächszusammenfassung. | Modellwahl, Prompt-Struktur, Ausgabeformat, Umgang mit unsicheren Ergebnissen |
| **Dampsoft** | PROJ-23 | **Kein API-Zugang.** Recherche ergab: keine öffentliche REST-API, Partnerschaftsanfrage nötig. | Alles — siehe open-questions.md |

---

## Verbindliche Regeln für künftige API-Routen

Aus `.claude/rules/backend.md` — gelten ohne Ausnahme:

- **Alle Eingaben mit Zod validieren**, bevor sie verarbeitet werden
- **Authentifizierung immer prüfen** — Sitzung muss existieren
- **Aussagekräftige Fehlermeldungen** mit passendem HTTP-Statuscode
- **`.limit()` auf allen Listenabfragen**
- Supabase-Joins statt N+1-Abfrageschleifen
- Fehler aus Supabase-Antworten immer behandeln
- Keine Secrets im Quellcode

## Sync-Anforderungen (aus dem Ursprungskonzept §22)

Für die echte PVS-Anbindung, sobald sie spezifiziert wird, sind vorgesehen:
- Webhook bevorzugt; falls nicht verfügbar, Polling (Richtwert alle fünf Minuten)
- Sync-Status sichtbar
- Fehlerprotokoll
- Retry-Mechanismus
- Konflikterkennung

PROJ-2 liefert dafür gezielt keine Webhooks und keine Sync-Logik. Sein cursor-basierter Änderungsstrom ist ein lokaler Adapter-Testvertrag, keine Vorwegnahme eines echten Herstellerprotokolls.
