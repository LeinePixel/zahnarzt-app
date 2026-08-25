# PROJ-1 Supabase Infrastructure & Login Implementation Plan

> **Für agentische Umsetzung:** Aufgaben strikt der Reihe nach und testgetrieben ausführen. Für jede Verhaltensänderung zuerst den angegebenen fehlschlagenden Test beobachten, dann minimal implementieren. Keine echten Patienten- oder Gesundheitsdaten verwenden.

**Ziel:** Ein reproduzierbares Supabase-Fundament mit sicherer Cookie-Anmeldung, verifiziertem serverseitigem Zugriffsschutz, RLS, Demo-Seed und vollständig testbarer deutscher Login-/Statusoberfläche.

**Architektur:** Das Cloud-Modell bleibt bestehen: gehostetes Supabase für PostgreSQL/Auth und später Vercel für Next.js. `@supabase/ssr` stellt Browser- und Server-Clients bereit; `src/proxy.ts` aktualisiert Auth-Cookies und routet anhand verifizierter Claims. Die Datenbank bleibt die letzte Autorisierungsinstanz über RLS.

**Tech Stack:** Next.js 16.3.2, React 19, TypeScript, Supabase, `@supabase/ssr`, Zod 4, react-hook-form, shadcn/ui, Vitest, Playwright, Supabase CLI/pgTAP.

**Spec:** `features/PROJ-1-supabase-infrastructure-setup.md`
**Querschnitt:** `docs/architecture/privacy-security-ai-compliance.md`

## Globale Constraints

- Ausschließlich synthetische Testdaten; das Real-Data-Gate bleibt geschlossen.
- Oberflächentexte und nutzerseitige Fehler auf Deutsch.
- Next.js 16 verwendet `src/proxy.ts` mit Export `proxy`; keine neue `middleware.ts`.
- Serververtrauen basiert auf `supabase.auth.getClaims()`, niemals ungeprüft auf `getSession()`.
- Keine Secrets, Passwörter, Tokens oder Gesundheitsdaten in Quellcode, URLs, Browser-Storage, Logs oder Telemetrie.
- `SUPABASE_SERVICE_ROLE_KEY` ist nur im CLI-Seed-Prozess erlaubt.
- RLS ist auf jeder Tabelle aktiv; anonymer, fremder und unerlaubter Schreibzugriff wird negativ getestet.
- Geschützte Antworten sind `private, no-store` und dürfen nicht von Browser/CDN zwischengespeichert werden.
- Änderungen an Auth und RLS erhalten vor Abschluss eine explizite Sicherheitsprüfung.

## Vorbedingung: Cloud-Projekt

Der Nutzer legt ein Entwicklungsprojekt auf Supabase an und wählt eine EU-Region. Benötigt werden Projekt-URL, Publishable-/Anon-Key und Service-Role-Key. Die Werte werden ausschließlich in `.env.local` hinterlegt. Entwicklung der lokalen Dateien kann vorher beginnen; Migration, Seed und echte E2E-Anmeldung bleiben bis dahin blockiert.

### Task 1: Tooling- und Test-Baseline

**Files:** Modify `package.json`, `playwright.config.ts`; replace `vitest.config.ts` with ESM-safe `vitest.config.mts`; create `eslint.config.mjs`, `src/test/baseline.test.ts`, `tests/baseline.spec.ts`.

**Produces:** funktionierende Befehle `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run typecheck`.

- [x] Baseline-Test anlegen und einzeln ausführen; exakt ein Test und der Prozess müssen mit Exit 0 enden.
- [x] `lint` von entferntem `next lint` auf `eslint .` umstellen und ESLint Flat Config mit Next Core Web Vitals/TypeScript anlegen.
- [x] `typecheck` als `tsc --noEmit` ergänzen.
- [x] Playwright-Projekte für Chromium, Firefox und WebKit konfigurieren; Edge wird als Chromium-Kompatibilität dokumentiert, ein echter Edge-Smoke-Test folgt im Deploy-Gate.
- [x] `npm run lint`, `npm test`, `npm run typecheck` und `npm run build` ausführen; alle müssen Exit 0 liefern. Zusätzlich besteht der Browser-Smoke-Test in allen drei Playwright-Projekten.

### Task 2: Abhängigkeiten und Umgebungsvalidierung

**Files:** Modify `package.json`, `package-lock.json`, `.env.local.example`; create `src/lib/env.ts`, `src/lib/env.test.ts`, `supabase/seed-env.ts`, `supabase/seed-env.test.ts`.

**Produces:** `getPublicEnv(input?)` liefert nur URL/öffentlichen Key im App-Quellbaum; `getSeedEnv(input?)` liefert zusätzlich den Service-Key ausschließlich unter `supabase/` für den CLI-Seed-Prozess.

- [x] Failing Tests schreiben: fehlende Variablen nennen ihren exakten Namen; öffentliche Laufzeit benötigt nie den Service-Key; Server-/Seed-Kontext verlangt alle drei Werte; Beispieldatei enthält keine Geheimnisse.
- [x] Tests ausführen und Fehler wegen fehlender Implementierung beobachten.
- [x] `@supabase/ssr` als Runtime- und `supabase` plus `tsx` als Dev-Abhängigkeiten installieren.
- [x] Zod-basierte Umgebungsvalidierung minimal implementieren; der Service-Key liegt ausschließlich unter `supabase/` und nicht im App-Quellbaum.
- [x] Tests, Typecheck und Secret-Scan ausführen. Zusätzlich wurden Next.js auf 16.3.2 und transitive Pakete sicherheitsgepatcht; `npm audit` meldet null bekannte Schwachstellen.

### Task 3: Reproduzierbares Schema, Constraints und RLS

**Files:** Create `supabase/config.toml`, `supabase/migrations/<timestamp>_proj_1_identity.sql`, `supabase/tests/practice_rls.test.sql`, `supabase/tests/user_profile_rls.test.sql`.

**Schema:** `practice(id, name, created_at)`; Enum `user_role` mit `rezeption`, `behandler`, `praxisadmin`; `user_profile(user_id PK/FK auth.users, practice_id FK, display_name, role, created_at)`; Index auf `practice_id`; Non-empty-Checks; RLS auf beiden Tabellen.

- [x] pgTAP-Tests zuerst schreiben: RLS aktiv; anon liest nichts; Nutzer liest nur eigenes Profil und eigene Praxis; fremde Praxis bleibt unsichtbar; INSERT/UPDATE/DELETE sind für `anon` und `authenticated` blockiert.
- [x] `supabase test db` ausführen und erwartetes Scheitern ohne Schema beobachten.
- [x] Migration mit expliziten SELECT-Policies und ohne erlaubende Schreib-Policies implementieren. Schreibzugriff wird als **deny by absence** durch Negativtests bewiesen.
- [x] `supabase db reset` und `supabase test db` ausführen; beide müssen erfolgreich sein. Der lokale Stack nutzt wegen eines Windows-Portausschlusses den projektspezifischen Bereich `55420`–`55429`.

### Task 4: Idempotenter CLI-Seed

**Files:** Create `supabase/seed.ts`, `supabase/seed.test.ts`; modify `package.json`, `.env.local.example`.

**Produces:** `npm run seed`; je eine synthetische Identität pro Rolle. Passwörter kommen aus lokalen Seed-Variablen und nicht aus dem Repository.

- [x] Failing Tests mit injiziertem Admin-Client schreiben: Praxis wird stabil wiedergefunden; bestehende Auth-Nutzer werden aktualisiert statt dupliziert; Profile werden per `user_id` upserted; zweiter Lauf verändert die Anzahl nicht.
- [x] Tests ausführen und erwartetes Scheitern beobachten.
- [x] Seed über Supabase Admin API implementieren; Ausgabe enthält nur E-Mail/Status, niemals Passwort oder Token.
- [x] Unit-Tests ausführen und `npm run seed` zweimal gegen den lokalen Docker-Stack prüfen: stabil `1` Praxis, `3` Auth-Nutzer und `3` Profile. Der entsprechende Cloud-Zweifachlauf bleibt Teil der Task-9-Deployment-Abnahme, sobald das EU-Cloud-Projekt bereitsteht.

### Task 5: Supabase-SSR-Clients und Next.js-16-Proxy

**Files:** Delete `src/lib/supabase.ts`; create `src/lib/supabase/client.ts`, `server.ts`, `proxy.ts`, `proxy.test.ts`, `src/proxy.ts`.

**Produces:** Browser-/Server-`createClient()`, `updateSession(request)`; öffentlich `/login`, geschützt `/status`.

- [x] Failing Tests schreiben: anon auf geschützter Route → `/login`; gültige Claims auf `/login` → `/status`; ungültige Claims → `/login`; Auth-Cookies werden auf Request/Response weitergereicht; statische Assets sind ausgeschlossen.
- [x] Tests ausführen und erwartetes Scheitern beobachten.
- [x] Clients mit `@supabase/ssr` implementieren. Proxy ruft `getClaims()` auf und verwendet nie `getSession()` als Vertrauensanker.
- [x] `Cache-Control: private, no-store` für geschützte Antworten setzen; keine Auth-Daten loggen.
- [x] Tests, Typecheck und Build ausführen. Neun Proxy-Tests prüfen Routing, Claims-Fehler, Query-Bereinigung, Cookie-Attribute/-Weitergabe und Matcher-Ausschlüsse.

### Task 6: Login-Domainlogik und Server Action

**Files:** Create `src/features/auth/login-schema.ts`, `login-schema.test.ts`, `actions.ts`, `actions.test.ts`.

**Produces:** `loginSchema`; `login(previousState, formData)` mit Feldfehlern sowie `INVALID_CREDENTIALS`, `SERVICE_UNAVAILABLE`, `RATE_LIMITED` oder Redirect.

- [x] Failing Tests schreiben: leere/ungültige Felder lösen keinen Auth-Aufruf aus; unbekannte E-Mail und falsches Passwort ergeben identische Meldung; Netzwerk-/5xx-Fehler ergeben Dienstfehler; 429 ergibt neutrale Rate-Limit-Meldung; Passwort wird nie zurückgegeben; E-Mail bleibt erhalten.
- [x] Tests ausführen und erwartetes Scheitern beobachten.
- [x] Serverseitige Zod-Validierung und `signInWithPassword` minimal implementieren; technische Anbieterfehler nur intern und ohne personenbezogene Inhalte kategorisieren.
- [x] Tests und Typecheck ausführen. 13 fokussierte Tests sowie Lint, Typecheck und Produktions-Build sind grün.

### Task 7: Deutsche Login-Oberfläche

**Files:** Create `src/components/auth/login-form.tsx`, `login-form.test.tsx`, `src/app/login/page.tsx`; modify `src/app/layout.tsx`, `src/app/page.tsx`.

- [x] Failing Tests schreiben: zugängliche Labels/Fehler auf Deutsch; E-Mail bleibt bei Fehler; Passwort wird geleert; Submit ist während Anfrage deaktiviert; Doppelklick erzeugt eine Übermittlung; Autofill ist korrekt.
- [x] Tests ausführen und erwartetes Scheitern beobachten.
- [x] Formular ausschließlich aus vorhandenen shadcn-Komponenten aufbauen; `lang="de"`, DentPilot-Metadaten und vorhandene Design-Tokens setzen.
- [x] Komponententests, Typecheck und Build ausführen. Sechs fokussierte UI-Tests sowie Desktop-/Mobile-Browserprüfungen sind erfolgreich.

### Task 8: Geschützte Statusseite, Profilprüfung und Logout

**Files:** Create `src/features/auth/current-user.ts`, `current-user.test.ts`, `src/components/auth/logout-button.tsx`, `src/app/status/page.tsx`, `loading.tsx`.

**Produces:** `getCurrentUserContext()` mit `ready` oder `incomplete`; Server Action `logout()`.

- [x] Failing Tests schreiben: ungültige Claims redirecten; RLS-Abfrage lädt eigenes Profil samt Praxis; fehlendes Profil zeigt Einrichtungswarnung; Queryfehler werden nicht als „Profil fehlt“ verschluckt; Logout ruft `signOut`, invalidiert Cache und redirectet.
- [x] Tests ausführen und erwartetes Scheitern beobachten.
- [x] Serverfunktion, Statusseite und Logout minimal implementieren; Rolle deutsch darstellen, internen Enum stabil halten.
- [x] Tests, Typecheck und Build ausführen. 13 fokussierte Tests decken Benutzerkontext, Rollenabbildung, Profilfehler, Statuszustände und Logout ab.

### Task 9: End-to-End-Abnahme und Dokumentationsabschluss

**Files:** Create `tests/auth.spec.ts`, `tests/auth-security.spec.ts`; modify `docs/delivery/acceptance-tests.md`, Feature-Spec und `features/INDEX.md`.

- [ ] Playwright-Tests für automatisierbare Kriterien schreiben: Validierung, identische Credential-Fehler, Doppelklick, Anmeldung, direkter Schutz, Login-Redirect, Statusdaten, Logout und Back-Navigation.
- [ ] Sicherheitsfälle ergänzen: keine sensiblen URL-Parameter, `Cache-Control`, keine Session in Local Storage, zweiter Tab verliert beim nächsten Request Zugriff.
- [ ] Cloud-/Browser-Prüfungen dokumentieren: Browser-Neustart, Dienstunterbrechung, Konto ohne Profil, RLS, Seed zweimal sowie Chrome/Firefox/Edge/Safari-Smoke.
- [ ] Vollständig ausführen: `npm run lint`, `npm test`, `npm run typecheck`, `supabase test db`, `npm run test:e2e`, `npm run build`.
- [ ] Status erst nach belegter Abnahme auf `In Review` setzen; manuelle oder blockierte Punkte ehrlich markieren.

## Danach: MVP-Reihenfolge und Compliance-Gates

Nach PROJ-1 benötigt jedes Roadmap-Feature zuerst Spec und Architekturprüfung. Reihenfolge: PROJ-19, PROJ-2, PROJ-3, PROJ-4, PROJ-5, PROJ-6, PROJ-7, PROJ-9, PROJ-11, PROJ-12, PROJ-10, PROJ-13, PROJ-14, PROJ-15, PROJ-16, PROJ-17, PROJ-8, PROJ-18.

- PROJ-19 und PROJ-31 sind Bestandteile des Real-Data-Gates.
- Vor PROJ-12/14/15 wird je Anbieter eine Datenschutz-/Transferakte benötigt.
- Vor PROJ-15/16 wird der AI-Impact-Check einschließlich AI-Act- und Medizinprodukte-Einstufung abgenommen.
- PROJ-2/4 berücksichtigen Telefonnummern minimal und E.164-normalisiert für PROJ-29.
