# API Contracts

## Status: keine API-Verträge definiert

**Es existiert keine einzige API-Route im Projekt** (`git ls-files src/app/api/` liefert nichts), und für keine ist ein Vertrag spezifiziert.

Das ist kein Versäumnis, sondern folgt aus zwei Entscheidungen:

**1. PROJ-1 braucht bewusst keine API-Routen.** Anmelden und Abmelden laufen über Next.js Server Actions direkt gegen Supabase. Eine zusätzliche API-Schicht würde nur durchreichen und nichts beitragen. Siehe `decisions.md`.

**2. Alle übrigen Features haben keine Spec.** Ihre Verträge entstehen mit der jeweiligen Spezifikation.

---

## Absehbare Schnittstellen — noch ohne Vertrag

Aus den Feature-Beschreibungen in `features/INDEX.md` und den zugehörigen Notizen. **Alle Formate sind offen** und nicht mit dem Nutzer abgestimmt.

### Eingehend (DentPilot empfängt)

| Schnittstelle | Feature | Bekannt | Offen |
|---|---|---|---|
| **Mock-PVS-API** | PROJ-2, PROJ-3 | Wird als eigenständiger Dienst gebaut, den der Adapter genauso anspricht wie später die echte Dampsoft-API. Soll Dampsoft-ähnliche Datenstrukturen liefern. | Endpunkte, Datenformat, Authentifizierung, Paginierung — alles offen |
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

Für die PVS-Anbindung, sobald sie spezifiziert wird, sind vorgesehen:
- Webhook bevorzugt; falls nicht verfügbar, Polling (Richtwert alle fünf Minuten)
- Sync-Status sichtbar
- Fehlerprotokoll
- Retry-Mechanismus
- Konflikterkennung

Diese Anforderungen sind notiert, aber **nicht als Vertrag ausgearbeitet**.
