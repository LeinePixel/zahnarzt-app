# Sicherheitskorrekturen: Anforderungs- und Entscheidungsentwurf

**Status:** Planungsentwurf vom 07.09.2026; keine Implementierung, keine Betriebs- oder Real-Data-Freigabe. Der Auftrag umfasst Planung und Dokumentationsabgleich. Neue Produktparameter werden erst mit der jeweiligen Feature-Spec freigegeben.

**Grundlage:** [Audit SEC-01 bis SEC-09](../../architecture/2026-09-06-security-audit.md), [Primärquellen](../../architecture/2026-09-06-security-primary-sources.md), [PROJ-1](../../../features/PROJ-1-supabase-infrastructure-setup.md), [PROJ-19](../../../features/PROJ-19-audit-logging-and-role-permissions.md), [Real-Data-Gate](../../architecture/privacy-security-ai-compliance.md).

## Architektur und Umfang

Next.js 16, Supabase SSR und PostgreSQL bleiben erhalten. `getClaims()` bleibt Identitätsprüfung; zusätzliche Sitzungs-/MFA-Prüfungen ergänzen die maßgebliche Datenzugriffsgrenze. Rollen kommen weiterhin aus der Datenbank. SECURITY-DEFINER-RPCs müssen zusätzliche Anforderungen selbst erfüllen; neue RLS-Policies allein sichern diese Funktionen nicht ab. Normale Anwendungszugriffe verwenden weiterhin keinen Service-Role-Key.

Die Arbeit wird in eigenständig abnehmbare Pakete gegliedert: Paketupdates/CI, PROJ-31 mit Sitzungs- und Browserhärtung, PROJ-19 mit begrenzten Support-/Auditoperationen und Löschabläufen sowie betriebliche/datenschutzrechtliche Abnahme. Neue Feature-IDs werden hierfür nicht benötigt. PROJ-31 bleibt bis zur vollständigen Feature-Spec `Roadmap`; dieser Querschnittsentwurf ersetzt sie nicht.

Nicht enthalten: Patienten-/PVS-/KI-Funktionen, allgemeine Benutzerverwaltung, Einführung eines neuen Identitätsanbieters, globaler Portalzugriff oder Real-Data-Freigabe durch bloße Planannahme.

## Erhaltenswerte Entscheidungen

- Ausschließlich synthetische Daten bis zur versionierten Real-Data-Freigabe.
- `portaladmin` bleibt von Praxisidentitäten getrennt; Praxisrollen lesen keine Auditdaten.
- Supportfreigaben: Standard acht Stunden, maximal 24 Stunden ab Aktivierung, Aktivierungsfenster 24 Stunden, Widerruf durch eigene Praxis.
- Audit: kontrollierte Metadaten, keine Fachinhalte, Tokens, IP-Adressen oder Freitexte; atomare erlaubte Operationen und neutrale Verweigerungen.
- Audit-Löschschwelle 90 Tage bleibt bestehende Produktentscheidung. Eine zulässige Ausführungsverzögerung wird zusätzlich abgenommen; keine Umdeutung in eine allgemeine Patientenaktenfrist.
- Historische Migrationen und historische Testergebnisse bleiben erhalten. Korrekturen verwenden neue Forward-Migrationen und neue Nachweise.

## Noch zu bestätigende Entscheidungen

Alle folgenden Werte sind konkrete Planungsangebote, keine bereits freigegebenen oder implementierten Kontrollen. T01 im Umsetzungsplan dokumentiert die Entscheidung vor abhängiger Implementierung.

| ID | Vorschlag / zu prüfende Alternative | Entscheidung durch | Abhängige Aufgaben |
|---|---|---|---|
| D01 | MFA für alle Praxis- und Portalidentitäten; TOTP als Start, Wiederherstellung über getrennt verifizierten Administrationsprozess ohne dauerhaften Bypass | Produkt-/Security-Verantwortliche | T03–T04 |
| D02 | Arbeitsplatzsperre nach 5 Minuten ohne menschliche Aktivität; absolute Sitzung 8 Stunden; sensible Supportaktionen nur mit Authentisierung innerhalb 5 Minuten | Praxisverantwortliche und Security | T03–T04 |
| D03 | Widerruf/Kontosperre bei neu beginnenden Datenoperationen innerhalb höchstens 60 Sekunden wirksam; JWT-TTL als Vorschlag 5 Minuten; bereits laufende Operationen separat zeitlich begrenzen | Security/Betrieb | T03–T04 |
| D04 | Session-State hinter privater DB-Grenze; prüfen, welche Supabase-Sitzungsfelder verlässlich verwendet werden können. Falls zusätzliche Aktivitätsdaten nötig: minimale private Tabelle mit begrenzter Aufbewahrung und atomarer Prüfung | Architektur/Security | T03 |
| D05 | Keine neue externe Redis-/Monitoring-Abhängigkeit als Standard. RPC-Limits vorzugsweise atomar in PostgreSQL: vorgeschlagen 5 Anforderungen je Praxis/10 Minuten, höchstens 3 offene Freigaben, 60 Audit-Lese-/Aktivierungsversuche je Akteur/Minute | Produkt/Architektur | T06 |
| D06 | Verweigerungs-Audit bei Drosselung: einzelnes kontrolliertes Ereignis je Akteur/Aktion/Zeitfenster plus Zähler; genaue Beweiskraft und Frist vor Schemaänderung bestätigen. Alternative: abgewiesene Last vor DB-RPC mit garantiertem direktem API-Schutz | Security/Datenschutz | T06 |
| D07 | Nicht mehr aktive Freigaben nach vorgeschlagenen 90 Tagen seit Ende bereinigen; rechtlich erforderliche Ausnahmen und Identitätsreferenzen explizit entscheiden. Keine automatische Cascade-Löschung | Verantwortliche/Datenschutz | T08 |
| D08 | Cron: täglich, Zeitzone live erfassen; Alarm nach 26 Stunden ohne Erfolg oder sofort nach Fehler, vorgeschlagene Reaktionszeit 4 Stunden. Regelbetrieb höchstens 24 Stunden Verzögerung nach Audit-Altersgrenze | Betrieb/Datenschutz | T09 |
| D09 | Vorschlag RPO 24 Stunden, RTO 4 Stunden; Tarif, tatsächliche Backup-/PITR-Abdeckung, Alarmempfänger, Bereitschaft und Budget anhand Pilotanforderungen festlegen | Betrieb/Praxis | T10 |
| D10 | SSR-Cookies beibehalten und unter HTTPS `Secure` setzen. HttpOnly-/reines Server-Sitzungsmodell nur nach separater Machbarkeitsentscheidung; noncebasierte CSP, keine pauschale `unsafe-inline`-Freigabe für Scripts | Architektur/Security | T05 |

## Verbindliche Anforderungen an die Korrekturen

1. **SEC-01/02:** Seiten, Server Actions, direkte REST-Abfragen und RPCs werden gegen dieselbe Sperr-/AAL-Anforderung geprüft. Abgelaufene, gesperrte, fehlende und unvollständige Kontexte verweigern Daten. Activity-Heartbeats sind kein vom Browser gelieferter Vertrauensbeweis; Serverzeit ist maßgeblich, Requests sind begrenzt, reine Hintergrundaktivität verlängert keinen Arbeitsplatz ohne definierte Regel.
2. **SEC-03:** Sichere Cookie-Erzeugung im realen HTTPS-Flow, CSP mit Next.js-Hydration, Framing-/MIME-/Referrer-Schutz, unverändert `private, no-store`. Keine Authinhalte in CSP-Reports. HSTS erst nach Prüfung der betroffenen Domains; keine pauschale Subdomain-/Preload-Zusage.
3. **SEC-04:** Parallelaufrufe umgehen keine Quoten. Widerruf und Logout bleiben auch bei ausgeschöpfter Anforderungsquote verfügbar. Drosselung darf weder unendlich Auditereignisse erzeugen noch erlaubte Aktionen ohne Audit ermöglichen.
4. **SEC-05:** Kategorienbezogene Aufbewahrung, gesperrtes Offboarding vor endgültiger Löschung, freigegebene Referenzbehandlung und Restore-Löschwiederholung. Es gibt keine allgemeine automatische Löschung aller Authkonten nach 90 Tagen.
5. **SEC-06:** Nur Praxisadmins sehen eigene Freigaben mit Status/Ablauf/Widerruf; keine Auditansicht, Portal-Liste oder Fremdpraxissuche. Reload und mehrere Freigaben bleiben bedienbar.
6. **SEC-07:** Laufnachweis, Wirkungstest, Überwachung, Wiederherstellung, Incident-Prozess, Administration und Datenschutzakten besitzen jeweils getrennte Evidenz. Ein Cron-Erfolg allein beweist keine Löschwirkung. Keine personenbezogenen Inhalte in technischen Alarmen.
7. **SEC-08/09:** Reproduzierbare Paketupdates, automatisierte Verifikation, Secret-Scanning einschließlich abgestimmter Historienprüfung, klare Reaktion auf neue Advisories. Keine Betriebssecrets für unvertrauenswürdige PRs.

## Freigabe- und Statuslogik

Ein Finding ist erst geschlossen, wenn Code-/Konfigurationsnachweis, Negativtest und gegebenenfalls betriebliche Abnahme vorliegen. `In Review` für PROJ-1/19 bleibt bis zu deren tatsächlichen Abnahmen erhalten. Ein vollständiger PROJ-31-Entwurf erhält `Planned`, Architekturfreigabe `Architected`, erst tatsächliche Implementierung `In Progress`. Der [Umsetzungsplan](../plans/2026-09-07-security-remediation.md) ist der gemeinsame Einstieg für die Korrekturen; der Audit bleibt historische Evidenz.
