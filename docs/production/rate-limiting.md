# Missbrauchsbegrenzung für Auth, Support und Audit

**Stand:** 07.09.2026. SEC-04 offen. Maßgeblich sind D05/D06 und T06 im [Security-Umsetzungsplan](../superpowers/plans/2026-09-07-security-remediation.md).

## Aktueller Stand

Supabase-Auth-Limits und neutrale 429-Behandlung im Login sind vorhanden. Sie begrenzen nicht automatisch die direkten Daten-RPCs. Supportanforderungen und Audit-Verweigerungen erzeugen aktuell je Aufruf neue Datensätze.

## Geplante Grenze

- Mengen-/Parallelitätsgrenzen atomar an der tatsächlichen RPC-Autorisierungsgrenze prüfen. Ein rein lokaler Next.js-Zähler oder ein Proxy nur vor eigenen API-Routen deckt direkte Supabase-Aufrufe nicht ab.
- Praxis und Akteur aus verifiziertem DB-Kontext ableiten; weder frei gelieferte practice_id noch ungeprüfte Forwarded-IP als Vertrauensanker verwenden.
- D05 enthält vorgeschlagene Quoten; vor Umsetzung bestätigen. Idempotenz und Obergrenze offener Freigaben berücksichtigen.
- Widerruf und Logout bleiben bei ausgeschöpfter Anforderungsquote verfügbar.
- D06 legt auditierbare, mengenbegrenzte Drosselung fest. Erlaubte Operationen bleiben bei Auditfehlern gesperrt.
- Parallelität, Fenstergrenze, Schwelle+1 und direkte RPCs auf einem isolierten synthetischen Stack testen; kein unkontrollierter Lasttest im Hosted-Ziel.

## Dienste und Secrets

Es ist kein Upstash-/Redis-Dienst beschlossen oder angebunden. Die frühere generische Installationsanleitung ist abgelöst. Eine neue Anbieterintegration benötigt begründete Architektur-/Datenschutzprüfung und gegebenenfalls Budgetfreigabe. .env.local bleibt auf die beiden öffentlichen Supabase-Appwerte begrenzt; geheime Betriebs-/CI-Werte werden getrennt verwaltet. Der bestehende Auth-Proxy und sein Matcher bleiben erhalten.
