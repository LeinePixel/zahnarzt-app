# PROJ-31: Sitzungshärtung, MFA und Re-Authentisierung

## Status: In Progress
**Created:** 2026-08-24

**Last Updated:** 2026-09-09

**Priority:** P1

## Zusammenfassung

PROJ-31 definiert die verbindliche MFA-, Sitzungs- und Re-Authentisierungsgrenze
für DentPilot. Es ist eine geplante Sicherheitsvoraussetzung vor echten oder
re-identifizierbaren Daten; diese Spec ist kein Implementierungs-, Hosting- oder
Real-Data-Gate-Nachweis.

## Dependencies

- PROJ-1 (Supabase-Identität, SSR-Cookies, verifizierte Claims und RLS)
- PROJ-19 (praxisgebundene Audit- und Supportfreigabegrenze)

## Beschlossene Entscheidungen (2026-09-07)

| ID | Entscheidung | Status |
|---|---|---|
| D01 | TOTP-MFA für `rezeption`, `behandler`, `praxisadmin` und `portaladmin`; kein dauerhafter Recovery-Bypass | beschlossen |
| D02 | Globale Sperre oder Abmeldung nach fünf Minuten menschlicher Inaktivität; maximale Sitzung acht Stunden | beschlossen |
| D03 | JWT-Laufzeit fünf Minuten; Widerruf oder Kontensperre wirkt bei neuen geschützten Datenoperationen innerhalb von höchstens 60 Sekunden über eine aktuelle Server-/Datenbank-Sitzungsprüfung | beschlossen |
| D04 | AAL2 wird in RLS und jeder geschützten `SECURITY DEFINER`-RPC erzwungen | beschlossen |
| D10 | Bestehendes SSR-Cookie-Modell bleibt; Cookies sind über HTTPS `Secure`; CSP ist nonce-basiert und enthält keine breite Skript-Ausnahme `unsafe-inline` | beschlossen |

Für sensible Supportaktionen ist eine höchstens fünf Minuten alte
Re-Authentisierung erforderlich. UI-Zustand, lokale Timer oder eine offene
Browserseite sind keine Autorisierungsgrundlage.

## Weiterhin offene Entscheidungen

| ID | Offener Gegenstand |
|---|---|
| D05 | Support-/Audit-Quoten und ihre Auditbehandlung |
| D06 | Retention und Löschweg für Supportfreigaben |
| D07 | Empfänger und Kanal für Cron-/Scheduler-Alarmierung |
| D08 | Backup-RPO/RTO und dokumentierte Betriebs- sowie Wiederherstellungsabläufe |
| D09 | Rechts-/Datenschutzbereitschaft einschließlich der erforderlichen Freigaben vor dem Real-Data-Gate |

Diese Punkte bleiben offen. Die Umsetzung darf dafür weder Werte, Empfänger,
externe Dienste noch Rechtsfreigaben annehmen.

## Sicherheits- und Architekturgrenzen

- Der bestehende Next.js-/Supabase-SSR-Cookie-Ansatz bleibt bestehen; es wird
  keine ungetestete Umstellung auf eine ausschließlich serverseitige oder
  HttpOnly-Sitzungsarchitektur vorweggenommen.
- Der Proxy trifft nur frühe Routing-Entscheidungen. Geschützte Serverpfade
  verifizieren Claims erneut; PostgreSQL-Rechte, RLS und geschützte RPCs
  bleiben die endgültige Autorisierungsgrenze.
- Jede geschützte Datenoperation prüft aktuellen server-/datenbankseitigen
  Sitzungsstatus und AAL2. Widerruf/Kontensperre darf nicht erst beim nächsten
  UI-Refresh wirken.
- PROJ-19-Supportaktionen wahren außerdem Praxisbindung, aktive Freigabe,
  Kein-Export-, 90-Tage-Audit- und Kein-Break-Glass-Grenzen.

## Akzeptanzkriterien

- [ ] Jede aktuelle Rolle und `portaladmin` kann ohne TOTP-MFA keine
  geschützte Sitzung erhalten oder fortsetzen.
- [ ] Nach fünf Minuten menschlicher Inaktivität ist der Zugriff global
  gesperrt oder abgemeldet; nach acht Stunden endet die Sitzung unabhängig von
  Aktivität.
- [ ] Ein widerrufenes oder gesperrtes Konto kann innerhalb von höchstens 60
  Sekunden keine neue geschützte Datenoperation erfolgreich ausführen.
- [ ] RLS und jede geschützte `SECURITY DEFINER`-RPC verweigern fehlendes AAL2
  unabhängig von Proxy, UI oder Browserzustand.
- [ ] Eine sensible Supportaktion wird ohne höchstens fünf Minuten alte
  Re-Authentisierung verweigert.
- [ ] Die CSP erlaubt keine breite Skript-Ausnahme `unsafe-inline`; notwendige
  Skripte verwenden serverseitig erzeugte Nonces.
- [ ] Alle Nachweise arbeiten ausschließlich mit synthetischen Daten.

## T03-Abnahmeevidenz — lokal und synthetisch (08.09.2026)

- Die Datenbankgrenze verlangt für geschützte direkte RLS-Lesewege und die
  geschützten PROJ-19-RPCs einen passenden AAL2-JWT-Claim, eine aktuelle
  `auth.sessions`-Zeile derselben Identität, einen nicht abgelaufenen
  `not_after`-Zeitpunkt sowie ein weder gelöschtes noch aktuell gesperrtes
  Konto. Fehlende, widerrufene oder ungültige Angaben ergeben nur eine neutrale
  Verweigerung.
- `npx supabase test db --local` bestand mit 4 Dateien und 122 pgTAP-Tests,
  einschließlich positiver AAL2- und negativer AAL1-, fehlender-, abgelaufener-
  und gesperrter-Session- sowie RLS-/RPC-Nachweise.
- Die konfigurierte JWT-Laufzeit beträgt lokal fünf Minuten und die
  Maximalsitzung acht Stunden. Die fünfminütige menschliche Inaktivität,
  TOTP-Einschreibung, Re-Authentisierungsalter und alle Hosted-Nachweise bleiben
  ausdrücklich offen und werden nicht durch diese Evidenz behauptet.

## T04-Abnahmeevidenz — lokal und synthetisch (09.09.2026)

- Der private Sitzungszustand ist an die verifizierte `session_id` und
  Benutzer-ID gebunden, erhält ausschließlich Datenbankzeitstempel und wird
  zusammen mit der Auth-Sitzung gelöscht. Ein neuer Zustand entsteht nur mit
  AAL2 und einem höchstens fünf Minuten alten TOTP-AMR-Zeitstempel im JWT.
  Eine Re-Authentisierung erneuert Aktivität und TOTP-Frische, niemals den
  Beginn der absoluten Acht-Stunden-Grenze.
- Der Proxy und geschützte Serverpfade nutzen nur die datenlose Gate-Antwort
  `mfa_required`, `reauth_required` oder `ready`. RLS bleibt verbindlich:
  fünf Minuten ohne serverseitig bestätigte menschliche Aktivität oder acht
  Stunden Sitzungsalter sperren direkte Lesewege und Touches.
- `request_support_access`, `activate_support_access`,
  `revoke_support_access` und `read_audit_events` verlangen zusätzlich eine
  höchstens fünf Minuten alte TOTP-Bestätigung. `is_portal_admin` bleibt ein
  datenloser Status-/Bootstrap-Check. Eine Ablehnung bei abgelaufener
  TOTP-Frische wird für die sensiblen Supportaktionen dauerhaft als `denied`
  auditiert.
- Der Browser verwendet nur `pointerdown`, `keydown` und `touchstart` als
  Aktivität und speichert weder QR, Geheimnis, Code, JWT noch Sitzungs-ID in
  URL oder Browser-Storage. Diese Client-Selektion ist keine kryptografische
  Anwesenheitsprüfung gegen ein gestohlenes, noch gültiges Sitzungstoken. Die
  lokale TOTP-Konfiguration ist aktiviert. Am 09.09.2026 bestanden mit
  ausschließlich synthetischen Konten Lint, Typecheck, 107 Vitest-Tests,
  149 pgTAP-Tests, der Produktions-Build und 17 Playwright-Browser-/Edge-Tests.
  Hosted- und betriebliche Nachweise bleiben explizite Abnahmetore.

## Out of Scope

- Festlegung von D05–D09.
- Öffnung des Real-Data-Gates, Produktionshosting, Cloud-Konfiguration oder
  rechtliche Freigabe.
- Änderung der PROJ-19-Rollen, Supportfreigaben, Audit-Retention, No-Export-
  oder No-Break-Glass-Entscheidungen.

## Verweise

- `docs/superpowers/specs/2026-09-07-security-remediation-design.md`
- `docs/architecture/decisions.md`
- `docs/delivery/open-questions.md`
- `features/PROJ-19-audit-logging-and-role-permissions.md`
