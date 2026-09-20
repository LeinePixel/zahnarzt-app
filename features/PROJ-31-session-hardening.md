# PROJ-31 – Sitzungshärtung und MFA

**Status:** In Progress
**Priorität:** P0  
**Abhängigkeiten:** PROJ-1, PROJ-19  
**Stand:** 20.09.2026

## Ziel

Jeder Zugriff auf geschützte DentPilot-Daten verlangt eine verifizierte Supabase-Sitzung mit AAL2. TOTP ist der verpflichtende zweite Faktor für Praxis- und Portalidentitäten. Die Datenbank erzwingt diese Grenze auch bei direkten Data-API- und RPC-Aufrufen.

## Festgelegte technische Sicherheitsparameter

- MFA: TOTP für alle bestehenden Rollen; AAL1 darf keine geschützten Praxis-, Audit- oder Supportdaten lesen oder ändern.
- Ablauf: JWT höchstens fünf Minuten, Supabase-Sitzung höchstens acht Stunden. Der Client sperrt nach fünf Minuten ohne menschliche Interaktion und meldet global ab; Hintergrundrefresh zählt nicht als Aktivität.
- Widerruf: Logout beendet alle Sitzungen. Access Tokens bleiben wegen JWT-Technik bis zu fünf Minuten gültig; die Datenbank verweigert geschützte Aktionen zusätzlich anhand des AAL. Eine echte serverseitige Sperrliste ist erst zulässig, wenn sie mit der Hosted-Supabase-Sitzungs-API verifiziert ist.
- Wiederherstellung: Keine Selbstbedienungsumgehung und keine dauerhafte Ausnahme. Ein Verlust des TOTP-Faktors erfordert einen getrennten, dokumentierten administrativen Wiederherstellungsprozess; bis dahin bleibt der Datenzugriff gesperrt.
- Bootstrap: MFA-Einrichtung, Challenge und Verifikation sind die einzigen AAL1-Flows nach dem Passwortlogin. Sie erhalten weder Praxis- noch Auditdaten.

Diese technischen Vorgaben konkretisieren die am 20.09.2026 freigegebenen
Entscheidungen D01–D04 aus dem Sicherheitsentwurf. Betriebs- und
Datenschutzentscheidungen außerhalb des Repositories bleiben weiterhin offen.

## Ablauf

1. Ein Passwortlogin liefert AAL1 und führt ausschließlich zur MFA-Prüfung.
2. Ohne verifizierten Faktor wird eine TOTP-Einrichtung angeboten; QR-/TOTP-Secret bleibt nur im Arbeitsspeicher des Browsers.
3. Mit Faktor erzeugt der Browser Challenge und Verifikation. Erst ein neuer AAL2-Token darf geschützte Routen und Datenoperationen verwenden.
4. Der Server prüft Claims erneut. PostgreSQL prüft `auth.jwt() ->> 'aal'` in restriktiven RLS-Policies und SECURITY-DEFINER-RPCs.
5. Nach Inaktivität oder Ablauf meldet der Browser global ab und leitet ohne Query-Daten auf `/login`.

## User Stories

- Als Praxismitglied oder Praxisadmin möchte ich nach dem Passwortlogin meinen
  TOTP-Faktor einrichten oder bestätigen, damit erst eine AAL2-Sitzung Zugriff
  auf geschützte Praxisdaten erhält.
- Als Portaladmin möchte ich dieselbe MFA-Grenze erfüllen, bevor ich eine
  Supportfreigabe aktiviere oder Auditmetadaten lese.
- Als Praxisverantwortliche möchte ich, dass unbeaufsichtigte Arbeitsplätze
  nach fünf Minuten gesperrt werden und Sitzungen spätestens nach acht Stunden
  enden.
- Als Sicherheitsverantwortliche möchte ich, dass direkte Tabellen- und
  RPC-Aufrufe dieselben AAL-, Sperr- und Ablaufregeln wie die Oberfläche
  erzwingen.
- Als Nutzer mit verlorenem Faktor möchte ich einen getrennt verifizierten,
  dokumentierten Wiederherstellungsprozess erhalten, ohne dass ein
  dauerhafter MFA-Bypass entsteht.

## Verbindliche Sitzungssemantik

- **Beginn:** Die absolute Acht-Stunden-Frist beginnt mit der erfolgreichen
  Passwortanmeldung. Faktorprüfung, Tokenrefresh, Seitenwechsel und ein zweiter
  Tab starten sie nicht neu.
- **Menschliche Aktivität:** Nur fokussierte Tastatur-, Zeiger- oder
  Touchinteraktion im sichtbaren DentPilot-Fenster setzt die lokale
  Fünf-Minuten-Frist zurück. Timer, Netzwerkverkehr, Polling, Tokenrefresh und
  bloße Sichtbarkeit zählen nicht.
- **Mehrere Tabs:** Ein erfolgreicher menschlicher Aktivitätsimpuls darf die
  lokale Sperrfrist derselben Browser-Sitzung tabübergreifend aktualisieren.
  Logout, Sperre oder absoluter Ablauf werden ebenfalls tabübergreifend
  übernommen. Jeder Tab prüft den Serverzustand beim nächsten geschützten
  Request erneut.
- **Hintergrund und offline:** Ein Hintergrundtab verlängert keine Frist. Bei
  fehlender Verbindung sperrt der Client spätestens zum lokalen Grenzwert und
  gibt nach Rückkehr erst nach erfolgreicher serverseitiger Prüfung wieder
  frei. Änderungen der Geräteuhr dürfen keine serverseitige Frist verlängern.
- **Grenzwerte:** Bei `elapsed >= 5 Minuten` gilt der Arbeitsplatz als inaktiv;
  bei `elapsed >= 8 Stunden` ist die Sitzung beendet. Serverseitige Zeit ist
  für Datenzugriff maßgeblich.
- **Laufende Anfragen:** Eine vor Ablauf autorisierte, atomare
  Datenbankoperation darf zu Ende laufen. Neue Datenbankoperationen und jede
  weitere Seite eines paginierten Lesevorgangs prüfen den aktuellen Zustand
  erneut. Lang laufende oder gestreamte Praxisdatenoperationen gehören nicht
  zum MVP.
- **Sensible Supportaktionen:** Aktivierung einer Freigabe und Audit-Lesen
  verlangen AAL2 sowie eine höchstens fünf Minuten alte erfolgreiche
  Authentisierung. Die erneute Authentisierung bestätigt den vorhandenen
  TOTP-Faktor und verlängert weder die absolute Sitzung noch eine
  Supportfreigabe.

## Recovery- und Fehlerregeln

- Faktorverlust führt immer in einen getrennten Administrationsprozess mit
  Identitätsprüfung, dokumentierter Entscheidung und Widerruf bestehender
  Sitzungen. Recovery-Codes, E-Mail-Links oder Supportfreigaben sind im MVP
  kein Ersatzfaktor.
- Ein unvollständiger, unbekannter, gesperrter, widerrufener oder technisch
  nicht prüfbarer Sitzungszustand wird verweigert. Die Oberfläche zeigt eine
  neutrale deutsche Meldung ohne Identitäts-, Faktor- oder Tokenhinweise.
- Wiederholte, falsche und abgelaufene TOTP-Codes werden neutral behandelt und
  unterliegen den Auth-Provider-Limits. Secrets, QR-Inhalte und Codes werden
  nicht geloggt oder dauerhaft im Browser gespeichert.
- Ein Browserneustart darf eine innerhalb aller Fristen gültige AAL2-Sitzung
  fortsetzen. Er darf Inaktivitäts-, absolute Sitzungs- oder
  Re-Authentisierungsgrenzen nicht zurücksetzen.

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
