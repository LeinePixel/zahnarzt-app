# Data Model

## Status
**Nur die zwei Tabellen aus PROJ-1 sind spezifiziert.** Alles Weitere ist eine Liste geplanter Entitäten ohne Feldstruktur — bewusst so, siehe Entscheidung „Nur `practice` und `user_profile` im Schema" in `decisions.md`.

**Codex: keine Tabellen anlegen, die hier nicht spezifiziert sind.** Jedes Feature bringt seine eigenen mit, wenn es spezifiziert wird.

---

## Verbindliche Konventionen

Gelten für **jede** Tabelle, die künftig entsteht:

1. **`practice_id` als Fremdschlüssel** auf jeder Tabelle mit Praxisbezug — Vorbereitung auf Multi-Tenant (PROJ-24)
2. **Row Level Security aktiviert**, ausnahmslos, auch im Single-Tenant-Betrieb
3. **RLS-Policies für SELECT, INSERT, UPDATE, DELETE** einzeln definiert (aus `.claude/rules/backend.md`)
4. **Indizes** auf Spalten in WHERE-, ORDER-BY- und JOIN-Klauseln
5. **Migrationen versioniert** und im Repository abgelegt
6. Fremdschlüssel mit `ON DELETE CASCADE`, wo fachlich sinnvoll

---

## Spezifiziert (PROJ-1)

### `practice` — die Praxis als Mandant
| Feld | Beschreibung |
|---|---|
| Kennung | eindeutiger Primärschlüssel |
| Name | Name der Praxis |
| Anlagezeitpunkt | wann der Datensatz entstand |

Existiert von Beginn an, obwohl der MVP nur eine Praxis kennt.

### `user_profile` — Zusatzdaten zum Anmeldekonto
| Feld | Beschreibung |
|---|---|
| Kontoverweis | Verweis auf das von Supabase verwaltete Anmeldekonto |
| Praxiszugehörigkeit | Verweis auf `practice` |
| Anzeigename | für die Oberfläche |
| Rolle | genau einer der Werte `rezeption`, `behandler`, `praxisadmin` |
| Anlagezeitpunkt | |

**Kein Passwortfeld.** Anmeldedaten verwaltet Supabase in einem eigenen, geschützten Bereich; Passwörter sind für die Anwendung nie lesbar.

**Warum getrennt vom Anmeldekonto:** Der Auth-Bereich von Supabase lässt sich nicht um eigene Felder erweitern.

### Zugriffsregeln in PROJ-1
- Angemeldete Personen sehen **ihr eigenes** Profil
- Angemeldete Personen sehen die Praxis, zu der sie gehören
- Ohne Anmeldung ist nichts sichtbar
- **Kein Schreibzugriff über die Anwendung** — Anlegen und Ändern ausschließlich per Seed-Skript oder Supabase-Dashboard

Feinere Regeln je Rolle folgen mit PROJ-19.

---

## Geplant, aber NICHT spezifiziert

Aus dem Ursprungskonzept §27 als Kern-Entitäten benannt. **Feldstrukturen, Beziehungen und Zugriffsregeln sind offen** — sie entstehen mit der jeweiligen Feature-Spec.

| Entität | Entsteht mit | Bekannte Anforderung |
|---|---|---|
| `Patient` | PROJ-4 | **Muss Telefonnummern enthalten** — sonst kann PROJ-29 (Anrufer-Erkennung) nicht nachschlagen. Nummern in E.164 normalisiert. |
| `Appointment` | PROJ-5 | Status: bestätigt, abgesagt, No-Show, verschoben, abgeschlossen |
| `Treatment` | offen | |
| `Transcript` | PROJ-14 | Zuordnung über Patienten-ID und Termin-ID |
| `Quote` (Kostenvoranschlag) | PROJ-16 | |
| `InvoiceReference` | offen | nur Referenz — Abrechnung bleibt in der Praxissoftware |
| `Task` | PROJ-9 | |
| `Communication` | PROJ-13 | |
| `Automation` | PROJ-10 | Trigger → Bedingung → Aktion |
| `AutomationEvent` | PROJ-10 | |
| `Recall` | PROJ-13 | |
| `PatientMetric` | PROJ-17 | Termintreue, PZR-Frequenz, CLV, Conversion |
| `Integration` | PROJ-3 | Sync-Status, Fehlerprotokoll, Retry |
| `AuditEvent` | PROJ-19 | |

---

## Externe Mock-PVS-Quelle (PROJ-2)

PROJ-2 definiert bewusst **keine** DentPilot-Tabelle, Migration oder Supabase-RLS-Policy. Der eigenständige Mock-PVS-Service hält nur flüchtige, synthetische Quellfixtures für Patienten und Termine. Sein Vertrag steht in [`features/PROJ-2-mock-pvs-service.md`](../../features/PROJ-2-mock-pvs-service.md).

Die externen PVS-Kennungen werden erst in PROJ-3 einem Integrationskontext und später in PROJ-4 beziehungsweise PROJ-5 internen, praxisgebundenen Tabellen zugeordnet. Das Mock-PVS darf nicht als Vorgriff auf dieses interne Datenmodell gelesen werden.

---

## Hinweis zur Datenminimierung

Aus dem Ursprungskonzept §18: **Daten nur importieren, wenn sie tatsächlich für eine Funktion benötigt werden.** Patientenbezogene Kennzahlen (Termintreue, PZR-Historie, Rechnungen, CLV, Behandlungsinformationen, Kommunikationshistorie) sind personenbezogene Daten und erfordern Aufbewahrungsregeln sowie ein Löschkonzept — beides vor dem Pilotbetrieb zu definieren.
