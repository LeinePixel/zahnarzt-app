# Acceptance Tests

## Teststand — Fakten

**Es existiert kein einziger Test.** `git ls-files "*.test.ts" "*.test.tsx" "tests/"` liefert nichts. Vorhanden ist nur die Testinfrastruktur:

| Werkzeug | Zweck | Konfiguration |
|---|---|---|
| Vitest ^4.1.2 | Unit- und Integrationstests | `vitest.config.ts`, `src/test/setup.ts` |
| Playwright ^1.58.2 | End-to-End-Tests | `playwright.config.ts` |
| Testing Library | React-Komponententests | installiert |

**Befehle** (aus `package.json`, unverändert übernommen):

```bash
npm test           # Vitest einmalig
npm run test:watch # Vitest im Beobachtungsmodus
npm run test:e2e   # Playwright
npm run test:all   # beides nacheinander
```

`npm test` läuft aktuell durch, weil es nichts zu testen gibt — das ist kein grünes Sicherheitsnetz.

## Teststrategie

Aus `CLAUDE.md`: **Unit-Tests liegen neben der Quelldatei** (`useHook.test.ts` neben `useHook.ts`), **E2E-Tests in `tests/`**.

Eine darüber hinausgehende Strategie (Abdeckungsziele, was Unit- vs. E2E-Test sein soll, Umgang mit Supabase in Tests) ist **nicht festgelegt** — siehe `open-questions.md`.

---

## Abnahme PROJ-1 — manuelle Schritte

Die verbindlichen Akzeptanzkriterien stehen in `features/PROJ-1-supabase-infrastructure-setup.md` (22 Stück im Format Angenommen/Wenn/Dann). Diese Liste ist die Kurzfassung zum Durchklicken.

**Vorbereitung:** Supabase-Projekt angelegt, `.env.local` gefüllt, Migration eingespielt, Seed-Skript gelaufen.

### Anmeldung
1. Anwendung ohne Anmeldung öffnen → landet auf der Anmeldeseite
2. Formular leer absenden → Validierungsmeldung an beiden Feldern, **keine** Netzwerkanfrage
3. Ungültiges E-Mail-Format eingeben → Formatmeldung am E-Mail-Feld
4. Existierende E-Mail mit falschem Passwort → Fehlermeldung, E-Mail bleibt im Feld stehen
5. **Nicht existierende E-Mail** → **exakt dieselbe** Meldung wie in Schritt 4. Weicht sie ab, ist das ein Fehler: dann lässt sich ausprobieren, wer ein Konto besitzt.
6. Schnell zweimal auf „Anmelden" klicken → nur eine Anfrage wird ausgelöst
7. Korrekte Zugangsdaten eines Demo-Kontos → Weiterleitung auf die geschützte Seite

### Zugriffsschutz
8. Abmelden, dann geschützte URL direkt eingeben → Weiterleitung zur Anmeldeseite
9. Angemeldet die Anmeldeseite aufrufen → Weiterleitung in die App
10. Nach Abmelden den **Zurück-Knopf** des Browsers drücken → keine geschützten Inhalte sichtbar

### Angemeldeter Zustand
11. Geschützte Seite prüfen → Anzeigename, Rolle und Praxisname stimmen mit dem Seed überein
12. Mit jeder der drei Rollen anmelden → jeweils korrekte Rolle sichtbar
13. Browser vollständig schließen und erneut öffnen → weiterhin angemeldet
14. Zwei Tabs öffnen, in einem abmelden, im anderen navigieren → keine geschützten Inhalte mehr

### Fehlerfälle
15. Netzwerk trennen, Anmeldung versuchen → Meldung unterscheidet sich erkennbar von „Zugangsdaten falsch", Eingabe bleibt erhalten, Formular bleibt bedienbar
16. Im Supabase-Dashboard ein Konto **ohne** Profil anlegen, damit anmelden → erklärender Hinweis „Konto unvollständig eingerichtet", **kein** Absturz
17. Eine Umgebungsvariable entfernen und starten → Klartextmeldung, die die fehlende Variable benennt

### Datenbank
18. Im Supabase-Dashboard prüfen: RLS ist auf `practice` und `user_profile` aktiviert
19. Prüfen: Jedes Profil ist genau einer Praxis und genau einer der Rollen `rezeption`, `behandler`, `praxisadmin` zugeordnet
20. Seed-Skript ein zweites Mal ausführen → keine doppelten Datensätze

---

## Testdaten

Das Seed-Skript legt an: eine Testpraxis und drei Demo-Konten (eines je Rolle).

**Die konkreten Zugangsdaten sind nicht festgelegt** und gehören auch nicht in dieses Dokument. Sie werden beim Bauen des Seed-Skripts definiert und dort dokumentiert. Da es sich um synthetische Testdaten handelt, ist das unkritisch — **sobald echte Patientendaten hinzukommen, dürfen diese Konten nicht mehr existieren.**

Alle Patientendaten im MVP sind erfunden. Der Referenz-Prototyp (`docs/design/assets/dentpilot-ux1-prototype.html`) enthält ebenfalls ausschließlich erfundene Beispieldaten.
