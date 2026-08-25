# Acceptance Tests

## Teststand — Fakten

**Es existiert kein einziger Test.** `git ls-files "*.test.ts" "*.test.tsx" "tests/"` liefert nichts. Vorhanden ist nur die Testinfrastruktur:

| Werkzeug | Zweck | Konfiguration |
|---|---|---|
| Vitest ^4.1.2 | Unit- und Integrationstests | `vitest.config.mts`, `src/test/setup.ts` |
| Playwright ^1.58.2 | End-to-End-Tests | `playwright.config.ts` |
| Testing Library | React-Komponententests | installiert |

**Befehle** (aus `package.json`, unverändert übernommen):

```bash
npm test           # Vitest einmalig
npm run test:watch # Vitest im Beobachtungsmodus
npm run test:e2e   # Playwright
npm run test:all   # beides nacheinander
```

`npm test` endet aktuell mangels Testdateien mit Exit 1 und meldet einen verzögerten Vitest-Abschluss — das ist kein Sicherheitsnetz. PROJ-1 Task 1 repariert diese Baseline.

## Teststrategie

Aus `CLAUDE.md`: **Unit-Tests liegen neben der Quelldatei** (`useHook.test.ts` neben `useHook.ts`), **E2E-Tests in `tests/`**.

PROJ-1 verwendet drei Schichten: Vitest für Domain/UI, Supabase CLI/pgTAP für Schema und RLS, Playwright für Browserflüsse. Projektweite Coverage-Schwellen bleiben offen.

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
17. Öffentliche Variable entfernen und App starten beziehungsweise Service-Key entfernen und Seed starten → Klartextmeldung mit Variablennamen; die App selbst verlangt den Service-Key nicht

### Datenbank
18. Im Supabase-Dashboard prüfen: RLS ist auf `practice` und `user_profile` aktiviert
19. Prüfen: Jedes Profil ist genau einer Praxis und genau einer der Rollen `rezeption`, `behandler`, `praxisadmin` zugeordnet
20. Seed-Skript ein zweites Mal ausführen → keine doppelten Datensätze

### Sicherheits- und Datenschutzabnahme PROJ-1

- Proxy und geschützte Serverseite vertrauen nur verifizierten Claims, nicht `getSession()`.
- Geschützte Antworten sind `private, no-store`; Sitzung liegt nicht in Local Storage.
- RLS-Negativtests beweisen: anon, fremder Nutzer und Schreibversuche erhalten keinen Zugriff.
- Service-Role-Key ist nicht im Client-Bundle und erscheint nicht in Logs/Testausgaben.
- Login behandelt Rate-Limits neutral und protokolliert keine E-Mail, Passwörter oder Tokens.
- Alle Testdaten sind eindeutig synthetisch; das Real-Data-Gate bleibt geschlossen.

---

## Testdaten

Das Seed-Skript legt an: eine Testpraxis und drei Demo-Konten (eines je Rolle).

**Die konkreten Passwörter sind absichtlich nicht festgelegt** und gehören weder in dieses Dokument noch in das Repository. Sie werden lokal über die drei `SEED_*_PASSWORD`-Variablen gesetzt. Da es sich um synthetische Testkonten handelt, dürfen sie nicht in eine Umgebung mit echten oder re-identifizierbaren Patientendaten übernommen werden.

Alle Patientendaten im MVP sind erfunden. Der Referenz-Prototyp (`docs/design/assets/dentpilot-ux1-prototype.html`) enthält ebenfalls ausschließlich erfundene Beispieldaten.
