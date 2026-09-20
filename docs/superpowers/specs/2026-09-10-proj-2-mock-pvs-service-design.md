# PROJ-2 Mock-PVS-Service — Architekturentwurf

**Status:** Lokal implementiert und verifiziert; In Review
**Datum:** 2026-09-10
**Verbindliche Feature-Spezifikation:** `features/PROJ-2-mock-pvs-service.md`

## Ziel und Nicht-Ziel

Der Mock-PVS-Service simuliert eine externe, nur lesbare PVS-Datenquelle für die Entwicklung der Integrations- und Synchronisationsschicht. Er stellt deterministische synthetische Patienten, Termine und Quelländerungen über HTTP bereit. Er ist kein Bestandteil der DentPilot-Laufzeitarchitektur und speichert nichts in Supabase.

Der Dienst ersetzt keine echte PVS-Schnittstelle und modelliert keine medizinischen, abrechnungsrelevanten oder sonstigen Fachinhalte. Er ist kein Hosting-, Datenschutz-, Anbieter- oder Real-Data-Gate-Nachweis.

## Gewählte Lösung

Der Dienst ist ein eigenständiger TypeScript-Prozess im selben Repository:

```text
services/mock-pvs/
  config.ts          Validiert lokale Dienstkonfiguration und getrennte Tokens
  contracts.ts       Versionierte Ein-/Ausgabe-Schemas und TypeScript-Typen
  fixtures.ts        Ausschließlich synthetischer, deterministischer Grundbestand
  scenario-state.ts  In-Memory-Zustand und erlaubte Szenariowechsel
  auth.ts            Bearer-Token-Prüfung und Trennung von Lese- und Testzugang
  router.ts          /v1-Routen, Fehlerzuordnung und Testzugang
  server.ts          HTTP-Server, Start und kontrolliertes Herunterfahren
```

Der Prozess wird über ein eigenes root-npm-Skript gestartet. Die direkte Service-Test-Suite startet ihn mit temporär eingespeisten Testwerten und beendet ihn kontrolliert. Der spätere PROJ-3-Adapter kennt nur eine Basis-URL und den Lese-Token; er importiert keine Service-Interna.

| Alternative | Grund |
|---|---|
| Next.js-Route in DentPilot | Keine echte externe Prozess- und Konfigurationsgrenze; der Adapter würde seine spätere Laufzeit nicht realistisch testen. |
| Separater Docker-Container oder neues Repository | Für einen lokalen, rein synthetischen Dienst vor PROJ-3 unnötige Infrastruktur- und Wartungslast. |

## Ablauf

```text
lokale Fixture-/Szenariokonfiguration
              │
              ▼
       Mock-PVS-HTTP-Prozess
       ├─ /v1/*: Lese-Token
       └─ /__test/*: Test-Token
              │
              ▼
      künftiger PROJ-3-Adapter
              │
              ▼
   künftige DentPilot-Synchronisierung
```

Der Mock hält den gewählten Fixture-Zustand ausschließlich im Speicher. Ein Prozessstart erzeugt immer `baseline`; der Testzugang kann nur auf namentlich bekannte Szenarien schalten oder diesen Grundzustand wiederherstellen. Keine reguläre Route darf Daten verändern.

## HTTP-Vertrag

### Authentifizierung und Konfiguration

Alle Routen prüfen einen Bearer-Token. Der Lese-Token und der Test-Token sind zwei unterschiedliche, nicht leere Werte; der Prozess verweigert den Start, wenn Konfiguration fehlt oder beide Werte gleich sind. Die Werte stehen nur in einer ignorierten lokalen Konfigurationsdatei als `MOCK_PVS_PORT`, `MOCK_PVS_READ_TOKEN` und `MOCK_PVS_TEST_TOKEN`; eine Beispielkonfiguration enthält nur diese Namen. Die künftige Browser-App erhält keine dieser Umgebungsvariablen.

| Zugang | Header | Berechtigung |
|---|---|---|
| regulär | `Authorization: Bearer <read-token>` | ausschließlich `GET /v1/*` |
| Test | `Authorization: Bearer <test-token>` | ausschließlich lokale Szenariosteuerung |

Die Routen antworten bei fehlendem oder falschem Token stets mit dem gleichen datenlosen 401-Ergebnis. Sie schreiben den Header nie in Logs.

### Ressourcen

Die vollständige URL ist durch die Basis-URL konfiguriert. Der Vertrag beginnt bei `/v1`, damit künftige inkompatible Änderungen parallel versioniert werden können.

| Route | Erfolgsantwort |
|---|---|
| `GET /v1/health` | `{ data: { apiVersion: "v1" } }` |
| `GET /v1/patients?cursor=&limit=` | `{ data: Patient[], nextCursor: string \| null }` |
| `GET /v1/patients/:id` | `{ data: Patient }` |
| `GET /v1/appointments?patientId=&from=&to=&cursor=&limit=` | `{ data: Appointment[], nextCursor: string \| null }` |
| `GET /v1/changes?cursor=&limit=` | `{ data: ChangeEvent[], nextCursor: string \| null }` |

Die Routen prüfen Eingaben vor der Verarbeitung mit vorhandenen Zod-Schemas. `limit` nutzt 25 als Default und akzeptiert nur ganze Zahlen bis 100. Filter für Termine sind optional; `from` und `to` sind ISO-8601-Zeitpunkte mit Offset. `from` ist inklusive, `to` exklusiv bezogen auf `startsAt`; bei beiden Werten muss `from` vor `to` liegen. Ein Filter begrenzt ausschließlich die Rückgabe und ändert nie den Änderungsstrom.

### Datentypen

```ts
type Patient = {
  id: string
  version: number
  firstName: string
  lastName: string
  birthDate: string
  email: string | null
  phoneE164: string
  sourceCreatedAt: string
  sourceUpdatedAt: string
}

type Appointment = {
  id: string
  version: number
  patientId: string
  startsAt: string
  endsAt: string
  status: 'confirmed' | 'cancelled' | 'no_show' | 'rescheduled' | 'completed'
  practitionerId: string
  sourceCreatedAt: string
  sourceUpdatedAt: string
}

type ChangeEvent =
  | {
      eventId: string
      cursor: string
      occurredAt: string
      entityType: 'patient' | 'appointment'
      operation: 'upsert'
      entityId: string
      version: number
      resource: Patient | Appointment
    }
  | {
      eventId: string
      cursor: string
      occurredAt: string
      entityType: 'patient' | 'appointment'
      operation: 'delete'
      entityId: string
      version: number
    }
```

`Patient.id`, `Appointment.id` und `practitionerId` sind nur externe Quellkennungen. Sie dürfen nie als DentPilot- oder Supabase-ID behandelt werden. `phoneE164` ist bei gültigen Fixtures immer normalisiert; die Fehlervariante existiert ausschließlich für spätere Boundary-Tests.

Cursor sind opaque. Sie werden nur vom Server erzeugt und werden mit einer stabilen Gesamtordnung aus Szenario, Ereignisposition und Vertragsversion abgeglichen. Ein unbekannter oder zu einem anderen Szenario unpassender Cursor führt zu 422, nicht zu einer improvisierten Wiederaufnahme.

### Teststeuerung

Der nicht fachliche Testzugang verwendet ausdrücklich keinen `/v1`-Pfad:

| Route | Wirkung |
|---|---|
| `POST /__test/scenarios/:name` | aktiviert genau eines der vordefinierten Szenarien |
| `POST /__test/reset` | aktiviert `baseline` |

Er akzeptiert keinerlei frei übergebene Patient:innen, Termine oder Fehlerparameter. Das verhindert, dass Tests unkontrollierte, möglicherweise sensible Inhalte in den Dienst einschleusen.

## Fehler- und Wiederholungsverhalten

| Fall | HTTP | Mindestvertrag |
|---|---:|---|
| Token fehlt oder stimmt nicht | 401 | ein neutraler datenloser Fehlercode |
| Route existiert nicht | 404 | keine Aufzählung anderer Routen oder Daten |
| Ressource existiert nicht | 404 | keine anderen Datensätze |
| Cursor, `limit` oder Terminfilter ungültig | 422 | neutraler Validierungsfehler |
| Szenario `rate-limited` | 429 | `Retry-After` vorhanden |
| Szenario `temporarily-unavailable` | 503 | `Retry-After` vorhanden |
| interner unerwarteter Fehler | 500 | neutrale Fehlermeldung ohne Stacktrace |

Der Dienst führt für reguläre GET-Anfragen keine Seiteneffekte aus. Derselbe Cursor gegen dasselbe aktive Szenario liefert daher exakt dieselbe Seite. Ein Szenariowechsel wird in der Test-Suite immer durch einen Reset eingerahmt; Cursor aus einem anderen Szenario werden nicht weiterverwendet.

## Fixture- und Szenariomodell

`baseline` enthält eine kleine fiktive Praxis, mehr Datensätze als eine Standardseite und mindestens einen Termin je vereinbarten Status. Namen, Kontaktwerte, IDs und Zeiten sind fest definiert und erkennbar synthetisch. Keine Fixture darf ein reales Praxis-, Patienten- oder Mitarbeiterprofil imitieren.

| Szenario | Abweichung von `baseline` |
|---|---|
| `changes` | versionierte Änderung einer Kontaktmöglichkeit, Terminverschiebung und weitere gültige `upsert`-Ereignisse |
| `deletions` | mindestens ein datensparsamer Tombstone |
| `invalid-source-data` | ausschließlich gezielt ungültige Quellelemente für Vertragsabwehrtests; die reguläre Datenroute verletzt hier absichtlich das normale Ausgabeschema |
| `rate-limited` | jede reguläre Datenroute antwortet mit 429 und `Retry-After` |
| `temporarily-unavailable` | jede reguläre Datenroute antwortet mit 503 und `Retry-After` |

Die Fehlerszenarien sind Teil des Mock-Vertrags, kein Verhalten, das späterer Produktionscode unkommentiert übernimmt.

## Sicherheits- und Datenschutzbetrachtung

| Risiko | Entwurfsentscheidung |
|---|---|
| Token im Browser oder Log | Nur serverseitige, ignorierte Konfiguration; Header und Werte werden nie geloggt oder zurückgegeben. |
| Echtdaten gelangen in Tests | Nur versionierte, sichtbar synthetische Fixtures; keine Import- oder Schreibroute. |
| Mock wird fälschlich als DentPilot-Speicher benutzt | Keine Supabase-Verbindung, keine Tabellen, keine App-Route und kein Datenimport in PROJ-2. |
| Adapter verlässt sich auf eine ideale Quelle | Pagination, Cursor, Tombstones, ungültige Quellwerte, 429 und 503 sind reproduzierbar testbar. |
| Testzugang wird zum verdeckten Fach-API | Eigener Token, feste Szenarionamen und keine frei eingegebenen Ressourcendaten. |

Die Daten bleiben zwar synthetisch, doch Schnittstellen-, Log- und Geheimnisgrenzen folgen schon dem späteren hohen Schutzbedarf. Das Real-Data-Gate wird dadurch weder erfüllt noch geöffnet.

## Testentwurf

1. Zod-/Unit-Tests belegen alle Eingabe- und Ausgabeschemas für gültige Szenarien, den Konfigurations-Fail-Closed-Start, getrennte Token und die Cursor-Plausibilität.
2. HTTP-Integrationstests starten den echten Prozess mit temporären Testwerten, prüfen Authentifizierung, Endpunkte, Pagination und Cursor.
3. Szenariotests prüfen stabile Wiederholung, vollständige `upsert`-Ressourcen, ressourcenlose Tombstones, Reset und alle Fehlerzustände.
4. Ein Prozess-Smoke-Test prüft Start, `/v1/health` und kontrolliertes Beenden.
5. Die Repository-Vollverifikation muss den Mock-Dienst starten können, ohne vorhandene Auth-, RLS-, Browser- oder Real-Data-Gates zu lockern.

## Schnittstelle zu Folgeprojekten

PROJ-3 erhält ausschließlich die `/v1`-Dokumentation, Basis-URL und serverseitigen Lese-Token. Es implementiert erst die Zuordnung zu einer DentPilot-Praxis, Adapter-Normalisierung, Wiederholung, Backoff, Fehlerprotokoll und Konfliktbehandlung. PROJ-4 und PROJ-5 entscheiden erst über interne Tabellen, RLS, Datenminimierung beim Import und Benutzeransichten.

Kein Folgeschritt darf die Mock-Felder automatisch als vollständiges DentPilot-Datenmodell behandeln.
