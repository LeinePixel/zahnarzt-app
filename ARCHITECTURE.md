# Architektur

## Systemüberblick

DentPilot ergänzt bestehende Zahnarzt-Praxissoftware um Workflows, CRM, Kommunikation, Auswertung und später KI-gestützte Vorbereitung. Die Praxissoftware bleibt Source of Truth für medizinische und abrechnungsrelevante Daten.

Ausführbar sind PROJ-1 (Next.js-/Supabase-Anmeldung, Profil, geschützter Kontostatus, RLS und synthetischer Seed) sowie PROJ-19 (Audit-Logging und Rollenautorisierung). PROJ-19 trennt `portaladmin`-Identitäten von Praxisrollen und erlaubt Audit-Einsicht nur nach einer zeitlich begrenzten, praxisinitiierten Supportfreigabe. Patienten-, Termin-, PVS-, CRM-, Kommunikations-, Workflow- und KI-Funktionen sind weiterhin geplant, aber nicht implementiert.

## Aktuelle Laufzeitarchitektur

~~~text
Browser
  │ Supabase-Sitzung im Cookie
  ▼
Next.js-16-Proxy
  │ Cookie-Refresh und frühes Routing mit verifizierten Claims
  ▼
Server Components / Server Actions
  │ erneute Claims-Prüfung und Zod-Validierung
  ▼
Supabase-SSR-Server-Client
  ▼
Supabase Auth + PostgreSQL-Rechte + RLS
  ▼
practice / user_profile
~~~

Der Proxy ist kein Autorisierungssystem. Serverseitige Identitätsprüfung und Datenbank-RLS bleiben eigenständige Trust Boundaries.

## Anwendungsschichten

- Präsentation: src/app/ und src/components/.
- Feature-/Domainlogik: src/features/auth/ und src/features/audit/.
- Supabase-Zugriff: src/lib/supabase/ mit getrennten Clients für Browser, Server und Proxy.
- Persistenz: supabase/migrations/ und PostgreSQL-RLS.
- CLI-Verwaltung: supabase/seed.ts mit separater geheimer Umgebung.
- Verifikation: co-located Vitest-Tests, supabase/tests/ und tests/.

Login und Logout verwenden Server Actions; PROJ-1 besitzt keine eigene API-Schicht.

## Daten und Autorisierung

Die Migrationen definieren `practice`, `user_profile`, `portal_admin`, Supportfreigaben und Audit-Ereignisse. Praxisrollen können nur ihren eigenen Kontokontext lesen und keine Auditdaten einsehen; `portaladmin` ist eine getrennte Identität ohne `user_profile` und erhält Audit-Metadaten nur während einer aktiven praxisgebundenen Supportfreigabe. Browserrollen besitzen keine direkten Schreibrechte auf diese Tabellen. Die `service_role` ist ausschließlich für explizite CLI-Verwaltung vorgesehen.

Die Anwendung trägt die Praxisgrenze im Schema und erzwingt sie mit RLS, Tabellenrechten und autorisierten RPCs. Der lokale PROJ-31-T04-Stand ergänzt sie durch einen privaten, serverzeitgestempelten Sitzungszustand: AAL2 und eine aktuelle Auth-Sitzung sind Voraussetzung; fünf Minuten ohne erfolgreichen Aktivitäts-Touch oder acht Stunden Sitzungsalter sperren RLS und RPCs. Die Browseroberfläche löst Touches ausschließlich bei Pointer-, Tastatur- oder Touch-Eingaben aus; ein Server kann bei einem weiterhin gültigen, gestohlenen Sitzungstoken jedoch keine physische menschliche Handlung beweisen. Sensible Support-/Audit-RPCs verlangen zusätzlich eine höchstens fünf Minuten alte TOTP-Bestätigung. Der SSR-Gate liefert nur `mfa_required`, `reauth_required` oder `ready`; Proxy und UI sind nie die Autorisierungsgrenze. Hosted-Akzeptanz, Betriebsnachweise und das Real-Data-Gate bleiben offen.

## Externe Integrationen

Produktiv angebunden ist nur Supabase. Vercel ist geplant, aber nicht eingerichtet. Mock-PVS, Dampsoft, Soniox, IONOS AI Model Hub, Resend und Sentry besitzen aktuell keinen ausführbaren Datenfluss.

Künftige PVS-Anbindungen verwenden Adapter. Herstellerformate dürfen nicht direkt in Feature- oder Geschäftslogik durchsickern.

## Deployment und Betrieb

Es existiert keine Vercel-Konfiguration. Eingecheckte GitHub-Workflows führen bei Pull Requests und Pushes nach `main` die Kernverifikation sowie Dependency-/Secret-Prüfungen aus; ihre Aktivierung, Branch-Protection und betriebliche Reaktion auf Funde sind nicht belegt. Kern- und Vollverifikation laufen zusätzlich lokal über npm run verify und npm run verify:full. Security Header, Monitoring, Backup-/Restore-Nachweise und Incident-Prozesse sind offene Deployment- beziehungsweise Real-Data-Gates.

## Architekturinvarianten

- Praxissoftware bleibt Source of Truth für medizinische und abrechnungsrelevante Daten.
- Serverseitige Identitätsentscheidungen verwenden verifizierte Claims.
- Proxy oder UI-Ausblendung ersetzen keine Datenbankautorisierung.
- Praxisbezogene Tabellen erhalten practice_id, RLS, passende Indizes und negative Isolationstests.
- Service-Role-Zugriffe bleiben expliziten CLI-Verwaltungsprozessen vorbehalten.
- Bis zur Freigabe des Real-Data-Gates werden nur synthetische Daten verarbeitet.
- KI extrahiert oder bereitet vor; nachvollziehbare Regeln und qualifizierte Menschen entscheiden.

## Bekannte Schulden

- Lokale TOTP-Einschreibung, Sitzungsstatus und Sperre sind einschließlich Browser-/Edge-E2E mit synthetischen Konten verifiziert; Hosted-Akzeptanz und betriebliche Nachweise für PROJ-31 fehlen noch.
- Die eingecheckten CI-Workflows benötigen noch Aktivierungs-, Branch-Protection- und Betriebsnachweise. Security Header/CSP fehlen weiterhin.
- Lösch-, Aufbewahrungs-, Incident- und Anbieterprozesse sind nicht abgenommen.

## Geplantes Zielbild

~~~text
Praxissoftware als Source of Truth
  ▼
herstellerspezifischer PVS-Adapter
  ▼
praxisgebundenes internes Datenmodell
  ▼
Workflow- und Regel-Engine
  ▼
CRM, Kommunikation, Analytics und KI-gestützte Vorbereitung
~~~

## Vertiefung

- docs/architecture/overview.md: vollständige aktuelle und geplante Systemarchitektur.
- docs/architecture/data-model.md: implementierte und geplante Entitäten.
- docs/architecture/api-contracts.md: vorhandene und absehbare Schnittstellen.
- SECURITY.md und docs/architecture/privacy-security-ai-compliance.md: Sicherheits- und Freigabegrenzen.
- DECISIONS.md und docs/architecture/decisions.md: selektive und vollständige Entscheidungshistorie.
