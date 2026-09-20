# Cookie-, Browser- und HTTPS-Härtung

**Stand:** 07.09.2026. Geplant, nicht implementiert. Maßgeblich sind SEC-03, D10 und T05 im [Security-Umsetzungsplan](../superpowers/plans/2026-09-07-security-remediation.md).

## Aktueller Stand

next.config.ts enthält keine Security Header/CSP. Die SSR-Clients setzen keine eigenen Cookie-Sicherheitsoptionen. Private/no-store ist implementiert; die Weitergabe sicherer Testcookies beweist noch keine sicheren Cookies im echten HTTPS-Login.

## Umsetzung und Abnahme

- Tatsächliche Cookie-Erzeugung unter HTTPS mit Secure prüfen; SameSite und notwendige SSR-Browserfunktion erhalten. HttpOnly ist eine gesonderte Architekturentscheidung, kein blind zu setzendes Flag.
- CSP passend zur installierten Next.js-Version und Hydration mit Nonces entwerfen. Das frühere Beispiel mit pauschalem Script-unsafe-inline ist keine freigegebene Zielkonfiguration.
- frame-ancestors, object-src, base-uri und notwendige Verbindungen explizit begrenzen; MIME-, Framing-, Referrer- und Permissions-Regeln auf den realen Funktionsumfang abstimmen.
- Report-Only nur vorübergehend mit synthetischen Daten; vor Echtdaten wirksam erzwingen. Reports dürfen keine sensiblen URLs, Identitäten oder Inhalte enthalten.
- HSTS erst nach HTTPS-/Domainprüfung aktivieren; includeSubDomains und Preload benötigen bewusste Prüfung aller betroffenen Hosts.
- Reale Login-/Logout-/MFA-/Supportflüsse, falschen Origin, Reverse-Proxy-Header und private/no-store testen. Lokaler Build ersetzt keine Hosting-Abnahme.

Konkrete Dateien, Testreihenfolge und Schließkriterium stehen in T05. Es wird kein bestehender Auth-Proxy durch ein Header-Beispiel ersetzt.
