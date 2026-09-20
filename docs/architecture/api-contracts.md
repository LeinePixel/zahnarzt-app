# API Contracts

**Sicherheitsfortsetzung 07.09.2026:** Aktuelle Arbeitspakete und Abnahmekriterien stehen im [Security-Umsetzungsplan](../superpowers/plans/2026-09-07-security-remediation.md). Der [Anforderungsentwurf](../superpowers/specs/2026-09-07-security-remediation-design.md) beschreibt geplante Ergänzungen; heutige Runtime-/RPC-/Datenverträge bleiben bis zur Implementierung unverändert. MFA/Re-Authentisierung und weitere Echtbetriebs-Gates sind weiterhin offen.

## Status: Server Actions und PROJ-19-RPC-Verträge implementiert

Es existieren keine eigenen Next.js-API-Routen unter `src/app/api/`. PROJ-1 verwendet Server Actions; PROJ-19 ergänzt Server Actions und zweckgebundene Supabase-RPCs.

Das ist kein Versäumnis, sondern folgt aus zwei Entscheidungen:

**1. PROJ-1 braucht bewusst keine API-Routen.** Anmelden und Abmelden laufen über Next.js Server Actions direkt gegen Supabase. Eine zusätzliche API-Schicht würde nur durchreichen und nichts beitragen. Siehe `decisions.md`.

**2. PROJ-19 besitzt eine verbindliche Spec und implementierte RPC-Verträge.** Die übrigen Roadmap-Features erhalten ihre Verträge mit der jeweiligen Spezifikation.

## Implementierte PROJ-19-Schnittstellen

Verbindliche Rollen, Laufzeiten und Auditregeln: [PROJ-19-Spec](../../features/PROJ-19-audit-logging-and-role-permissions.md). Die aktuellen SQL-Signaturen und Autorisierungsprüfungen stehen in der [Forward-Migration](../../supabase/migrations/20260902203000_proj_19_forward_security_hardening.sql); die serverseitige Validierung und Rückgabeprüfung in [support-access.ts](../../src/features/audit/support-access.ts) und [read-events.ts](../../src/features/audit/read-events.ts).

| RPC | Eingabe | Rückgabe / verweigertes Ergebnis |
|---|---|---|
| `is_portal_admin` | keine | Boolean für die eigene Anbieteridentität |
| `request_support_access` | `p_requested_duration_hours`: ganze Stunden, Standard 8, Bereich 1–24 | undurchsichtige Freigabe-UUID / `null` |
| `activate_support_access` | `p_grant_id`: UUID; `p_reason`: `technical_investigation` oder `account_support` | Objekt mit `practice_id` und `expires_at` / `null` |
| `revoke_support_access` | `p_grant_id`: UUID | `true` / `false` |
| `read_audit_events` | `p_practice_id`: UUID; `p_before`: Zeitpunkt; `p_limit`: 1–100 | begrenzte Ereigniszeilen / keine Zeilen |
| `record_denied_audit_read` | keine | `false`; protokolliert den verweigerten Leseversuch |

Die Server-Schicht prüft Claims und Fähigkeiten, validiert Eingaben und behandelt neutrale Verweigerungen ohne Existenz- oder Berechtigungsdetails. PostgreSQL prüft Identität, Praxis, Freigabe und Ablauf erneut und schreibt das Audit in derselben Transaktion. Audit-Schreibfehler lassen die geschützte Operation fehlschlagen. Siehe [ADR-0002](../adr/0002-denied-support-attempts-return-neutral-results.md).

Praxisadmins legen Freigaben über `/status` an und widerrufen sie dort. Portaladmins aktivieren eine erhaltene ID über `/portal/audit`; es gibt keine Praxis- oder Freigabesuche. Siehe [ADR-0003](../adr/0003-support-grants-are-activated-by-opaque-id.md).

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
