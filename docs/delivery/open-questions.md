# Open Questions

Unerledigte Punkte, die vor der betroffenen Arbeit beantwortet werden müssen. **Nichts hiervon wurde geraten** — was hier steht, ist tatsächlich unentschieden.

## Blockiert eine konkrete Aufgabe

| Frage | Blockiert | Aufgeworfen | Anmerkung |
|---|---|---|---|
| Supabase-Projekt muss auf supabase.com angelegt werden | **PROJ-1 kann nicht fertiggestellt werden** | 2026-08-24 | Erfordert Kontoerstellung, nicht automatisierbar. Danach werden drei Werte gebraucht (siehe `docs/architecture/overview.md`). |
| Bekommen wir API-Zugang zu Dampsoft, und zu welchen Konditionen? | PROJ-23 | 2026-08-24 | Direktkontakt (support@dampsoft.de) nötig, NDA/Partnervertrag wahrscheinlich. Hinweise auf ein kostenpflichtiges „API/SBI"-Modul, Umfang unbestätigt. Ausweichoptionen: Evident (wirbt mit REST-API), Middleware-Anbieter (Dr. Flex, Dentero, iie Systems, Nelly), RPA als Notlösung. |
| Welche Telefonanlage nutzt die Pilotpraxis? | PROJ-29 | 2026-08-24 | Entschieden: Entwicklung gegen einen generischen Anruf-Webhook, echte Anbindung später als Adapter. Cloud-PBX (Placetel, sipgate, 3CX) böte Webhooks; lokale Anlage mit TAPI bräuchte einen Windows-Client. |
| Wie geht das Mock-PVS mit Telefonnummern um? | PROJ-2, PROJ-4 | 2026-08-24 | **Muss schon im MVP berücksichtigt werden**, sonst ist das Datenmodell für PROJ-29 nachträglich zu erweitern. Normalisierung auf E.164 erforderlich. |

## Produktentscheidungen offen

- [ ] **Ab wann und nach welcher Zeitspanne greift die Sitzungssperre?** (PROJ-31) Muss vor dem Pilotbetrieb mit echten Patientendaten entschieden sein.
- [ ] **Passwortregeln** über den Supabase-Standard hinaus? Bei synthetischen Daten unkritisch, vor Pilotbetrieb zu klären.
- [ ] **Kann eine Person mehreren Praxen angehören?** Bestimmt, ob die Praxiszugehörigkeit am Profil hängt oder eine Zuordnungstabelle braucht (PROJ-24).
- [ ] **Umgang mit mehrdeutigen Rufnummern-Treffern** (PROJ-29): gemeinsame Familien-Festnetznummer, mehrere Patienten pro Nummer, unbekannte oder unterdrückte Nummer.
- [ ] **Wer darf das Anrufer-Popup sehen?** (PROJ-29, Rollenrechte)
- [ ] **Rolle zusätzlich im Anmelde-Token hinterlegen?** Spart bei PROJ-19 Datenbankabfragen, erfordert aber zusätzliche Supabase-Konfiguration.

## Datenschutz, Sicherheit und KI — vor echten Daten zu klären

- [ ] Wer ist je Datenfluss Verantwortlicher, Auftragsverarbeiter oder gemeinsam Verantwortlicher?
- [ ] Welche konkrete Rechtsgrundlage und Art.-9-Ausnahme gilt für Termin-, Transkript-, Kommunikations-, Analyse- und KI-Verarbeitung?
- [ ] Welche Aufbewahrungs- und Löschfristen gelten je Datenkategorie und gesetzlicher Dokumentationspflicht?
- [ ] Welche Regionen, Subprozessoren und Drittlandzugriffe haben Supabase, Vercel, Soniox, IONOS, Resend und Fehlertracking?
- [ ] Wer führt und genehmigt die Datenschutz-Folgenabschätzung und das Real-Data-Gate?
- [ ] Welche MFA-, Inaktivitäts-, Maximalsitzungs- und Re-Authentisierungswerte gelten für Praxisarbeitsplätze?
- [ ] Welche KI-Funktionen fallen unter welche AI-Act-Klasse, und kann PROJ-15/16 aufgrund des beabsichtigten Zwecks Medizinprodukterecht berühren?
- [ ] Welche Inhalte dürfen externe KI-Anbieter verarbeiten, wie werden sie pseudonymisiert, und ist Training/Retention vertraglich ausgeschlossen?

## Nicht spezifiziert — betrifft alle UI-Features

- [ ] **Barrierefreiheit:** kein Zielstandard festgelegt, keine Anforderungen an Tastaturbedienung, Kontraste oder Screenreader.
- [ ] **Responsive-Verhalten:** Der Referenz-Prototyp ist auf 1520 px ausgelegt. Ob die Anwendung auf Tablet oder Telefon nutzbar sein soll, ist offen.
- [ ] **Langfristige Abdeckungsziele:** PROJ-1 legt Unit-, pgTAP-/RLS- und E2E-Schichten fest; projektweite Coverage-Schwellen bleiben offen.
- [ ] **Kein visueller Entwurf für Anmelde- und Statusseite** (PROJ-1). Das Design-System liefert Tokens und Komponentenmuster; da beide Screens schlicht sind, dürfte das unkritisch sein.

## Risiken (keine Frage, aber bekannte Gefahr)

- [ ] **Nur 1 von 31 Features ist spezifiziert.** Für alle übrigen fehlen User Stories und Akzeptanzkriterien. Wer ohne Spec baut, baut auf Vermutungen.
- [ ] **Kein Test im Repository.** `npm test` endet aktuell mangels Testdateien mit Exit 1 und zeitverzögertem Vitest-Abschluss — das ist kein Sicherheitsnetz.
- [ ] **Ein einzelner Entwickler** ohne Ausfallschutz.
- [ ] **Vercel-Konto muss vor dem Deploy manuell angelegt werden** (aus der Git-Historie: Commit 21a97bb).

## Annahmen dieses Handoff-Laufs
_Von Claude gefüllte Lücken, nicht vom Nutzer bestätigt. Bitte prüfen und korrigieren._

- [x] **Env-Beispieldatei geklärt:** `.env.local.example` ist die verbindliche, versionierbare Datei und wird mit PROJ-1 angelegt. `.env.local` bleibt ignoriert und enthält die echten lokalen Werte.
- [ ] **Die Zuordnung geplanter Entitäten zu Features** in `docs/architecture/data-model.md` (z. B. `Task` → PROJ-9) ist aus den Feature-Namen abgeleitet, nicht aus einer Spec. Sie ist plausibel, aber nicht bestätigt.
- [ ] **Die absehbaren Schnittstellen** in `docs/architecture/api-contracts.md` sind aus Feature-Beschreibungen abgeleitet. Kein Format wurde abgestimmt.
