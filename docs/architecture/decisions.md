# Decision Log

Jede folgenreiche Entscheidung dieses Projekts mit Begründung — damit nichts erneut ausdiskutiert wird, was bereits entschieden ist. Zusammengeführt aus den Decision-Log-Abschnitten der Feature-Specs und den projektweiten Festlegungen aus `docs/PRD.md`.

**Bestehende Zeilen nie ändern** — nur neue anfügen oder als überholt markieren.

---

## Nicht verhandelbare Rahmenbedingungen

| Rahmenbedingung | Warum | Quelle |
|---|---|---|
| Supabase als Backend (PostgreSQL + Auth + Storage) | Vom Nutzer festgelegt; passt zum relationalen Datenmodell und liefert Auth und RLS mit | PRD Constraints |
| DentPilot wird **nicht** Source of Truth für medizinische Daten | Die Praxissoftware bleibt führend für Patient, Behandlung, Abrechnung, Termine. Andernfalls wird das Integrationsmodell unbeherrschbar und das Produkt driftet zum vollständigen PVS. | PRD Constraints, Ursprungskonzept §19 |
| MVP arbeitet ausschließlich mit synthetischen Testdaten | Kein DSGVO-Zeitdruck während der Entwicklung; echte Daten erst im Pilotbetrieb (Phase 6) | PRD Constraints |
| Ein einzelner Entwickler | Die zweite Person im Projekt ist Zahnarzt und liefert Fachwissen, entwickelt nicht mit. Jede Aufgabe muss für eine Person tragbar bleiben. | PRD Constraints |
| Deutsch als Oberflächensprache | Zielgruppe sind deutsche Zahnarztpraxen | PROJ-1 Spec |
| shadcn/ui-Komponenten werden nie nachgebaut | 35 Komponenten sind bereits installiert | CLAUDE.md |

---

## Projektweite Entscheidungen

| Entscheidung | Begründung | Alternativen | Datum | Quelle |
|---|---|---|---|---|
| Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui | Vorgabe des Starter-Kit-Templates | keine diskutiert | — | CLAUDE.md |
| Zielsystem der PVS-Integration: **Dampsoft** | Marktführer im deutschen Dentalmarkt | Evident, CGM Z1, ivoris — als Ausweichoptionen dokumentiert | 2026-08-24 | PRD |
| **Mock-PVS-Service statt echter PVS-Anbindung im MVP** | Recherche ergab: kein deutscher PVS-Anbieter bietet eine öffentlich zugängliche REST-API. Alle erfordern Partnerschaftsanfrage inkl. NDA. Ein echter Dampsoft-Zugang ist kurzfristig nicht zu erwarten. Der Mock erlaubt, die gesamte Anwendung zu bauen, während die API-Beschaffung parallel läuft. | Direktkontakt abwarten (blockiert alles); Middleware-Anbieter (Dr. Flex, Dentero); RPA/Screen-Scraping | 2026-08-24 | PRD, INDEX.md Notiz zu PROJ-23 |
| Adapter-Muster für alle PVS-Anbindungen | Umstieg auf die echte API wird ein Adapter-Austausch, kein Umbau der Anwendung | direkt gegen die Hersteller-API programmieren | 2026-08-24 | PRD, Ursprungskonzept §21 |
| Transkription: **Soniox**, MVP verarbeitet fertige Zusammenfassungen | Tool bereits im Einsatz. Rohtranskript-Verarbeitung folgt als PROJ-22. | eigene Zusammenfassung von Beginn an | 2026-08-24 | PRD |
| Interne KI-Aufgaben: **IONOS AI Model Hub** | Vom Nutzer festgelegt. Getrennt von Soniox, das nur transkribiert. | — | 2026-08-24 | PRD |
| E-Mail-Versand: **Resend** | Gute Entwicklererfahrung, günstig, passt zum Next.js/Vercel-Stack | — | 2026-08-24 | PRD |
| **Single-Tenant-Start**, Datenmodell aber Multi-Tenant-vorbereitet | Volle Mandantenfähigkeit im MVP wäre unnötige Komplexität bei einer Testpraxis. Nachträgliches Einziehen der Trennung ist jedoch teuer — daher `practice`-Entität und `practice_id`-Konvention von Beginn an. | sofort Multi-Tenant; reines Single-Tenant ohne Vorbereitung | 2026-08-24 | PRD |
| **KI extrahiert, Regeln entscheiden** | Nicht die gesamte Kostenvoranschlagslogik gehört in die KI. Die KI liest Behandlungsart und Zahn aus dem Gespräch; die Regel-Engine bestimmt Positionen, Preise, Vorlagen und Folgeaufgaben. So bleibt der Prozess nachvollziehbar, reproduzierbar, auditierbar und korrigierbar. | KI entscheidet durchgängig | 2026-08-24 | Ursprungskonzept §14 |
| Transparente Einzelkennzahlen statt eines Blackbox-Scores | „Patient Score: 87/100" ist für Praxispersonal nicht nachvollziehbar. Stattdessen Termintreue, PZR-Compliance, KV-Conversion, CLV, Praxisbindung — jeweils mit den zugrundeliegenden Zahlen. | einzelner aggregierter Score | 2026-08-24 | Ursprungskonzept §12 |
| Visuelle Richtung **„Klinisch Hell"** | Aus drei Varianten gewählt. Ruhig und zurückhaltend, weil die Rezeption acht Stunden am Tag damit arbeitet. | „Cockpit Dunkel" (schlecht lesbar in hellen Praxisräumen); „Warm mit Orange" | 2026-08-24 | docs/design/design-system.md |
| UX-Aufbau **„Seiten-Navigation"** | Aus drei klickbaren Prototypen gewählt. Sofort verständlich für Praxispersonal, jede Seite hat Platz für Tiefe, Ansichten sind per Link teilbar. | „Split-View" (schnelleres Abarbeiten, aber schmaleres Detail); „Tagesfluss" (innovativ, aber weit von gewohnter Praxissoftware entfernt) | 2026-08-24 | docs/design/design-system.md |
| Kein Dark Mode im MVP | Nicht benötigt; die gewählte Richtung ist bewusst hell | | 2026-08-24 | docs/design/design-system.md |

---

## Feature-Entscheidungen

### PROJ-1: Supabase Infrastructure Setup

**Produktentscheidungen**

| Entscheidung | Begründung | Datum |
|---|---|---|
| Login ist Teil von PROJ-1, nicht ein eigenes Feature | Reine Infrastruktur wäre weder testbar noch abnehmbar. Mit Login ist PROJ-1 ein prüfbares Stück Software, auf das alle Folge-Features aufsetzen können. | 2026-08-24 |
| PROJ-1 klärt Identität, PROJ-19 klärt Rechte | Trennlinie „Wer bist du?" vs. „Was darfst du?". Hielte PROJ-1 auch die Rechtedurchsetzung, bliebe für PROJ-19 nichts übrig. Rechte lassen sich zudem sinnvoll erst gegen existierende Features durchsetzen. | 2026-08-24 |
| Drei Rollen: `rezeption`, `behandler`, `praxisadmin` | Entspricht den Nutzergruppen der PRD. Weitere Rollen später ergänzbar. | 2026-08-24 |
| Nur `practice` und `user_profile` im Schema | Alle anderen Tabellen gehören zu noch nicht spezifizierten Features. Vorab geratene Strukturen müssten umgebaut werden — Migrationen auf laufender Datenbank sind teurer als das Anlegen. | 2026-08-24 |
| `practice`-Entität und `practice_id`-Konvention von Anfang an | Nachträgliches Einziehen einer Mandantentrennung ist deutlich teurer als das Mitführen von Beginn an. | 2026-08-24 |
| RLS auch im Single-Tenant-Betrieb aktiv | Wer RLS erst später aktiviert, entdeckt die dadurch brechenden Abfragen zum spätestmöglichen Zeitpunkt. | 2026-08-24 |
| Keine Selbstregistrierung; Konten per Seed-Skript und Supabase-Dashboard | Ein Entwickler mit einer synthetischen Testpraxis — eine Benutzerverwaltung wäre Aufwand für ein noch nicht vorhandenes Problem (→ PROJ-30). | 2026-08-24 |
| Kein App-Grundgerüst in PROJ-1 | Hält PROJ-1 klein. Das Grundgerüst nach Design-System entsteht mit dem ersten UI-Feature (PROJ-6). | 2026-08-24 |
| Dauerhafte Sitzung, keine Inaktivitätssperre im MVP | Mit synthetischen Testdaten kein Risiko. Vor dem Pilotbetrieb zwingend nachzuholen (→ PROJ-31) — Rezeptionsrechner stehen im halböffentlichen Bereich. | 2026-08-24 |
| Keine Offenlegung, ob eine E-Mail-Adresse existiert | Verhindert das Ausspähen, welche Personen Konten besitzen. | 2026-08-24 |

**Technische Entscheidungen**

| Entscheidung | Begründung | Datum |
|---|---|---|
| Zusätzliches Paket `@supabase/ssr`, Sitzung in Cookies statt Browser-Speicher | Das vorhandene Paket legt die Sitzung im Browser-Speicher ab. Server-Komponenten und die Middleware von Next.js sehen den Browser-Speicher nicht — Seiten ließen sich damit nicht serverseitig schützen. Cookies gehen bei jeder Anfrage automatisch mit. | 2026-08-24 |
| Zugriffsschutz zentral im Next.js-16-Proxy plus erneute Prüfung in geschützten Server-Komponenten | Der Proxy aktualisiert Cookies und verhindert frühe Inhaltsauslieferung; serverseitige Claims-Prüfung und RLS bleiben zusätzliche Vertrauensgrenzen. | 2026-08-24; aktualisiert 2026-08-25 |
| Keine eigenen API-Routen; Anmelden/Abmelden über Server Actions | Eine zusätzliche API-Schicht würde nur durchreichen und nichts beitragen. | 2026-08-24 |
| Drei getrennte Supabase-Zugangsdateien (Browser, Server, Middleware) | Die drei Umgebungen haben unterschiedlichen Cookie-Zugriff. Eine gemeinsame Datei funktionierte in allen drei Fällen nur halb. | 2026-08-24 |
| Profil in eigener Tabelle statt im Supabase-Anmeldebereich | Der Anmeldebereich von Supabase lässt sich nicht um eigene Felder wie Rolle oder Praxiszugehörigkeit erweitern. | 2026-08-24 |
| Gehostetes Supabase-Projekt als Cloud-Ziel; lokales Docker-Supabase für Migrationen und RLS-Tests | Cloud-Architektur und EU-Region bleiben bestehen. Der lokale, reproduzierbare Stack ermöglicht Reset- und Negativtests ohne Cloud-Geheimnisse oder echte Daten. | 2026-08-24; aktualisiert 2026-08-25 |
| Schreibrechte auf `practice` und `user_profile` vollständig gesperrt | Konten entstehen ausschließlich per Seed-Skript und Dashboard. Was die Anwendung nicht darf, kann sie nicht versehentlich kaputtmachen. | 2026-08-24 |
| Seed-Skript läuft nur auf der Kommandozeile | Es benötigt den Verwaltungsschlüssel, der alle Zugriffsregeln umgeht. Dieser darf nie in den Browser gelangen. | 2026-08-24 |
| Anwendung bricht bei fehlenden Umgebungsvariablen sofort mit Klartextmeldung ab | Sonst scheitert die Anmeldung später an unklarer Stelle mit irreführender Fehlermeldung. | 2026-08-24 |
| Ersetzt die Platzhalter-Datei `src/lib/supabase.ts` | Sie exportiert aktuell `null` und würde bei Verwendung zu Laufzeitfehlern führen. | 2026-08-24 |
| Kein Einsatz echter Patientendaten vor dokumentiertem Real-Data-Gate | Gesundheitsdaten besitzen hohen Schutzbedarf. Synthetische Entwicklung darf nicht zu einem unsicheren späteren Architekturwechsel führen. | 2026-08-25 |
| KI bereitet ausschließlich vor; Human Oversight bleibt verbindlich | Verhindert autonome medizinische oder wesentlich wirkende Entscheidungen und schafft eine klare Grundlage für DSGVO-/AI-Act-Prüfung. | 2026-08-25 |
| `getClaims()` statt `getSession()` als serverseitiger Vertrauensanker | Cookie-Inhalte können manipuliert sein; Claims müssen kryptografisch verifiziert werden. | 2026-08-25 |

### PROJ-2 bis PROJ-18 und PROJ-20 bis PROJ-31
Keine Entscheidungen protokolliert — diese Features haben noch keine Spec. Siehe `docs/product/scope.md`.

### PROJ-19: Audit Logging & Rollenrechte

| Entscheidung | Begründung | Datum |
|---|---|---|
| Audit-Einsicht nur mit praxisfreigegebenem `portaladmin` | Die drei Praxisrollen erhalten keine interne Kontrollrolle. Ein Anbieterzugriff bleibt auf eine Praxis, einen Supportzweck und eine Ablaufzeit beschränkt. | 2026-08-26 |
| `portaladmin` ist eine separate Anbieteridentität | Eine vierte Praxisrolle würde eine globale Superuser-Rolle nahelegen und die Praxiszugehörigkeit vermischen. | 2026-08-26 |
| Supportzugriff acht Stunden standardmäßig, maximal 24 Stunden | Ein Supportfall kann länger offen sein; direkter Zugriff muss aber regelmäßig verfallen und erneut von der Praxis freigegeben werden. | 2026-08-26 |
| Audit-Export und Freitextsuche bleiben gesperrt | Auditdaten dürfen keinen neuen Datenabfluss oder unkontrollierte Inhaltsdaten erzeugen. | 2026-08-26 |
| Audit-Ereignisse werden nach 90 Tagen automatisch gelöscht | Bestätigte MVP-Produktentscheidung; die Rechts- und Aufbewahrungsprüfung vor echten Daten bleibt offen. | 2026-08-26 |
| Kein Break-Glass-Zugang im MVP | Es gibt keine klinisch kritischen Abläufe; ein Notfallzugang benötigt später eine eigene Risikoentscheidung. | 2026-08-26 |

---

## Offene Präferenzen
_Tendenzen, die noch nicht festgezurrt sind. Codex kann mit dem genannten Standard arbeiten, sollte aber melden, wenn es relevant wird._

| Thema | Aktuelle Tendenz | Warum noch offen |
|---|---|---|
| Rolle zusätzlich im Anmelde-Token hinterlegen | vorerst nein — Rolle wird aus der Datenbank gelesen | Würde bei PROJ-19 Abfragen sparen, erfordert aber zusätzliche Supabase-Konfiguration und ist erst dann relevant |
| Passwortregeln über den Supabase-Standard hinaus | lokal festgelegt: mindestens 12 Zeichen sowie Groß-/Kleinbuchstaben, Ziffern und Sonderzeichen | Cloud-Konfiguration und MFA werden vor Pilotbetrieb im Auth-Hardening-Gate nochmals verbindlich abgeglichen |
| Person gehört mehreren Praxen an | vorerst nein — Praxiszugehörigkeit hängt am Profil | Bei einer Praxis irrelevant; bestimmt aber, ob später eine Zuordnungstabelle nötig wird (PROJ-24) |
