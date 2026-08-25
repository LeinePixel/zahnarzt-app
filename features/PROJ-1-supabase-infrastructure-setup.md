# PROJ-1: Supabase Infrastructure Setup

## Status: In Progress — reviewed 25.08.2026
**Created:** 2026-08-24
**Last Updated:** 2026-08-25
**Priority:** P0 (MVP)

## Zusammenfassung
Fundament der Anwendung: Supabase-Projekt, Datenbank-Grundlagen und ein funktionierender Login. Am Ende kann sich ein Praxisteam-Mitglied mit E-Mail und Passwort anmelden, sieht mit welchem Konto und welcher Rolle es arbeitet, und kann sich wieder abmelden. Ohne Anmeldung ist die Anwendung nicht zugänglich.

Bewusst klein geschnitten: PROJ-1 klärt **wer jemand ist**, nicht **was jemand darf** (das ist PROJ-19), und legt nur die Tabellen an, die der Login braucht — jedes Folge-Feature bringt seine eigenen mit.

## Dependencies
- None — dies ist das Basis-Feature, auf dem alle datenhaltenden Features aufsetzen.

## User Stories
- Als **Mitarbeiterin der Rezeption** möchte ich mich mit E-Mail und Passwort anmelden, damit ich Zugriff auf die Anwendung bekomme.
- Als **angemeldete Nutzerin** möchte ich sehen, mit welchem Konto und welcher Rolle ich angemeldet bin, damit ich weiß, in wessen Namen ich arbeite.
- Als **angemeldete Nutzerin** möchte ich mich abmelden können, damit niemand an meinem Arbeitsplatz mit meinem Konto weiterarbeitet.
- Als **Praxisleitung** möchte ich, dass ohne Anmeldung keine Anwendungsseite erreichbar ist, damit Patientendaten geschützt sind.
- Als **Entwickler** möchte ich nach dem Klonen des Projekts per Skript eine Testpraxis mit Demo-Konten anlegen können, damit ich ohne manuelle Vorbereitung arbeitsfähig bin.
- Als **Entwickler** möchte ich eine verbindliche Schema- und Migrationskonvention vorfinden, damit alle Folge-Features dieselbe Struktur nutzen und die spätere Multi-Tenant-Migration möglich bleibt.

## Umfang

### Datenmodell
Nur zwei Entitäten:

**`practice`** — die Praxis als Mandant. Existiert von Beginn an, obwohl der MVP nur eine einzige Praxis kennt (siehe PRD, Tenancy-Entscheidung). Mindestens: Name, Anlagedatum.

**`user_profile`** — Profildaten zum Supabase-Auth-Konto: Zugehörigkeit zur Praxis, Anzeigename, Rolle.

**Rollen (Aufzählung, fest):** `rezeption`, `behandler`, `praxisadmin`
Die Rolle wird in PROJ-1 nur gespeichert und angezeigt — sie schränkt noch nichts ein.

### Verbindliche Konventionen für alle Folge-Features
- Jede zukünftige Tabelle mit Praxisbezug erhält eine `practice_id` als Fremdschlüssel
- Row Level Security ist auf **jeder** Tabelle aktiviert, auch im Single-Tenant-Betrieb
- Migrationen sind versioniert und im Repository abgelegt
- Eine dokumentierte Namenskonvention für Tabellen und Spalten

### Anmeldung
- Anmeldeseite mit E-Mail und Passwort
- Geschützter Bereich, der ohne gültige Sitzung nicht erreichbar ist
- Schlichte Seite nach der Anmeldung: Anzeigename, Rolle, Praxisname, Abmelde-Schaltfläche
- Sitzung bleibt über das Schließen des Browsers hinaus bestehen und wird im Hintergrund erneuert

### Einrichtung
- Dokumentierte Umgebungsvariablen (`.env.local.example` aktualisiert und versioniert)
- Seed-Skript legt eine Testpraxis und je ein Demo-Konto pro Rolle an

## Out of Scope
Bewusst **nicht** Teil dieses Features:

- **Rechtedurchsetzung und Audit-Log** — die Rolle wird gespeichert und angezeigt, schränkt aber nichts ein. Jede angemeldete Person sieht dasselbe. → PROJ-19
- **App-Grundgerüst (Sidebar, Navigation, Layout)** — PROJ-1 endet bei einer schlichten Statusseite. → PROJ-6 baut das Grundgerüst nach dem Design-System auf
- **Dashboard** → PROJ-18
- **Alle weiteren Tabellen** (Patient, Appointment, Task, Quote, Transcript, Communication, Automation, Recall …) — jedes Feature bringt seine eigenen mit
- **Selbstregistrierung** — Praxisteams registrieren sich nicht selbst
- **Benutzerverwaltung im Produkt** (Nutzer anlegen, einladen, deaktivieren) — im MVP über Seed-Skript und Supabase-Dashboard → PROJ-30
- **Passwort-zurücksetzen-Funktion** — im MVP über das Supabase-Dashboard
- **Automatische Sperre nach Inaktivität** — zwingend erforderlich vor dem Pilotbetrieb mit echten Patientendaten → PROJ-31
- **Multi-Tenant-Betrieb** — die `practice_id` wird vorbereitet, aber nicht mehrmandantenfähig genutzt → PROJ-24
- **Zwei-Faktor-Authentifizierung, SSO, Single-Sign-on mit Praxissoftware**

## Acceptance Criteria

**Anmeldung**
- [ ] Angenommen ich bin nicht angemeldet, wenn ich die Anmeldeseite öffne, dann sehe ich Eingabefelder für E-Mail und Passwort sowie eine Schaltfläche zum Anmelden
- [ ] Angenommen ich habe ein gültiges Konto, wenn ich korrekte E-Mail und korrektes Passwort eingebe und absende, dann werde ich angemeldet und auf die geschützte Seite weitergeleitet
- [ ] Angenommen ich habe ein gültiges Konto, wenn ich ein falsches Passwort eingebe, dann sehe ich eine Fehlermeldung, meine eingegebene E-Mail bleibt erhalten und ich bleibe abgemeldet
- [ ] Angenommen ich gebe eine E-Mail-Adresse ein, zu der kein Konto existiert, wenn ich das Formular absende, dann sehe ich dieselbe allgemeine Fehlermeldung wie bei falschem Passwort — es wird nicht offengelegt, ob die Adresse existiert
- [ ] Angenommen ich befinde mich auf der Anmeldeseite, wenn ich das Formular mit leeren Feldern absende, dann wird für jedes Pflichtfeld eine Validierungsmeldung angezeigt und es wird keine Anfrage gesendet
- [ ] Angenommen ich habe eine E-Mail ohne gültiges Format eingegeben, wenn ich das Formular absende, dann sehe ich eine Formatfehlermeldung am E-Mail-Feld
- [ ] Angenommen ich habe das Formular abgesendet und die Antwort steht noch aus, wenn ich erneut auf Anmelden klicke, dann wird keine zweite Anmeldeanfrage ausgelöst

**Zugriffsschutz**
- [ ] Angenommen ich bin nicht angemeldet, wenn ich eine geschützte Seite direkt über die URL aufrufe, dann werde ich zur Anmeldeseite weitergeleitet
- [ ] Angenommen ich bin bereits angemeldet, wenn ich die Anmeldeseite aufrufe, dann werde ich direkt auf die geschützte Seite weitergeleitet
- [ ] Angenommen meine Sitzung ist abgelaufen oder ungültig, wenn ich eine geschützte Seite aufrufe, dann werde ich zur Anmeldeseite weitergeleitet

**Angemeldeter Zustand**
- [ ] Angenommen ich bin angemeldet, wenn ich die geschützte Seite betrachte, dann sehe ich meinen Anzeigenamen, meine Rolle und den Namen meiner Praxis
- [ ] Angenommen ich bin angemeldet, wenn ich den Browser schließe und die Anwendung erneut öffne, dann bin ich weiterhin angemeldet
- [ ] Angenommen ich bin angemeldet, wenn ich auf Abmelden klicke, dann wird meine Sitzung beendet und ich lande auf der Anmeldeseite
- [ ] Angenommen ich habe mich abgemeldet, wenn ich anschließend den Zurück-Knopf des Browsers benutze, dann sehe ich keine geschützten Inhalte, sondern die Anmeldeseite

**Datenbank und Einrichtung**
- [ ] Angenommen das Schema ist eingespielt, wenn ich die Tabellen `practice` und `user_profile` prüfe, dann ist auf beiden Row Level Security aktiviert
- [ ] Angenommen ein Nutzerkonto existiert, wenn ich das zugehörige Profil abrufe, dann ist es genau einer Praxis und genau einer der Rollen `rezeption`, `behandler` oder `praxisadmin` zugeordnet
- [ ] Angenommen ich habe das Projekt frisch geklont und die Umgebungsvariablen gesetzt, wenn ich das Seed-Skript ausführe, dann existieren eine Testpraxis und je ein Demo-Konto pro Rolle, mit denen ich mich sofort anmelden kann
- [ ] Angenommen eine für den jeweiligen Prozess erforderliche Umgebungsvariable fehlt, wenn Anwendung oder Seed-Skript starten, dann erscheint eine verständliche Fehlermeldung mit dem Variablennamen; die Anwendung verlangt niemals den ausschließlich für das Seed-Skript bestimmten Service-Role-Key

**Fehlerfälle**
- [ ] Angenommen Supabase ist nicht erreichbar, wenn ich mich anzumelden versuche, dann sehe ich eine Fehlermeldung, die zwischen „Zugangsdaten falsch" und „Dienst nicht erreichbar" unterscheidet, und meine Eingabe bleibt erhalten
- [ ] Angenommen mein Auth-Konto existiert, aber es ist kein Profil hinterlegt, wenn ich mich anmelde, dann werde ich nicht in einen kaputten Zustand geführt, sondern sehe einen verständlichen Hinweis, dass mein Konto unvollständig eingerichtet ist

## Edge Cases
- **Konto ohne Profil:** Ein über das Supabase-Dashboard angelegtes Auth-Konto ohne zugehörigen `user_profile`-Eintrag. Muss abgefangen werden, sonst läuft die Anwendung in einen undefinierten Zustand.
- **Sitzung in zwei Tabs:** Abmelden in einem Tab, während ein zweiter Tab offen ist — der zweite Tab darf keine geschützten Inhalte weiter anzeigen.
- **Abgelaufenes Token:** Die Sitzung läuft ab, während die Anwendung geöffnet ist. Die automatische Erneuerung muss greifen; schlägt sie fehl, ist zur Anmeldeseite zu leiten.
- **Netzwerkabbruch während der Anmeldung:** Anfrage bricht ab — Formular muss bedienbar bleiben und darf nicht in einem Ladezustand hängen.
- **Doppelter Absende-Klick:** Mehrfaches schnelles Klicken auf Anmelden darf keine parallelen Anfragen erzeugen.
- **Zurück-Navigation nach Abmelden:** Der Browser-Cache darf keine geschützten Inhalte preisgeben.
- **Rolle nachträglich geändert:** Wird die Rolle im Dashboard geändert, während die Person angemeldet ist, gilt die neue Rolle spätestens nach erneuter Anmeldung. (Relevant wird das erst mit PROJ-19.)

## Technical Requirements
- **Sicherheit:** Row Level Security auf allen Tabellen, auch im Single-Tenant-Betrieb. Keine Zugangsdaten im Quellcode — ausschließlich Umgebungsvariablen.
- **Fehlermeldungen:** Bei fehlgeschlagener Anmeldung darf nicht erkennbar sein, ob die E-Mail-Adresse existiert (kein User Enumeration).
- **Datenmodell:** `practice_id` als verbindliche Konvention für alle künftigen Tabellen mit Praxisbezug.
- **Sprache:** Alle Oberflächentexte und Fehlermeldungen auf Deutsch.
- **Browser:** Aktuelle Versionen von Chrome, Firefox, Edge und Safari.

## Open Questions
- [ ] Ab wann greift die automatische Sperre nach Inaktivität, und nach welcher Zeitspanne? Muss vor dem Pilotbetrieb mit echten Patientendaten entschieden und umgesetzt sein (PROJ-31).
- [ ] Werden Passwortregeln über den Supabase-Standard hinaus benötigt (Mindestlänge, Komplexität)? Für synthetische Testdaten unkritisch, vor dem Pilotbetrieb zu klären.
- [ ] Soll eine Person mehreren Praxen angehören können? Für den MVP mit einer Praxis irrelevant, aber die Antwort bestimmt, ob die Praxiszugehörigkeit am Profil hängt oder eine eigene Zuordnungstabelle braucht. Spätestens bei PROJ-24 zu entscheiden.
- [ ] Soll die Rolle zusätzlich im Anmelde-Token hinterlegt werden? Würde bei PROJ-19 Datenbankabfragen bei jeder Rechteprüfung sparen, erfordert aber zusätzliche Supabase-Konfiguration und ist erst dann relevant. (Aufgeworfen im Architektur-Schritt.)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Login ist Teil von PROJ-1, nicht ein eigenes Feature | Reine Infrastruktur wäre weder testbar noch abnehmbar. Mit Login ist PROJ-1 ein echtes, prüfbares Stück Software, und alle Folge-Features können sich auf eine funktionierende Anmeldung verlassen. | 2026-08-24 |
| PROJ-1 klärt Identität, PROJ-19 klärt Rechte | Klare Trennlinie „Wer bist du?" vs. „Was darfst du?". Hielte PROJ-1 auch die Rechtedurchsetzung, bliebe für PROJ-19 nichts übrig. Zudem lassen sich Rechte sinnvoll erst gegen existierende Features durchsetzen. | 2026-08-24 |
| Drei Rollen: `rezeption`, `behandler`, `praxisadmin` | Entspricht den Nutzergruppen der PRD. Weitere Rollen (Abrechnung, Nur-Lesen) bei Bedarf später ergänzbar. | 2026-08-24 |
| Nur `practice` und `user_profile` im Schema | Alle anderen Tabellen gehören zu noch nicht spezifizierten Features. Vorab geratene Strukturen müssten beim Speccen wieder umgebaut werden — Migrationen auf laufender Datenbank sind teurer als das Anlegen. | 2026-08-24 |
| `practice`-Entität und `practice_id`-Konvention von Anfang an | Nachträgliches Einziehen einer Mandantentrennung ist deutlich teurer als das Mitführen von Beginn an (siehe PRD, Tenancy). | 2026-08-24 |
| RLS auch im Single-Tenant-Betrieb aktiv | Wer RLS erst später aktiviert, entdeckt die dadurch brechenden Abfragen zum spätestmöglichen Zeitpunkt. | 2026-08-24 |
| Keine Selbstregistrierung; Konten per Seed-Skript und Supabase-Dashboard | Zwei-Personen-Team mit einer synthetischen Testpraxis — eine Benutzerverwaltung wäre Aufwand für ein noch nicht vorhandenes Problem. | 2026-08-24 |
| Kein App-Grundgerüst in PROJ-1 | Hält PROJ-1 klein und schnell fertig. Das Grundgerüst nach Design-System entsteht mit dem ersten UI-Feature (PROJ-6). | 2026-08-24 |
| Dauerhafte Sitzung, keine Inaktivitätssperre im MVP | Mit synthetischen Testdaten kein Risiko. Vor dem Pilotbetrieb mit echten Patientendaten ist die Sperre jedoch zwingend (PROJ-31) — Rezeptionsrechner stehen im halböffentlichen Bereich. | 2026-08-24 |
| Keine Offenlegung, ob eine E-Mail-Adresse existiert | Verhindert das Ausspähen, welche Personen Konten besitzen. | 2026-08-24 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Zusätzliches Paket `@supabase/ssr`, Sitzung in Cookies statt Browser-Speicher | Das vorhandene Paket allein legt die Sitzung im Browser-Speicher ab. Server-Komponenten und die Zugriffsschutz-Schicht von Next.js sehen den Browser-Speicher nicht — Seiten ließen sich damit nicht serverseitig schützen. Cookies gehen bei jeder Anfrage automatisch mit. | 2026-08-24 |
| Zugriffsschutz zentral im Next.js-16-Proxy statt pro Seite | Neue Features sind automatisch geschützt; der Schutz kann nicht vergessen werden. Zudem keine sichtbaren Inhalte vor der Weiterleitung. In Next.js 16 heißt die frühere Middleware-Konvention `proxy.ts`. | 2026-08-24; aktualisiert 2026-08-25 |
| Keine eigenen API-Routen; Anmelden/Abmelden über Server Actions | Eine zusätzliche API-Schicht würde nur durchreichen und nichts beitragen. | 2026-08-24 |
| Drei getrennte Supabase-Zugangsdateien (Browser, Server, Middleware) | Die drei Umgebungen haben unterschiedlichen Cookie-Zugriff. Eine gemeinsame Datei funktionierte in allen drei Fällen nur halb. | 2026-08-24 |
| Profil in eigener Tabelle statt im Supabase-Anmeldebereich | Der Anmeldebereich von Supabase lässt sich nicht um eigene Felder wie Rolle oder Praxiszugehörigkeit erweitern. | 2026-08-24 |
| Gehostetes Supabase-Projekt als Cloud-Ziel; lokales Docker-Supabase für Migrationen und Sicherheitstests | Die EU-Cloud-Architektur bleibt bestehen. Lokal lassen sich Reset, RLS und Seed reproduzierbar ohne Cloud-Geheimnisse prüfen. | 2026-08-24; aktualisiert 2026-08-25 |
| Schreibrechte auf `practice` und `user_profile` für Browserrollen vollständig gesperrt | Nur die geheime `service_role` darf im CLI-Seed verwalten. Was die Anwendung nicht darf, kann sie auch nicht versehentlich verändern. | 2026-08-24; präzisiert 2026-08-25 |
| Seed-Skript läuft nur auf der Kommandozeile | Es benötigt den Verwaltungsschlüssel, der alle Zugriffsregeln umgeht. Dieser darf niemals in den Browser gelangen. | 2026-08-24 |
| Anwendung bricht bei fehlenden Umgebungsvariablen sofort mit Klartextmeldung ab | Sonst scheitert die Anmeldung später an unklarer Stelle mit irreführender Fehlermeldung. | 2026-08-24 |
| Ersetzt die bisherige Platzhalter-Datei `src/lib/supabase.ts` | Sie exportiert aktuell `null` und würde bei Verwendung zu Laufzeitfehlern führen. | 2026-08-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Erstellt:** 2026-08-24

### Vorbedingung — muss von Hand erledigt werden
Auf **supabase.com** muss ein kostenloses Projekt angelegt werden, bevor mit dem Bauen begonnen werden kann. Das lässt sich nicht automatisieren (Kontoerstellung). Aus dem angelegten Projekt werden drei Werte benötigt: die Projekt-URL, der öffentliche Zugriffsschlüssel und der geheime Verwaltungsschlüssel.

Entschieden wurde: **ein gehostetes Projekt**, kein lokales Supabase. Kein Docker nötig, sofort arbeitsfähig, und der spätere Produktivbetrieb läuft denselben Weg. Da nur eine Person entwickelt, entfällt der übliche Nachteil einer gemeinsam genutzten Datenbank vollständig — es gibt keine parallelen Schema-Änderungen abzustimmen.

### Der zentrale technische Punkt: Sitzungen brauchen Cookies

Das ist die wichtigste Entscheidung dieses Features, weil sie leicht falsch getroffen wird:

Das bereits installierte Supabase-Paket legt die Anmeldesitzung im Browser-Speicher ab. Das funktioniert bei Anwendungen, die vollständig im Browser laufen — **nicht** bei Next.js, wo Seiten auf dem Server erzeugt werden. Der Server sieht den Browser-Speicher nicht und wüsste bei jedem Seitenaufruf nicht, wer da anfragt. Ergebnis wären entweder ungeschützte Seiten oder ein sichtbares Aufblitzen von Inhalten vor der Weiterleitung.

Deshalb kommt ein zweites Supabase-Paket dazu, das die Sitzung in **Cookies** speichert. Cookies gehen bei jeder Anfrage automatisch an den Server mit. Damit kann der Server *vor* dem Ausliefern einer Seite entscheiden, ob jemand sie sehen darf — und das Kriterium „nach Browser-Neustart noch angemeldet" erfüllt sich als Nebeneffekt.

### Zugriffsschutz: eine zentrale Proxy-Schicht

Statt in jeder geschützten Seite einzeln zu prüfen, ob jemand angemeldet ist, übernimmt das eine vorgelagerte Schicht (in Next.js 16 „Proxy"), die passende Anfragen abfängt. Sie aktualisiert Cookies und trifft nur die optimistische Routing-Entscheidung. Jede geschützte Server-Komponente prüft die Identität zusätzlich mit verifizierten Claims; ungeprüfte Daten aus `getSession()` sind keine Autorisierungsgrundlage.

```
Anfrage
   │
   ▼
Türsteher-Schicht
   ├── Sitzung gültig? ──── nein ──► Weiterleitung zur Anmeldeseite
   │
   ├── ja, aber Ziel ist die Anmeldeseite ──► Weiterleitung in die App
   │
   └── ja ──► Seite wird ausgeliefert
              (nebenbei: Sitzung wird verlängert)
```

Der Vorteil: Ein neu gebautes Feature ist automatisch geschützt — man kann es nicht vergessen. Genau das erfüllt die Kriterien „direkter URL-Aufruf leitet weiter" und „bereits Angemeldete überspringen die Anmeldeseite".

### Aufbau der Dateien

```
src/
├── proxy.ts                         Next.js-16-Zugriffsschutz (siehe oben)
│
├── app/
│   ├── login/
│   │   └── page.tsx                 Anmeldeseite
│   ├── status/
│   │   └── page.tsx                 geschützte Seite: Name, Rolle, Praxis, Abmelden
│   └── layout.tsx                   bereits vorhanden
│
├── components/
│   └── auth/
│       ├── login-form.tsx           Formular mit Validierung und Fehleranzeige
│       └── logout-button.tsx        Abmelde-Schaltfläche
│
└── lib/
    └── supabase/
        ├── client.ts                Zugang aus dem Browser
        ├── server.ts                Zugang aus Server-Komponenten
        └── proxy.ts                 Sitzungsverlängerung für den Proxy
                                     (ersetzt die bisherige Platzhalter-Datei
                                      src/lib/supabase.ts)

supabase/
├── migrations/                      versionierte Schema-Änderungen
└── seed.ts                          legt Testpraxis und Demo-Konten an
```

**Warum drei Zugangs-Dateien statt einer:** Browser, Server-Komponenten und die Türsteher-Schicht haben unterschiedlichen Zugriff auf Cookies — der Browser liest sie direkt, der Server bekommt sie pro Anfrage gereicht, die Türsteher-Schicht muss sie zusätzlich zurückschreiben können. Eine gemeinsame Datei würde in allen drei Fällen halb funktionieren.

**Keine eigenen API-Routen nötig.** Anmelden und Abmelden laufen über Next.js Server Actions direkt gegen Supabase. Das spart eine ganze Schicht, die nichts beitragen würde.

### Datenmodell

**Praxis** — die Praxis als Mandant
- Eindeutige Kennung
- Name der Praxis
- Anlagezeitpunkt

**Benutzerprofil** — Zusatzdaten zum Anmeldekonto
- Verweis auf das Anmeldekonto (von Supabase verwaltet)
- Zugehörige Praxis
- Anzeigename
- Rolle: genau einer der Werte `rezeption`, `behandler`, `praxisadmin`
- Anlagezeitpunkt

Die **Anmeldedaten selbst** (E-Mail, Passwort) verwaltet Supabase in einem eigenen, geschützten Bereich. Passwörter sind für die Anwendung zu keinem Zeitpunkt lesbar — deshalb gibt es hier auch kein Passwortfeld.

**Warum zwei getrennte Tabellen und nicht alles in einer:** Der Anmeldebereich von Supabase lässt sich nicht um eigene Felder erweitern. Das Profil ist die eigene Tabelle daneben, verknüpft über die Kontokennung.

### Zugriffsregeln in der Datenbank

Auf beiden Tabellen wird die Zeilenschutz-Funktion von Supabase aktiviert. Sie sorgt dafür, dass die Datenbank selbst Zugriffe verweigert — auch dann, wenn ein Programmierfehler in der Anwendung eine ungeschützte Abfrage stellt. Für PROJ-1 gilt bewusst schlicht:

- Angemeldete Personen sehen **ihr eigenes** Profil
- Angemeldete Personen sehen die Praxis, zu der sie gehören
- Ohne Anmeldung ist nichts sichtbar
- Niemand kann Profile oder Praxen über die Anwendung anlegen, ändern oder löschen — das geschieht ausschließlich über das Seed-Skript oder das Supabase-Dashboard

Feinere Regeln je Rolle folgen mit PROJ-19.

### Demo-Daten

Ein Skript legt beim ersten Einrichten an: eine Testpraxis und drei Konten (eines je Rolle) mit bekannten Zugangsdaten. Es benötigt den **geheimen Verwaltungsschlüssel**, weil nur damit Anmeldekonten erzeugt werden können. Deshalb läuft es ausschließlich auf der Kommandozeile, niemals im Browser. Das Skript ist wiederholbar: Ein zweiter Lauf legt nichts doppelt an.

### Umgebungsvariablen

| Variable | Zweck | Sichtbarkeit |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse des Projekts | öffentlich, unkritisch |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Zugriffsschlüssel für die Anwendung | öffentlich, wirkt nur zusammen mit den Zugriffsregeln |
| `SUPABASE_SERVICE_ROLE_KEY` | Verwaltungsschlüssel für das Seed-Skript | **geheim** — umgeht alle Zugriffsregeln, darf nie in den Browser gelangen und nie ins Repository |
| `SEED_REZEPTION_PASSWORD` | lokales Passwort des synthetischen Rezeptionskontos | **geheim** — nur im CLI-Seed-Prozess |
| `SEED_BEHANDLER_PASSWORD` | lokales Passwort des synthetischen Behandlerkontos | **geheim** — nur im CLI-Seed-Prozess |
| `SEED_PRAXISADMIN_PASSWORD` | lokales Passwort des synthetischen Administrationskontos | **geheim** — nur im CLI-Seed-Prozess |

Fehlt eine für den jeweiligen Prozess erforderliche Variable, bricht dieser mit einer Meldung ab, die den fehlenden Namen benennt. Browser und normaler App-Server benötigen nur URL und öffentlichen Key; ausschließlich das CLI-Seed-Skript verlangt zusätzlich den Service-Role-Key.

### Neue Abhängigkeiten

| Paket | Zweck |
|---|---|
| `@supabase/ssr` | Speichert die Sitzung in Cookies statt im Browser-Speicher — die Grundlage für serverseitigen Zugriffsschutz |
| `supabase` (nur Entwicklung) | Kommandozeilenwerkzeug für versionierte Schema-Änderungen |

Bereits vorhanden und ausreichend: `@supabase/supabase-js`, `zod` und `react-hook-form` (Formularvalidierung), sowie die shadcn/ui-Bausteine `form`, `input`, `label`, `button`, `card` und `alert` — **diese werden nicht neu gebaut**.

### Was an den Akzeptanzkriterien hängt

| Kriterium | Wo es erfüllt wird |
|---|---|
| Leeres Formular, ungültiges E-Mail-Format | Validierung im Formular, noch vor dem Absenden |
| Doppelklick erzeugt keine zweite Anfrage | Schaltfläche wird während des Absendens gesperrt |
| Gleiche Meldung bei falschem Passwort und unbekannter Adresse | Fehlerbehandlung reicht die Supabase-Antwort nicht durch, sondern setzt einen einheitlichen Text |
| „Dienst nicht erreichbar" unterscheidbar von „Zugangsdaten falsch" | Netzwerk-/Dienstfehler wird intern getrennt klassifiziert; technische Details und Kontenexistenz werden nicht offengelegt |
| Direkter URL-Aufruf, abgelaufene Sitzung, Zurück-Knopf | Türsteher-Schicht, mit Anweisung an den Browser, geschützte Seiten nicht zwischenzuspeichern |
| Konto ohne Profil | Die geschützte Seite prüft, ob ein Profil existiert, und zeigt sonst einen erklärenden Hinweis statt eines Absturzes |
| Abmelden in einem Tab wirkt im zweiten | Cookie-basierte Sitzung — der zweite Tab verliert beim nächsten Seitenaufruf den Zugriff |

## QA Test Results
_To be added by /qa_

## Implementation Notes

### Task 1 — abgeschlossen 25.08.2026
- ESLint Flat Config, Typecheck sowie Vitest-/Playwright-Baseline eingerichtet.
- Chromium-, Firefox- und WebKit-Smoke-Tests bestehen.

### Task 2 — abgeschlossen 25.08.2026
- `@supabase/ssr` 0.12.5, Supabase CLI 2.115.0 und `tsx` installiert.
- Öffentliche App-Konfiguration (`src/lib/env.ts`) und geheime Seed-Konfiguration (`supabase/seed-env.ts`) physisch getrennt.
- `.env.local.example` enthält ausschließlich Dummywerte; Service-Key ist im App-Quellbaum nicht referenziert.
- Next.js auf die sicherheitsgepatchte Version 16.3.2 aktualisiert; `npm audit` meldet null bekannte Schwachstellen.

### Task 3 — abgeschlossen 25.08.2026
- Lokale Supabase-Konfiguration und reproduzierbare Migration für `practice`, `user_profile` und `user_role` angelegt.
- Tabellenrechte explizit minimiert: `authenticated` erhält nur `SELECT`; `anon` und beide Browserrollen erhalten keine Schreibrechte.
- RLS begrenzt Lesezugriff auf das eigene Profil und die zugehörige Praxis; fremde Mandanten bleiben unsichtbar.
- 36 pgTAP-Prüfungen belegen Constraints, RLS, anonymen Zugriff, Cross-Tenant-Isolation, blockierte Browser-Schreiboperationen und die explizit begrenzten Verwaltungsrechte der `service_role`.
- Offene Registrierung ist auch lokal deaktiviert; lokale Passwörter erfordern mindestens zwölf Zeichen und alle Zeichenklassen.

### Task 4 — abgeschlossen 25.08.2026
- `npm run seed` legt ausschließlich die synthetische `DentPilot Testpraxis` und je ein Konto pro freigegebener Rolle an.
- Bestehende Auth-Nutzer werden aktualisiert und Profile über `user_id` upserted; der Zweifachlauf bleibt bei `1` Praxis, `3` Nutzern und `3` Profilen.
- Die drei Passwörter werden stark validiert und ausschließlich zur Laufzeit aus lokalen Variablen gelesen.
- CLI-Ausgaben enthalten nur die reservierten `.example`-E-Mail-Adressen und den Status `erstellt` oder `aktualisiert`.
- Der Cloud-Zweifachlauf folgt mit dem EU-Entwicklungsprojekt in der Task-9-Abnahme.

### Task 5 — abgeschlossen 25.08.2026
- Getrennte `@supabase/ssr`-Clients für Browser, Server-Komponenten und den Next.js-16-Proxy angelegt; der alte `null`-Platzhalter wurde entfernt.
- Der Proxy verwendet ausschließlich kryptografisch verifizierte `getClaims()`-Ergebnisse als Routing-Signal und behandelt Fehler oder fehlendes `sub` als anonym.
- `/status` ist geschützt, angemeldete Nutzer werden von `/login` nach `/status` geleitet; Query-Parameter werden bei Auth-Redirects verworfen.
- Refresh-Cookies werden mit ihren Sicherheitsattributen an Request und Response weitergereicht; Auth-Antworten erhalten `Cache-Control: private, no-store`.
- Neun Unit-Tests decken Redirects, ungültige Claims, Cookie-Weitergabe und statische Matcher-Ausschlüsse ab.
- Ein lokaler HTTP-Smoke-Test bestätigt für einen anonymen `/status`-Aufruf den query-freien `307`-Redirect auf `/login` und `Cache-Control: private, no-store`.

### Task 6 — abgeschlossen 25.08.2026
- Die Login-Domainlogik validiert E-Mail und Passwort ausschließlich serverseitig mit Zod; die E-Mail wird normalisiert, das Passwort weder verändert noch zurückgegeben.
- Unbekannte E-Mail-Adressen und falsche Passwörter sind nach außen nicht unterscheidbar und verhindern damit Account Enumeration.
- Supabase-Rate-Limits sowie Netzwerk-, Timeout- und 5xx-Fehler werden in neutrale Anwendungscodes übersetzt; technische Anbietertexte und personenbezogene Inhalte werden weder zurückgegeben noch protokolliert.
- Erfolgreiche Anmeldungen leiten ohne sensible URL-Parameter nach `/status` weiter.
- 13 fokussierte Tests belegen Validierung, unterbliebene Auth-Aufrufe bei Eingabefehlern, neutrale Fehlerklassifikation, Passwortschutz, E-Mail-Erhalt und den Erfolgs-Redirect.

### Task 7 — abgeschlossen 25.08.2026
- Die deutsche Login-Oberfläche übernimmt Logo, Farben, Radien und die klinisch-helle Gestaltung des freigegebenen Standalone-Prototyps; externe Schrift- oder Bilddienste werden nicht geladen.
- Zugängliche Labels, ARIA-verknüpfte Feldfehler und korrekte Autofill-Werte unterstützen Tastatur, Screenreader und Passwortmanager.
- Die E-Mail bleibt nach Fehlern erhalten, während das Passwort geleert wird; der Pending-Zustand sperrt die Schaltfläche und verhindert Doppelübermittlungen.
- Neutrale Credential-, Rate-Limit- und Dienstfehler werden verständlich auf Deutsch angekündigt, ohne technische Details oder personenbezogene Inhalte offenzulegen.
- Sechs fokussierte Komponententests sowie reale Desktop- und 390-px-Mobile-Browserprüfungen belegen Verhalten, Responsivität und einen fehlerfreien Next.js-Lauf.

### Task 8 — abgeschlossen 25.08.2026
- Die geschützte Statusseite verifiziert die Identität erneut über Claims und lädt das eigene Profil samt Praxis ausschließlich über den Cookie-basierten SSR-Client und bestehende RLS-Regeln.
- Der datenminimierte Kontokontext enthält nur Anzeigename, interne Rolle, deutsche Rollenbezeichnung und Praxisname; Benutzer-ID sowie Patienten- oder Gesundheitsdaten werden nicht an die Oberfläche gegeben.
- Fehlende Profile werden als verständlicher Einrichtungszustand dargestellt, während Abfrage- oder Datenformfehler bewusst nicht als „Profil fehlt“ verschluckt werden.
- Logout beendet zuerst die Supabase-Sitzung, invalidiert anschließend den App-Layout-Cache und leitet erst danach ohne Query-Parameter nach `/login`.
- 13 fokussierte Tests belegen Claim-Schutz, profilgebundene Abfrage, alle Rollenbezeichnungen, datenminimierte Zustände, neutrale Fehler und die Logout-Reihenfolge.

## Review-Ergänzungen vom 25.08.2026

- Die Spec enthält **20** Akzeptanzkriterien (nicht 22, wie im früheren Handoff angegeben).
- Next.js 16 verwendet `proxy.ts` und `proxy()`; `middleware.ts` ist veraltet.
- Der Proxy verwendet `supabase.auth.getClaims()` für die verifizierte Identitätsprüfung und niemals `getSession()` als Vertrauensanker.
- Geschützte Server-Seiten prüfen die Identität erneut. Der Proxy allein ist keine vollständige Autorisierung.
- Geschützte Antworten erhalten `Cache-Control: private, no-store`; sensible Daten dürfen nicht in Browser-Storage, URL, Telemetrie oder allgemeine Logs gelangen.
- Login-Schutz umfasst Supabase-Rate-Limits und eine dokumentierte Behandlung von `429`-Antworten. Ein zusätzlicher anwendungsseitiger Limiter wird vor echten Daten bewertet.
- RLS wird automatisiert mit SQL-Tests für anonymen, eigenen und fremden Zugriff sowie blockierte Schreiboperationen geprüft.
- Verbindliche Querschnittsanforderungen: `docs/architecture/privacy-security-ai-compliance.md`.

## Deployment
_To be added by /deploy_
