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

## Nicht spezifiziert — betrifft alle UI-Features

- [ ] **Barrierefreiheit:** kein Zielstandard festgelegt, keine Anforderungen an Tastaturbedienung, Kontraste oder Screenreader.
- [ ] **Responsive-Verhalten:** Der Referenz-Prototyp ist auf 1520 px ausgelegt. Ob die Anwendung auf Tablet oder Telefon nutzbar sein soll, ist offen.
- [ ] **Teststrategie:** keine Abdeckungsziele, keine Festlegung was Unit- vs. E2E-Test sein soll, kein Vorgehen für Supabase in Tests.
- [ ] **Kein visueller Entwurf für Anmelde- und Statusseite** (PROJ-1). Das Design-System liefert Tokens und Komponentenmuster; da beide Screens schlicht sind, dürfte das unkritisch sein.

## Risiken (keine Frage, aber bekannte Gefahr)

- [ ] **Nur 1 von 31 Features ist spezifiziert.** Für alle übrigen fehlen User Stories und Akzeptanzkriterien. Wer ohne Spec baut, baut auf Vermutungen.
- [ ] **Kein Test im Repository.** `npm test` läuft grün, weil nichts existiert — das ist kein Sicherheitsnetz.
- [ ] **Ein einzelner Entwickler** ohne Ausfallschutz.
- [ ] **Vercel-Konto muss vor dem Deploy manuell angelegt werden** (aus der Git-Historie: Commit 21a97bb).

## Annahmen dieses Handoff-Laufs
_Von Claude gefüllte Lücken, nicht vom Nutzer bestätigt. Bitte prüfen und korrigieren._

- [ ] **`.env.example` konnte nicht angelegt werden** — `.env`-Dateien sind durch die Berechtigungseinstellungen gesperrt. Die Variablennamen sind stattdessen in `docs/architecture/overview.md` dokumentiert. Die vorhandene `.env.local.example` konnte aus demselben Grund nicht gelesen werden; ob sie bereits alle drei Variablen enthält, ist ungeprüft.
- [ ] **Die Zuordnung geplanter Entitäten zu Features** in `docs/architecture/data-model.md` (z. B. `Task` → PROJ-9) ist aus den Feature-Namen abgeleitet, nicht aus einer Spec. Sie ist plausibel, aber nicht bestätigt.
- [ ] **Die absehbaren Schnittstellen** in `docs/architecture/api-contracts.md` sind aus Feature-Beschreibungen abgeleitet. Kein Format wurde abgestimmt.
