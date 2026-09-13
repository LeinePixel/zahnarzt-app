# Acceptance Tests

## PROJ-2 — lokaler Mock-PVS, Evidenz vom 10.09.2026

Der Mock-PVS läuft als separater lokaler TypeScript-/Node-HTTP-Prozess. Er verarbeitet ausschließlich versionierte, deterministische synthetische Fixtures und besitzt weder eine Supabase-Verbindung noch eine Next.js-Route oder Browseranbindung. Lese- und Teststeuerung verwenden getrennte lokale Bearer-Token; die Teststeuerung akzeptiert nur feste Szenarien und keine frei übermittelten Ressourcen.

| Nachweis | Ergebnis |
| --- | --- |
| `npm run test:mock-pvs` | 5 Testdateien, 84 Tests bestanden: Konfiguration, Verträge, Cursor/Pagination, HTTP-Grenze, Szenarien und Prozess-Smoke-Test |
| `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | bestanden: Lint, Typecheck, 16 Vitest-Testdateien mit 142 Tests und Produktions-Build |
| `npx supabase test db --local`, `npm run test:e2e:edge-required` | bestanden: 2 pgTAP-Dateien mit 36 Tests sowie 15 Browserfälle in Chromium, Firefox, WebKit und Microsoft Edge |

Die Nachweise decken neutrale 401/404/422/500-Antworten, 429/503 mit `Retry-After`, Upserts mit vollständiger Ressource, ressourcenlose Tombstones, szenariogebundene opaque Cursor und den Reset auf `baseline` ab. Der Dienst ist lokal und unhosted; er ersetzt keinen echten PVS-Zugang, keine Anbieterprüfung und kein Real-Data-Gate.

## Teststand — Fakten (26.08.2026)

PROJ-1 besitzt ein dreischichtiges, ausführbares Sicherheitsnetz:

| Werkzeug | Zweck | Konfiguration |
|---|---|---|
| Vitest 4.1.2 | Domain-, Proxy-, Server-Umgebungs- und UI-Tests | 58 Tests bestanden |
| Supabase CLI / pgTAP | Schema-, RLS- und Negativtests | 36 Tests bestanden |
| Playwright 1.58.2 | Auth-, Datenschutz- und Browserflüsse | 15 Tests bestanden |

**Befehle** (aus `package.json`, unverändert übernommen):

```bash
npm test           # Vitest einmalig
npm run test:watch # Vitest im Beobachtungsmodus
npm run test:e2e   # Produktions-Build + Listenreport; keine Auth-Traces/Medien
npm run test:e2e:edge-required # wie oben, aber echter Edge ist zwingend
npm run test:all   # beides nacheinander
```

Der belegte E2E-Lauf verwendet `npm run test:e2e:edge-required`: Chromium für die vollständigen Auth-Flüsse sowie echte Smoke-Starts in Firefox, WebKit und installiertem Microsoft Edge. WebKit ist eine Safari-Engine-Näherung und ersetzt keinen manuellen Test in echtem Safari. Der Next-Server wird neu gestartet und erhält über einen getesteten Sanitizer keine Seed-Passwörter und keinen Service-Role-Key.

## Teststrategie

Aus `CLAUDE.md`: **Unit-Tests liegen neben der Quelldatei** (`useHook.test.ts` neben `useHook.ts`), **E2E-Tests in `tests/`**.

PROJ-1 verwendet drei Schichten: Vitest für Domain/UI, Supabase CLI/pgTAP für Schema und RLS, Playwright für Browserflüsse. Projektweite Coverage-Schwellen bleiben offen.

---

## Abnahme PROJ-19 — Evidenz vom 05.09.2026

Die PROJ-19-Nachweise verwenden ausschließlich lokale, synthetische Daten.
Die frische Verifikation auf dem aktuellen HEAD ergab:

| Nachweis | Ergebnis |
| --- | --- |
| `npm run lint` | bestanden (Exit 0) |
| `npm test` | 17 Testdateien, 90 Tests bestanden |
| `npm run typecheck` | bestanden (Exit 0) |
| `npm run build` | bestanden (Exit 0) |
| Rollback-only-Harness für historische Migrationen | bestanden: 25/25 und 26/26 |
| `npx supabase test db --local` | 3 Dateien, 108 pgTAP-Tests bestanden |
| `$env:E2E_PORT = '3135'; npm run test:e2e:edge-required` | vom Nutzer im selben Worktree in normaler, nicht erhöhter PowerShell ausgeführt: Produktions-Build und 17/17 Browser-Tests in 44,3 s bestanden (Chromium 13, Firefox 1, WebKit 1, Microsoft Edge 2) |

Der E2E-Nachweis umfasst den browsergestützten Audit-Zugriffsfall. Ein zuvor
nur in der Codex-Sandbox auftretender Firefox-Playwright-Laufzeitfehler wurde
nicht als Produktfehler gewertet, weil derselbe vollständige Lauf in der
normalen Benutzerumgebung erfolgreich war.

Die statische Task-7-Sicherheitsprüfung bestätigte erneut SECURITY-DEFINER-
Schutz (`search_path`), Least-Privilege-Grants und RLS, Fremdpraxis-, Ablauf-
und Widerrufsgrenzen sowie Datenminimierung und Geheimnisbehandlung. Es gibt
keine neuen Critical- oder Important-Befunde.

Die Hosted-Cron-Abfrage für `dentpilot-purge-expired-audit-events` blieb
ausdrücklich ausstehend: Es liegt keine freigegebene, nicht geheime
administrative Session vor. Hosted-Cron-Commissioning, MFA/Re-Authentisierung
und die weiteren Datenschutz-/Compliance-Gates bleiben offen; PROJ-19 öffnet
das Real-Data-Gate nicht.

---

## Abnahme PROJ-1 — belegter Stand

Die verbindlichen Akzeptanzkriterien stehen in `features/PROJ-1-supabase-infrastructure-setup.md` (20 Stück im Format Angenommen/Wenn/Dann).

**Cloud-Abnahme:** EU-Projekt verknüpft, Migration `20260825170000_proj_1_identity.sql` eingespielt und der synthetische Seed zweimal ausgeführt. Lauf 1 erstellte genau drei Konten, Lauf 2 aktualisierte dieselben drei Konten.

**Automatisiert belegt:** Validierung (einschließlich Unit-Beleg, dass ungültige Eingaben keine Supabase-Auth-Anfrage auslösen), neutrale Credential-Fehler, Doppelübermittlung, drei Rollen, Statusdaten, direkter Schutz, query-freie Redirects, Logout, Zurück-Navigation, zweiter Tab, `private/no-store` auch auf dem anonymen Redirect, kein Supabase-Token in Local Storage und ein temporäres Konto ohne Profil. Das temporäre Konto wird über exakte E-Mail und Nutzer-ID reconciled und gezielt gelöscht; Passwörter, Tokens, HTML-Reports, Screenshots, Videos und Traces werden nicht persistiert.

### Verbleibende manuelle Restabnahme

- [ ] Browser vollständig schließen und neu öffnen; persistente Cookie-Sitzung bestätigen.
- [ ] Supabase-Erreichbarkeit kontrolliert unterbrechen; unterscheidbare, neutrale Dienstmeldung im Browser bestätigen.
- [ ] Echter Safari-Smoke auf macOS/iOS. WebKit unter Windows ist bereits automatisiert grün.
- [ ] Vor Deploy zusätzlich CSP-/Security-Header und Hosting-Umgebung prüfen.

Die nachfolgende Liste bleibt als detailliertes Runbook erhalten; automatisierte Punkte müssen nicht manuell wiederholt werden.

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

Das Seed-Skript legt an: zwei synthetische Testpraxen und vier Demo-Konten
(drei Praxisrollen sowie eine separate Portaladmin-Identität).

**Die konkreten Passwörter sind absichtlich nicht festgelegt** und gehören weder in dieses Dokument noch in das Repository. Sie werden lokal über die vier `SEED_*_PASSWORD`-Variablen gesetzt. Da es sich um synthetische Testkonten handelt, dürfen sie nicht in eine Umgebung mit echten oder re-identifizierbaren Patientendaten übernommen werden.

Alle Patientendaten im MVP sind erfunden. Der Referenz-Prototyp (`docs/design/assets/dentpilot-ux1-prototype.html`) enthält ebenfalls ausschließlich erfundene Beispieldaten.
