# Design System — DentPilot

> Festgelegt am 24.08.2026 nach Prüfung von drei visuellen Richtungen und drei UX-Aufbauten.
> Grundlage: Logo `public/dentpilot-logo-negativ.png` (Grünton als Hauptakzent).

## Entscheidungen

**Visuelle Richtung: „Klinisch Hell" (Variante A)**
Ruhig, sachlich, viel Weißraum. Grün trägt die gesamte Oberfläche, Rot/Amber ausschließlich für Statusanzeigen. Bewusst zurückhaltend, weil die Rezeption acht Stunden am Tag darin arbeitet.

**UX-Aufbau: „Seiten-Navigation" (UX 1)**
Klassische Sidebar, die ganze Seiten wechselt:
- **Dashboard** — KPI-Zeile oben, darunter Arbeitsliste („Heute — was ansteht") und die Spalten Chancen / Risiko
- **Patientenprofil** — Vollseite mit Kopfbereich, Status-Karte, Kennzahlen und Timeline
- **Termine** — Tagesliste mit Zeitspalte, Status-Pills und Umschalter Tag / Woche / Monat

Navigationsmuster: Sidebar wechselt Seiten, jede Listenzeile öffnet den Patienten, Breadcrumb führt zurück.
Begründung: sofort verständlich für Praxispersonal, jede Seite hat Platz für Tiefe, einzelne Ansichten sind per Link teilbar.

## Farb-Tokens

Alle Farben in `oklch`, damit Ableitungen (Hover, Tints) harmonisch bleiben.

```css
:root{
  /* Flächen */
  --bg:        oklch(0.985 0.004 165);  /* Seitenhintergrund, leicht grünstichiges Weiß */
  --surface:   oklch(1 0 0);            /* Karten, Sidebar */
  --surface-2: oklch(0.97 0.006 165);   /* Eingabefelder, inaktive Chips, Hover */
  --border:    oklch(0.90 0.008 165);

  /* Text */
  --text:      oklch(0.27 0.03 255);    /* Haupttext, Überschriften */
  --text-2:    oklch(0.50 0.02 255);    /* Sekundärtext, Beschreibungen */
  --text-3:    oklch(0.64 0.015 255);   /* Labels, Metadaten, Platzhalter */

  /* Marke (aus dem Logo) */
  --green:        oklch(0.58 0.14 165); /* Primäraktion, aktive Navigation */
  --green-dark:   oklch(0.42 0.12 165); /* Text auf grünen Flächen, Links */
  --green-tint:   oklch(0.94 0.035 165);/* aktiver Nav-Hintergrund, Avatare */
  --green-tint-2: oklch(0.90 0.05 165); /* größere Avatare, Akzentflächen */
  --navy:         oklch(0.27 0.03 255); /* Wortmarke „Dent" */

  /* Status — nur für Zustände, nie dekorativ */
  --red:       oklch(0.58 0.17 25);     /* überfällig, Risiko, No-Show */
  --red-tint:  oklch(0.95 0.03 25);
  --amber:     oklch(0.72 0.14 75);     /* unbestätigt, Recall fällig */
  --amber-tint:oklch(0.95 0.04 75);
}
```

**Farbregel:** Grün = Navigation, Primäraktionen und Positives. Rot = überfällig oder Risiko. Amber = wartet auf Reaktion. Nie mehr als eine Statusfarbe pro Zeile.

## Typografie

**Plus Jakarta Sans** (Google Fonts), Fallback `ui-sans-serif, system-ui, -apple-system, sans-serif`.

| Verwendung | Größe | Gewicht | Sonstiges |
|---|---|---|---|
| Seitentitel | 22px | 700 | `letter-spacing:-0.01em` |
| KPI-Zahl | 25–26px | 800 | `letter-spacing:-0.02em` |
| Kartentitel | 14–15px | 700 | |
| Zeilentitel (Name) | 13.5px | 600 | |
| Fließtext / Beschreibung | 12.5px | 400–500 | `--text-2` |
| Label (Großbuchstaben) | 11.5px | 600–700 | `text-transform:uppercase; letter-spacing:.03em`, `--text-3` |
| Badge / Pill | 11.5px | 600 | |

## Maße

- **Radien:** 10px Steuerelemente und Nav-Einträge · 14px KPI-Karten · 16px große Inhaltskarten · 20px Pills und Avatare
- **Abstände:** 13–14px Karten-Gitter · 18px Spalten · 20–22px Karteninnenabstand · 26px Sektionsabstand
- **Sidebar:** 228px breit, 1px Rahmen rechts, Innenabstand 22px/14px
- **Inhaltsbereich:** Innenabstand 26px oben, 34px seitlich
- **Nav-Eintrag:** 9px/12px Innenabstand, 18px Icon, 11px Abstand Icon↔Text
- **Avatar:** 34px in Listen, 58px im Profilkopf
- **Klickflächen:** mindestens 44px Höhe in produktiven Listen

## Icons

Ausschließlich Inline-SVG, Strichstärke `1.75`, `stroke-linecap="round"`, `stroke-linejoin="round"`, 24er-Raster, `currentColor`. Größen: 18px in der Navigation, 17px in Kartenköpfen, 15–16px inline. **Keine Emoji** als Icons.

## Komponentenmuster

- **KPI-Karte:** Label (12.5px, `--text-2`) → Zahl (25px, 800) → Zusatz (11.5px, Statusfarbe)
- **Listenzeile:** Avatar → Name + Detail (flex-grow) → Status-Pill rechts; getrennt durch `border-top`, Hover `--surface-2`, ganze Zeile klickbar
- **Status-Pill:** 11.5px/600, `padding:4px 9px`, `border-radius:20px`, Textfarbe und Tint-Hintergrund derselben Statusfarbe
- **Timeline:** 9px Punkt + 1.5px Verbindungslinie; hervorgehobene Einträge (z. B. Transkripte) bekommen `--green-tint` als Kartenhintergrund
- **Buttons:** primär `--green` mit weißem Text; sekundär 1px `--border` mit `--text`; beide 9px/16px, Radius 10px, 13px/600

## Umsetzungshinweise

- Umsetzung mit **Tailwind CSS + shadcn/ui**; die Tokens oben gehören in die Theme-Konfiguration, damit shadcn-Komponenten sie automatisch nutzen. Bestehende shadcn-Komponenten **nicht** nachbauen.
- Layout durchgehend mit Flex/Grid und `gap`, nicht mit Einzelmargins.
- Kein Dark Mode im MVP.

## Referenzen

- Visuelle Richtungen (3 Varianten): https://claude.ai/code/artifact/67ea17d0-9be4-4d86-bf1f-0758bd5bcf6f
- UX-Aufbauten (3 klickbare Prototypen): https://claude.ai/code/artifact/35ce6b8c-a223-47cf-b843-a55e0c3cc26b
- Logo: `public/dentpilot-logo-negativ.png`
- Klickbarer Referenz-Prototyp im Repository: `docs/design/assets/dentpilot-ux1-prototype.html` (eigenständige HTML-Datei, im Browser öffnen)
