# Architekturentscheidungen

Dieses Dokument enthält nur langlebige, schwer umkehrbare und ohne Kontext überraschende Entscheidungen. Der vollständige historische Decision Log steht in docs/architecture/decisions.md.

## ADR-001 – Praxissoftware bleibt Source of Truth

**Status:** Confirmed

**Entscheidung:** DentPilot ergänzt bestehende Praxissoftware, übernimmt aber nicht die führende Verantwortung für Patienten, Behandlungen, Abrechnung oder Termine.

**Evidenz:** docs/PRD.md; docs/architecture/decisions.md; ARCHITECTURE.md.

**Rationale:** Ein zweites führendes medizinisches System würde Integrations- und Konsistenzrisiken erzeugen und DentPilot in Richtung vollständiges PVS verschieben.

**Implikationen:** DentPilot referenziert beziehungsweise synchronisiert nur benötigte Daten. Herstelleranbindungen bleiben austauschbare Adapter.

## ADR-002 – Supabase als Auth- und Persistenzgrenze

**Status:** Confirmed

**Entscheidung:** Supabase stellt PostgreSQL, Auth und RLS bereit. Anwendungsdatenzugriff wird durch Tabellenrechte und RLS begrenzt.

**Evidenz:** package.json; supabase/migrations/20260825170000_proj_1_identity.sql; src/lib/supabase/.

**Rationale:** Die relationale Domäne benötigt Transaktionen und referenzielle Integrität; Supabase verbindet diese Anforderungen mit Auth und datenbanknaher Autorisierung.

**Implikationen:** Neue Tabellen entstehen über versionierte Migrationen und erhalten RLS sowie Isolationstests. Ein Austausch wäre eine grundlegende Plattformmigration.

## ADR-003 – Cookie-SSR mit verifizierten Claims

**Status:** Confirmed

**Entscheidung:** Sitzungen werden über @supabase/ssr in Cookies geführt. Proxy und geschützte Server Components verwenden getClaims() statt ungeprüfter Session-Daten.

**Evidenz:** src/lib/supabase/proxy.ts; src/lib/supabase/server.ts; src/features/auth/current-user.ts; zugehörige Tests.

**Rationale:** Next.js-Servercode kann Browser-Storage nicht als serverseitige Sitzung verwenden. Manipulierbare Cookie-Inhalte dürfen keine Identitätsgrundlage sein.

**Implikationen:** Browser-, Server- und Proxy-Clients bleiben getrennt. Proxy, serverseitige Claims-Prüfung und RLS bilden gestaffelte Kontrollen.

## ADR-004 – Single-Tenant-Start mit vorbereiteter Praxisgrenze

**Status:** Confirmed

**Entscheidung:** Der MVP startet mit einer Praxis, führt practice und practice_id aber von Beginn an als Tenant-Grenze und aktiviert RLS.

**Evidenz:** supabase/migrations/20260825170000_proj_1_identity.sql; docs/architecture/data-model.md.

**Rationale:** Vollständiger Multi-Tenant-Betrieb wäre für den MVP unnötig; eine nachträgliche Einführung der Tenant-Grenze wäre teuer und sicherheitskritisch.

**Implikationen:** Praxisbezogene Tabellen erhalten practice_id, Indizes, RLS und Cross-Tenant-Negativtests. Multi-Praxis-Mitgliedschaften bleiben bis PROJ-24 offen.

## ADR-005 – PVS-Integrationen verwenden Adapter

**Status:** Confirmed

**Entscheidung:** Herstellerabhängige PVS-Daten werden durch Adapter in ein internes Modell übersetzt. Der MVP entwickelt zunächst gegen einen Mock-PVS-Service.

**Evidenz:** docs/PRD.md; docs/architecture/overview.md; features/INDEX.md, PROJ-2, PROJ-3 und PROJ-23.

**Rationale:** Es existiert kein kurzfristig verfügbarer öffentlicher Dampsoft-API-Zugang. Direkte Herstellerkopplung würde Geschäftslogik und Produktentwicklung blockieren.

**Implikationen:** Herstellerbegriffe und Transportformate bleiben außerhalb der Feature-Logik. Eine echte Anbindung ersetzt den Adapter statt die Anwendung umzubauen.

## ADR-006 – Real-Data-Gate vor Patienten-/Gesundheitsdaten

**Status:** Confirmed

**Entscheidung:** Entwicklung und Tests verwenden ausschließlich synthetische Daten, bis das versionierte Real-Data-Gate fachlich und technisch freigegeben ist.

**Evidenz:** SECURITY.md; docs/architecture/privacy-security-ai-compliance.md; features/PROJ-1-supabase-infrastructure-setup.md.

**Rationale:** Gesundheits- und zusammengeführte Praxisdaten besitzen hohen Schutzbedarf. Synthetische Entwicklung darf keine unkontrollierte spätere Produktionsfreigabe erzeugen.

**Implikationen:** PROJ-19, PROJ-31, Rechtsgrundlagen, Anbieterprüfungen, Löschung, Incident Response und weitere dokumentierte Kontrollen bleiben Vorbedingungen für echte Daten.

## ADR-007 – KI bereitet vor, Regeln und Menschen entscheiden

**Status:** Confirmed

**Entscheidung:** KI extrahiert oder bereitet Informationen vor. Nachvollziehbare Regeln bestimmen reproduzierbare Abläufe; qualifizierte Menschen behalten die Entscheidung und Freigabe.

**Evidenz:** docs/PRD.md; docs/architecture/decisions.md; docs/architecture/privacy-security-ai-compliance.md.

**Rationale:** Durchgängig autonome medizinische oder abrechnungsrelevante Entscheidungen wären schwer nachvollziehbar, korrigierbar und regulatorisch riskant.

**Implikationen:** KI-Funktionen benötigen Human Oversight, Transparenz, Qualitätsgrenzen, Versionierung und einen eigenen Impact-Check.

## ADR-008 – MFA- und Sitzungsgrenze wird server- und datenbankseitig erzwungen

**Status:** Confirmed; lokale T05-Umsetzung in Review

**Entscheidung:** Alle aktuellen Praxisrollen und `portaladmin` verwenden
TOTP-MFA. Nach fünf Minuten menschlicher Inaktivität wird global gesperrt oder
abgemeldet; eine Sitzung dauert höchstens acht Stunden. JWTs leben fünf
Minuten, und ein Widerruf oder eine Kontensperre wird für neue geschützte
Datenoperationen innerhalb von höchstens 60 Sekunden gegen einen aktuellen
Server-/Datenbank-Sitzungszustand geprüft. AAL2 wird in RLS und jeder
geschützten `SECURITY DEFINER`-RPC erzwungen. Sensible Supportaktionen
benötigen eine Re-Authentisierung, die höchstens fünf Minuten alt ist.

**Evidenz:** Nutzerfreigabe vom 2026-09-07; `features/PROJ-31-session-hardening.md`; `docs/superpowers/specs/2026-09-07-security-remediation-design.md`.

**Rationale:** Nur ein aktueller, server- und datenbankseitig erzwungener
Sitzungszustand kann Sperrung, Widerruf, AAL und Re-Authentisierung unabhängig
von Browser- oder UI-Zustand durchsetzen.

**Lokaler Stand (10.09.2026):** Der DB-Zustand ist pro verifizierter
`session_id`/Benutzer-ID privat und ausschließlich serverzeitgestempelt. Der
SSR-Gate gibt nur `mfa_required`, `reauth_required` oder `ready` zurück;
regelmäßige Aktivität kann nur einen vorhandenen, nicht abgelaufenen Zustand
berühren. Support- und Audit-RPCs verlangen frisches TOTP. Der Stand ist noch
kein Hosted- oder Real-Data-Gate-Nachweis.

**Implikationen:** Das bestehende SSR-Cookie-Modell bleibt erhalten. `Secure`
über HTTPS sowie eine nonce-basierte CSP ohne breite Skript-Ausnahme
`unsafe-inline` sind verbindliche Kontrollen. Die CSP ist lokal implementiert
und getestet, bleibt aber ebenso wie die Entscheidung selbst kein Hosted- oder
Real-Data-Gate-Nachweis.
