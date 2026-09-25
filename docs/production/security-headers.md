# Cookie-, Browser- und HTTPS-Härtung

**Stand:** 26.09.2026. Lokale Implementierung in Arbeit; die Abnahme auf einem synthetischen HTTPS-Ziel ist offen. Maßgeblich sind SEC-03, D10 und T05 im [Security-Umsetzungsplan](../superpowers/plans/2026-09-07-security-remediation.md).

## Implementierter Stand

Die drei `@supabase/ssr`-Clients verwenden `SameSite=Lax` und in der Produktionskonfiguration `Secure`. Der Next.js-Proxy setzt auf dynamischen Antworten eine Nonce-CSP für Anfrage und Antwort sowie `private, no-store`, Frame-, MIME-, Referrer- und Permissions-Header. Die Nonce-Weitergabe folgt der mit dem Projekt installierten Next.js-Dokumentation (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). Der Script-Pfad erlaubt kein pauschales `unsafe-inline`. In Entwicklung ist `unsafe-eval` für Next.js zugelassen.

HSTS wird in der Produktionskonfiguration nur auf HTTPS-Antworten ausgegeben, deren Host exakt `SECURITY_HSTS_HOST` entspricht. Die Variable darf erst nach Prüfung des konkreten HTTPS-Hosts gesetzt werden. Die Richtlinie lautet `max-age=31536000`; `includeSubDomains` und `preload` sind nicht aktiviert. Ein `X-Forwarded-Proto`-Header allein schaltet HSTS nicht frei. Der Hosting-Proxy muss seine öffentlichen Host- und Protokollheader vertrauenswürdig an Next.js übergeben.

Browserlesbare Supabase-Auth-Cookies bleiben Teil des freigegebenen SSR-Clientmodells. `HttpOnly` wird nicht pauschal erzwungen, da der Browserclient die Sitzung benötigt. Es dürfen keine Service-Role-Schlüssel oder Seed-Zugangsdaten in die App-Umgebung gelangen.

Für einen ausdrücklich synthetischen HTTPS-Host kann `SECURITY_CSP_REPORT_ONLY_HOST` auf dessen exakten Hostnamen gesetzt werden. Nur dort wird die Antwort-CSP dann als `Content-Security-Policy-Report-Only` gesendet; die Anfrage-CSP bleibt für die Nonce-Erkennung von Next.js erhalten. Ohne diese Variable wird die CSP erzwungen. Es gibt bewusst keinen automatischen Report-Endpunkt: Browser-Verstöße sollen auf dem synthetischen Testziel lokal ausgewertet werden, ohne URLs oder Inhalte an einen Drittanbieter zu senden. Nach der Prüfung die Variable entfernen und die erzwungene Richtlinie erneut testen.

## Noch offene Abnahme

- Auf einem ausschließlich synthetischen HTTPS-Ziel tatsächliche `Set-Cookie`-Attribute, Login, Logout, MFA, Re-Authentisierung, Support und Server Actions im Browser prüfen. Der lokale Produktionstest verwendet HTTP auf `localhost` und ersetzt diesen Nachweis nicht.
- CSP dort zuerst kontrolliert als Report-Only prüfen; Browser-Verstöße dürfen nicht als rohe URLs, Query-Parameter, Identitäten, Bodies, Tokens oder medizinische Inhalte persistiert oder übertragen werden. Erst nach Bereinigung der Verstöße die Richtlinie erzwingen. Die Umschaltung auf dem Hosting-Ziel ist noch nicht erfolgt.
- HTTPS-Weiterleitung, Host-/Proxy-Header, falschen `Origin`, HSTS-Domainumfang und Header auf Redirects und Fehlerantworten am Hosting-Ziel prüfen. `SECURITY_HSTS_HOST` erst danach auf den geprüften Host setzen.
- Manuelle Safari- und Praxisarbeitsplatzprobe dokumentieren. Das Real-Data-Gate bleibt geschlossen.
