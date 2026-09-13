# Sicherheitsheader – aktueller Stand

## Implementierte Content Security Policy

Der Next.js-Proxy erzeugt pro Antwort eine kryptografisch zufällige Nonce und
setzt dieselbe Content Security Policy im Request- und Response-Header. Die
Richtlinie wird bereits erzwungen; es gibt keinen Report-Only-Betrieb und keine
breite Skript-Ausnahme `unsafe-inline`.

Die Richtlinie begrenzt Skripte auf `self`, die serverseitig erzeugte Nonce und
`strict-dynamic`. Sie beschränkt Verbindungen auf `self` und den konfigurierten
Supabase-Ursprung, verbietet Objektinhalte und verhindert Einbettung über
`frame-ancestors 'none'`. In der lokalen Entwicklung kommt ausschließlich
`unsafe-eval` für die Entwicklungswerkzeuge hinzu; das ist keine
Produktionsrichtlinie.

Der Proxy setzt außerdem `Cache-Control: private, no-store` auf seine
Antworten. Das verhindert, dass geschützte Antworten durch gemeinsame Caches
weitergegeben werden.

## Noch offene Produktionsheader

Die folgenden Header sind noch nicht implementiert oder betrieblich belegt und
bleiben vor dem Real-Data-Gate offene Arbeit:

- `Strict-Transport-Security`, nach bestätigter HTTPS- und Domain-Konfiguration.
- `X-Content-Type-Options: nosniff`.
- eine dokumentierte `Referrer-Policy`.
- eine dokumentierte `Permissions-Policy`.

Sie dürfen nicht über ein pauschales `next.config.ts`-Beispiel ergänzt werden,
ohne die konkrete Hosting- und Proxy-Konfiguration zu prüfen.

## Hosted-Verifikation

Vor einer Freigabe werden auf jeder ausgelieferten Route geprüft:

1. `Content-Security-Policy` ist ein erzwungener Header, kein
   `Content-Security-Policy-Report-Only`.
2. `script-src` enthält keine breite `unsafe-inline`-Ausnahme und die
   gerenderten Next.js-Skripte tragen die im Header erlaubte Nonce.
3. `connect-src` enthält nur `self` und den vorgesehenen Supabase-Ursprung.
4. Die noch offenen Header sind implementiert, getestet und mit der finalen
   HTTPS- und Domain-Konfiguration abgestimmt.

Die lokalen Proxy- und Browser-/Edge-Tests prüfen bereits die erzwungene CSP,
das Fehlen von `unsafe-inline` und die Nonce-Bindung. Sie ersetzen keinen
Hosted- oder Real-Data-Gate-Nachweis.
