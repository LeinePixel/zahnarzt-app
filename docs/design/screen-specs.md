# Screen Specs

## Status

Es gibt **drei visuell durchgestaltete Referenz-Screens** und **zwei spezifizierte, aber nicht gestaltete Screens**.

| Screen | Visuell gestaltet | Verhalten spezifiziert | Feature |
|---|---|---|---|
| Anmeldeseite | ❌ nein | ✅ ja (Akzeptanzkriterien) | PROJ-1 |
| Statusseite nach Anmeldung | ❌ nein | ✅ ja (Akzeptanzkriterien) | PROJ-1 |
| Dashboard | ✅ Referenz-Prototyp | ❌ nein | PROJ-18 |
| Patientenprofil | ✅ Referenz-Prototyp | ❌ nein | PROJ-6 |
| Terminübersicht | ✅ Referenz-Prototyp | ❌ nein | PROJ-7 |

**Der Referenz-Prototyp ist keine Spezifikation.** Er zeigt Aufbau, Optik und Navigationsmuster mit erfundenen Beispieldaten. Die zugehörigen Features haben noch keine User Stories und keine Akzeptanzkriterien.

**Verbindliche Gestaltungsgrundlage:** `docs/design/design-system.md` — Farb-Tokens, Typografie-Skala, Maße, Icon-Regeln, Komponentenmuster.

**Klickbarer Prototyp:** `docs/design/assets/dentpilot-ux1-prototype.html` — eigenständige HTML-Datei, im Browser öffnen. Sidebar wechselt Seiten, Listenzeilen öffnen das Patientenprofil, Breadcrumb führt zurück.

---

## Zu bauen: Anmeldeseite (PROJ-1)

Verbindliche Akzeptanzkriterien: `features/PROJ-1-supabase-infrastructure-setup.md`

**Zweck:** Zugang zur Anwendung. Einziger öffentlich erreichbarer Screen.

**Bestandteile:** Logo, Überschrift, Feld E-Mail, Feld Passwort, Schaltfläche „Anmelden", Bereich für Fehlermeldungen.
Aus dem vorhandenen shadcn-Bestand: `form`, `input`, `label`, `button`, `card`, `alert` — **nicht nachbauen**.

**Zustände:**

| Zustand | Verhalten |
|---|---|
| Standard | Leeres Formular, Fokus im E-Mail-Feld |
| Validierungsfehler | Meldung am jeweiligen Feld, keine Anfrage wird gesendet |
| Lädt | Schaltfläche gesperrt — ein Doppelklick darf keine zweite Anfrage auslösen |
| Zugangsdaten falsch | **Einheitliche** Meldung, gleich ob Passwort falsch oder E-Mail unbekannt. Eingegebene E-Mail bleibt erhalten. |
| Dienst nicht erreichbar | Davon **unterscheidbare** Meldung. Eingabe bleibt erhalten, Formular bleibt bedienbar. |
| Erfolg | Weiterleitung auf die geschützte Seite |
| Bereits angemeldet | Direkte Weiterleitung, Anmeldeseite wird nicht angezeigt |

**Nicht vorhanden:** Registrierung, Passwort-vergessen, „Angemeldet bleiben" (Sitzung ist ohnehin dauerhaft).

---

## Zu bauen: Statusseite (PROJ-1)

**Zweck:** Bewusst minimal. Zeigt, dass die Anmeldung funktioniert. **Kein App-Grundgerüst** — Sidebar und Navigation entstehen erst mit PROJ-6.

**Bestandteile:** Anzeigename, Rolle, Praxisname, Schaltfläche „Abmelden", Hinweis „Dashboard folgt in PROJ-18".

**Zustände:**

| Zustand | Verhalten |
|---|---|
| Standard | Name, Rolle, Praxis werden angezeigt |
| Konto ohne Profil | Erklärender Hinweis „Konto unvollständig eingerichtet" statt Absturz |
| Nicht angemeldet | Middleware leitet zur Anmeldeseite, bevor die Seite ausgeliefert wird |
| Nach Abmelden | Zurück-Knopf des Browsers darf keine geschützten Inhalte zeigen |

---

## Offene Gestaltungsfragen

Nicht abgestimmt, daher hier statt als Behauptung im Design:

- **Kein visueller Entwurf für Anmelde- und Statusseite.** Das Design-System liefert Tokens und Komponentenmuster; das genaue Layout ist offen. Da beide Screens schlicht sind, dürfte das unkritisch sein — siehe `docs/delivery/open-questions.md`.
- **Barrierefreiheit ist nirgends spezifiziert.** Kein Zielstandard festgelegt, keine Anforderungen an Tastaturbedienung, Kontraste oder Screenreader dokumentiert.
- **Responsive-Verhalten ist nirgends spezifiziert.** Der Referenz-Prototyp ist auf 1520 px Breite ausgelegt und bricht unterhalb von 1280 px die Spalten um — ob und wie die Anwendung auf Tablet oder Telefon funktionieren soll, ist offen.
- **Keine Figma-Datei oder externe Designquelle** vorhanden. Der HTML-Prototyp im Repository ist die einzige visuelle Referenz.
