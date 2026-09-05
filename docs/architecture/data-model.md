# Data Model

## Status
**Die zwei Tabellen aus PROJ-1 und die eng begrenzten PROJ-19-Entitäten sind spezifiziert.** Alles Weitere ist eine Liste geplanter Entitäten ohne Feldstruktur und entsteht erst mit der jeweiligen bindenden Feature-Spezifikation.

**Codex: keine Tabellen anlegen, die hier oder in einer bindenden Feature-Spezifikation nicht spezifiziert sind.** Jedes Feature bringt seine eigenen mit, wenn es spezifiziert wird.

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

### PROJ-19: getrennte Anbieteridentität und Audit-Entitäten

PROJ-19 ergänzt ausschließlich die für Autorisierung, Audit und zeitlich begrenzten Anbieter-Support nötigen Entitäten. Das verbindliche Feld- und Zugriffsmodell steht in [`features/PROJ-19-audit-logging-and-role-permissions.md`](../../features/PROJ-19-audit-logging-and-role-permissions.md); dieses Dokument wiederholt es nicht.

- `portal_admin` ordnet ein Supabase-Auth-Konto einer Anbieteridentität zu; es hat keine `practice_id` und keine Praxisrolle.
- `support_access_grant` hält die von einem `praxisadmin` veranlasste, widerrufbare Freigabe für genau eine Praxis samt Aktivierung, Ablaufzeit und technischem Supportbezug.
- `audit_event` enthält nur die in PROJ-19 erlaubten technischen Metadaten und wird nach 90 Tagen datenbankseitig gelöscht.

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
| `AuditEvent` | PROJ-19 | spezifiziert; siehe PROJ-19-Feature-Spec |

---

## Hinweis zur Datenminimierung

Aus dem Ursprungskonzept §18: **Daten nur importieren, wenn sie tatsächlich für eine Funktion benötigt werden.** Patientenbezogene Kennzahlen (Termintreue, PZR-Historie, Rechnungen, CLV, Behandlungsinformationen, Kommunikationshistorie) sind personenbezogene Daten und erfordern Aufbewahrungsregeln sowie ein Löschkonzept — beides vor dem Pilotbetrieb zu definieren.
