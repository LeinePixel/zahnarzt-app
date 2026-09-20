# PROJ-31 – Sitzungshärtung und MFA

**Status:** Planned  
**Priorität:** P0  
**Abhängigkeiten:** PROJ-1, PROJ-19  
**Stand:** 07.09.2026

## Ziel

Jeder Zugriff auf geschützte DentPilot-Daten verlangt eine verifizierte Supabase-Sitzung mit AAL2. TOTP ist der verpflichtende zweite Faktor für Praxis- und Portalidentitäten. Die Datenbank erzwingt diese Grenze auch bei direkten Data-API- und RPC-Aufrufen.

## Festgelegte technische Sicherheitsparameter

- MFA: TOTP für alle bestehenden Rollen; AAL1 darf keine geschützten Praxis-, Audit- oder Supportdaten lesen oder ändern.
- Ablauf: JWT höchstens fünf Minuten, Supabase-Sitzung höchstens acht Stunden. Der Client sperrt nach fünf Minuten ohne menschliche Interaktion und meldet global ab; Hintergrundrefresh zählt nicht als Aktivität.
- Widerruf: Logout beendet alle Sitzungen. Access Tokens bleiben wegen JWT-Technik bis zu fünf Minuten gültig; die Datenbank verweigert geschützte Aktionen zusätzlich anhand des AAL. Eine echte serverseitige Sperrliste ist erst zulässig, wenn sie mit der Hosted-Supabase-Sitzungs-API verifiziert ist.
- Wiederherstellung: Keine Selbstbedienungsumgehung und keine dauerhafte Ausnahme. Ein Verlust des TOTP-Faktors erfordert einen getrennten, dokumentierten administrativen Wiederherstellungsprozess; bis dahin bleibt der Datenzugriff gesperrt.
- Bootstrap: MFA-Einrichtung, Challenge und Verifikation sind die einzigen AAL1-Flows nach dem Passwortlogin. Sie erhalten weder Praxis- noch Auditdaten.

Diese technischen Vorgaben konkretisieren D01–D04 aus dem Sicherheitsentwurf. Betriebs- und Datenschutzentscheidungen außerhalb des Repositories bleiben weiterhin offen.

## Ablauf

1. Ein Passwortlogin liefert AAL1 und führt ausschließlich zur MFA-Prüfung.
2. Ohne verifizierten Faktor wird eine TOTP-Einrichtung angeboten; QR-/TOTP-Secret bleibt nur im Arbeitsspeicher des Browsers.
3. Mit Faktor erzeugt der Browser Challenge und Verifikation. Erst ein neuer AAL2-Token darf geschützte Routen und Datenoperationen verwenden.
4. Der Server prüft Claims erneut. PostgreSQL prüft `auth.jwt() ->> 'aal'` in restriktiven RLS-Policies und SECURITY-DEFINER-RPCs.
5. Nach Inaktivität oder Ablauf meldet der Browser global ab und leitet ohne Query-Daten auf `/login`.

## Grenzen

- `getClaims()` bleibt die serverseitige Identitätsprüfung. `getSession()` und Browserzustand sind keine Autorisierungsgrundlage.
- Der Proxy ist nur Routing-/Cookie-Grenze; er ersetzt keine AAL-Prüfung im Server oder in PostgreSQL.
- Service-Role und Auth-Systemtabellen werden nicht für normale Anfragen verwendet oder verändert.
- Keine echte Identitäts-, MFA- oder Recovery-Daten in Tests, URLs, Logs oder Screenshots.

## Akzeptanzkriterien

- AAL1 wird bei direkter Abfrage von `practice` und `user_profile` sowie jeder geschützten RPC verweigert.
- AAL2 darf ausschließlich innerhalb der bestehenden Rollen-/Praxisgrenzen zugreifen.
- AAL1 kann TOTP einrichten und verifizieren, aber keine Kontostatus- oder Auditdaten laden.
- Logout, Ablauf und zweiter Tab verlieren beim nächsten Request den Zugriff; ein Token-Replay erhält maximal bis zum kurzen JWT-Ablauf eine technische Gültigkeit und darf keine durch die Datenbank gesperrte Aktion durchführen.
- Falsche, abgelaufene oder wiederholte MFA-Codes liefern neutrale Fehler.
- E2E prüft Einrichtung, Challenge, AAL1-Ablehnung, AAL2-Erlaubnis, Inaktivitätssperre und Browserneustart mit synthetischen Konten.

## Nicht enthalten

- Benutzerverwaltung, eine eigene Identity-Plattform oder Patientendaten.
- Betriebliches Break-Glass ohne dokumentierte, separate Freigabe.
- Eine Behauptung, dass Hosted-Supabase-Konfiguration, App-Deployment oder die Real-Data-Freigabe bereits abgeschlossen sind.
