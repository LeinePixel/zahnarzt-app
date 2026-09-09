# Sicherheit

## Geltungsbereich

DentPilot wird später Identitäts-, Termin-, Kommunikations-, Abrechnungs- und Gesundheitsinformationen verarbeiten. Der aktuelle Entwicklungsstand verwendet ausschließlich synthetische Daten. Dieses Dokument beschreibt den belegten technischen Ist-Zustand und die verbindlichen Regeln für Änderungen.

Die vollständigen Datenschutz-, Real-Data- und KI-Gates stehen in docs/architecture/privacy-security-ai-compliance.md.

## Trust Boundaries

1. Browser und öffentliche Eingaben sind nicht vertrauenswürdig.
2. Der Next.js-Proxy aktualisiert Cookies und trifft nur frühe Routing-Entscheidungen.
3. Geschützte Server Components und Server Actions prüfen Identität und Eingaben erneut.
4. PostgreSQL-Rechte und RLS autorisieren Datenzugriffe.
5. Die service_role umgeht RLS und ist deshalb auf explizite CLI-Verwaltung beschränkt.
6. Externe Anbieter bilden eigene Datenabfluss- und Vertragsgrenzen.

## Implementierte Kontrollen

- Cookie-basierte Supabase-SSR-Sitzung mit getrennten Browser-, Server- und Proxy-Clients.
- Serverseitige Identitätsprüfung über getClaims() im Proxy und erneut in der geschützten Seite.
- Server-seitige Zod-Validierung der Login-Eingaben.
- Neutrale Credential-, Rate-Limit- und Dienstfehler ohne Kontenoffenlegung.
- Cache-Control: private, no-store und query-freie Auth-Redirects.
- Minimale Tabellenrechte und RLS für practice und user_profile.
- Negative Tests für anonyme, fremde und schreibende Browserzugriffe.
- Trennung öffentlicher App-Konfiguration von CLI-Seed-Geheimnissen.
- Deaktivierte persistente Auth-Testmedien.
- PROJ-19-Auditgrenze mit RLS, Least-Privilege-RPCs, 90-Tage-Löschroutine und kontrollierten Metadaten ohne medizinische Inhalte oder Freitext.
- Getrennte `portaladmin`-Identitäten; Audit-Einsicht nur über aktive, praxisgebundene und zeitlich begrenzte Supportfreigaben.
- Fail-closed AAL2- und aktuelle Datenbank-Session-Prüfung für geschützte
  RLS-Lesewege und PROJ-19-RPCs; fehlende, widerrufene, abgelaufene oder
  gesperrte Sitzungen liefern keine geschützten Daten.
- Eingecheckte, SHA-pinnte CI-Workflows für Kernverifikation sowie Dependency-
  und Secret-Prüfungen; ihre GitHub-Aktivierung, Branch-Protection und
  betriebliche Behandlung von Funden sind noch nicht nachgewiesen.

## Authentifizierung und Autorisierung

Der Proxy verwendet verifizierte Claims als Routing-Signal. Er ersetzt weder die erneute serverseitige Claims-Prüfung noch RLS. getSession() und ungeprüfte Cookie-Inhalte sind keine Autorisierungsgrundlage.

Die Praxisrollen `rezeption`, `behandler` und `praxisadmin` sind von `portaladmin` getrennt. Praxisrollen können Auditdaten nicht lesen. Nur ein Portaladmin mit aktiver, von der Praxis erteilter Supportfreigabe darf die minimierte Auditansicht lesen; jede Einsicht wird erneut auditiert. Der lokale T04-Stand verlangt hierfür zusätzlich eine höchstens fünf Minuten alte TOTP-Bestätigung. Ein privater serverzeitgestempelter Zustand sperrt nach fünf Minuten ohne erfolgreichen Aktivitäts-Touch und nach acht Stunden. Die reguläre Browseroberfläche sendet einen Touch nur nach menschlich ausgelösten Pointer-, Tastatur- oder Touch-Eingaben; diese Client-Selektion beweist bei einem gestohlenen gültigen Sitzungstoken keine menschliche Anwesenheit. Hosted-TOTP-Akzeptanz und betriebliche Nachweise bleiben vor Produktions- und Real-Data-Freigabe offen.

## Sensitive Daten

Bis zur versionierten Freigabe des Real-Data-Gates sind echte oder re-identifizierbare Patienten-/Gesundheitsdaten in Entwicklung, Tests und Preview-Umgebungen untersagt.

Sensible oder personenbezogene Inhalte bleiben aus:

- URLs und Query-Strings,
- Browser-Storage und unverschlüsselten Caches,
- allgemeinen Logs und Analytics,
- Session Replay, Traces, Screenshots und Videos,
- Support-Artefakten und technischen Anbieterfehlern.

## Secrets und Konfiguration

- .env.local enthält nur NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY.
- .env.seed.local enthält SUPABASE_SERVICE_ROLE_KEY und vier synthetische SEED_*_PASSWORD-Werte für zwei Praxen und die getrennte Portaladmin-Identität.
- Beide realen Dateien sind ignoriert; Example-Dateien enthalten nur Dummywerte.
- Der E2E-App-Server entfernt Seed-Geheimnisse aus seiner Child-Prozess-Umgebung.
- Neue Variablen werden nach Geheimhaltungsbedarf getrennt und in der passenden Example-Datei dokumentiert.

## Externe Dienste und Datenabfluss

Aktiv angebunden ist Supabase. Für Vercel, Soniox, IONOS AI Model Hub, Resend, Sentry und künftige PVS-Anbieter fehlen teilweise Anbieterprüfung, Verträge, Regionen, Retention und Transferbewertung. Bis zur Freigabe dürfen dorthin nur synthetische Daten gelangen.

## Sicherheitsinvarianten

- Serverseitige Identität basiert auf verifizierten Claims.
- Jede praxisbezogene Tabelle besitzt practice_id, RLS, passende Indizes und Isolationstests.
- Normale Benutzeranfragen verwenden niemals service_role.
- Auth-Antworten werden nicht öffentlich oder dauerhaft gecacht.
- Produktivdaten gelangen nicht in Entwicklungs- oder Testumgebungen.
- Änderungen an Auth, RLS, Secrets oder Datenabfluss erhalten fokussierte Negativtests.

## Bekannte Risiken und Lücken

- Die lokale TOTP-/Inaktivitäts-/Re-Authentisierungsschicht ist mit synthetischen Browser-/Edge-E2E-Tests belegt, besitzt aber noch keinen gehosteten Browser- oder Betriebsnachweis; die Inaktivitätskontrolle ist keine kryptografische Anwesenheitsprüfung gegen ein gestohlenes, noch gültiges Sitzungstoken.
- Keine Security Header/CSP in next.config.ts.
- Kein Nachweis, dass die eingecheckten CI-, Dependency- und Secret-Scanning-Workflows auf GitHub aktiv sind, Branch-Protection erzwingen oder Funde betrieblich bearbeitet werden.
- Keine abgenommenen Lösch-, Aufbewahrungs-, Incident- oder Backup-/Restore-Prozesse.
- Kein Produktionsbetrieb und kein externer Penetrationstest.
- Hosted-Cron-Commissioning für die datenbankseitige 90-Tage-Auditlöschung ist nicht betrieblich verifiziert.

## Regeln für Coding-Agenten

- SECURITY.md und die Compliance-Architektur vor Auth-, Daten-, Integrations- oder KI-Arbeit lesen.
- Real-Data-Gate geschlossen halten, bis die versionierte Freigabe dokumentiert ist.
- RLS-Änderungen mit positiven und negativen pgTAP-Fällen belegen.
- Service-Role-Zugriff auf explizite CLI-Verwaltung begrenzen.
- Technische Fehler neutralisieren und sensible Inhalte nicht protokollieren.
- Sicherheitslücken als aktuelle Risiken dokumentieren; Zielkontrollen nicht als implementiert darstellen.

## Vertiefung

- docs/architecture/privacy-security-ai-compliance.md: verbindliches Real-Data-Gate und Zielarchitektur.
- docs/delivery/known-issues.md: nachverfolgte technische Schulden.
- docs/delivery/open-questions.md: offene Rechts-, Anbieter- und Sicherheitsentscheidungen.
- features/PROJ-1-supabase-infrastructure-setup.md: Auth-/RLS-Design und Abnahmeevidenz.
