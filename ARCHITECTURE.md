# Architektur

**Sicherheitsfortsetzung 07.09.2026:** Aktuelle Arbeitspakete und Abnahmekriterien stehen im [Security-Umsetzungsplan](docs/superpowers/plans/2026-09-07-security-remediation.md). Alle neun Auditbefunde bleiben bis zu ihrer belegten Korrektur offen; bestehende Architektur und historische Abnahmen bleiben erhalten.

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
practice / user_profile / portal_admin
support_access_grant / audit_event (über autorisierte RPCs)
~~~

Der Proxy ist kein Autorisierungssystem. Serverseitige Identitätsprüfung und Datenbank-RLS bleiben eigenständige Trust Boundaries.

## Anwendungsschichten

- Präsentation: src/app/ und src/components/.
- Feature-/Domainlogik: src/features/auth/, src/features/audit/ und src/features/authorization/; die lokale Rollen-/Fähigkeitsprüfung ergänzt die maßgebliche Datenbankautorisierung.
- Supabase-Zugriff: src/lib/supabase/ mit getrennten Clients für Browser, Server und Proxy.
- Persistenz: supabase/migrations/ und PostgreSQL-RLS.
- CLI-Verwaltung: supabase/seed.ts mit separater geheimer Umgebung.
- Verifikation: co-located Vitest-Tests, supabase/tests/ und tests/.

Login und Logout verwenden Server Actions; PROJ-1 besitzt keine eigene API-Schicht.

## Daten und Autorisierung

Die Migrationen definieren `practice`, `user_profile`, `portal_admin`, Supportfreigaben und Audit-Ereignisse. Eine private Sitzungsgrenze gleicht AAL2, Session-ID, aktuellen Auth-Sitzungsbestand, Kontosperre, Widerruf, fünf Minuten Inaktivität und acht Stunden Maximaldauer ab. Praxisrollen können nur mit gültigem Zustand ihren eigenen Kontokontext lesen und keine Auditdaten einsehen; `portaladmin` ist eine getrennte Identität ohne `user_profile` und erhält Audit-Metadaten nur während einer aktiven praxisgebundenen Supportfreigabe. Browserrollen besitzen keine direkten Schreibrechte auf diese Tabellen. Die `service_role` ist ausschließlich für explizite CLI-Verwaltung vorgesehen.

Die Anwendung trägt die Praxisgrenze im Schema und erzwingt sie mit RLS, Tabellenrechten und autorisierten RPCs. PROJ-19 ist lokal verifiziert; Hosted-Migrationen, tägliches Scheduling und synthetische Cloud-Abnahme sind zum 06.09.2026 dokumentiert (docs/delivery/acceptance-tests.md). Scheduler-Monitoring, der Nachweis eines ausgeführten Löschlaufs, MFA/Re-Authentisierung und das Real-Data-Gate bleiben offen.

## Externe Integrationen

Produktiv angebunden ist nur Supabase. Vercel ist geplant, aber nicht eingerichtet. Mock-PVS, Dampsoft, Soniox, IONOS AI Model Hub, Resend und Sentry besitzen aktuell keinen ausführbaren Datenfluss.

Künftige PVS-Anbindungen verwenden Adapter. Herstellerformate dürfen nicht direkt in Feature- oder Geschäftslogik durchsickern.

## Deployment und Betrieb

Es existiert keine Vercel-Konfiguration. Kern- und Vollverifikation laufen lokal über npm run verify und npm run verify:full; GitHub-Workflows führen zusätzlich Installations-, Verifikations- und Dependency-Audit-Checks aus. CSP/Sicherheitsheader sind im Proxy implementiert. Monitoring, Backup-/Restore-Nachweise, Branch-Protection und Incident-Prozesse sind weiter offene Deployment- beziehungsweise Real-Data-Gates.

## Architekturinvarianten

- Praxissoftware bleibt Source of Truth für medizinische und abrechnungsrelevante Daten.
- Serverseitige Identitätsentscheidungen verwenden verifizierte Claims.
- Proxy oder UI-Ausblendung ersetzen keine Datenbankautorisierung.
- Praxisbezogene Tabellen erhalten practice_id, RLS, passende Indizes und negative Isolationstests.
- Service-Role-Zugriffe bleiben expliziten CLI-Verwaltungsprozessen vorbehalten.
- Bis zur Freigabe des Real-Data-Gates werden nur synthetische Daten verarbeitet.
- KI extrahiert oder bereitet vor; nachvollziehbare Regeln und qualifizierte Menschen entscheiden.

## Bekannte Schulden

- Die datenbankseitige PROJ-31-Sitzungs-/AAL2-Grenze sowie MFA-Einrichtung,
  Re-Authentisierung und Arbeitsplatzsperre sind lokal implementiert und
  synthetisch geprüft. Hosted- und manuelle Arbeitsplatzabnahme stehen aus.
- Hosted-CSP-/HSTS-Nachweis, Secret-Scanning und Branch-Protection fehlen.
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
