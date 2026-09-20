# Sicherheitskorrekturen: Anforderungs- und Entscheidungsentwurf

**Status:** Architekturfreigabe vom 20.09.2026 für D01–D07 und D10; D08/D09
bleiben als Betriebsentscheidungen offen. Keine Betriebs- oder
Real-Data-Freigabe.

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

## Entscheidungen

Jede Zeile hält Status, verantwortliche Rolle, Entscheidungsdatum und Begründung
fest. Eine offene Betriebsentscheidung blockiert nur das jeweils genannte
Arbeitspaket.

| ID | Entscheidung | Status / verantwortlich / Datum | Begründung und Folge |
|---|---|---|---|
| D01 | MFA für alle Praxis- und Portalidentitäten; TOTP als Start, Wiederherstellung über getrennt verifizierten Administrationsprozess ohne dauerhaften Bypass | Freigegeben; Produkt/Security; 20.09.2026 | Einheitliche AAL2-Grenze ohne dauerhafte Ausnahme; T03–T04 dürfen beginnen. |
| D02 | Arbeitsplatzsperre nach 5 Minuten ohne menschliche Aktivität; absolute Sitzung 8 Stunden; sensible Supportaktionen nur mit höchstens 5 Minuten alter Authentisierung | Freigegeben; Praxis/Security; 20.09.2026 | Begrenzt unbeaufsichtigte Rezeptions- und Supportzugriffe; Semantik steht in PROJ-31. |
| D03 | Neue Datenoperationen reagieren binnen höchstens 60 Sekunden auf Widerruf/Kontosperre; JWT-TTL 5 Minuten; atomar autorisierte Operationen dürfen enden | Freigegeben; Security/Betrieb; 20.09.2026 | Kurze Tokenrestlaufzeit plus aktueller DB-Entscheid; T03 verifiziert die Hosted-Fähigkeiten. |
| D04 | Sitzungszustand liegt hinter einer privaten DB-Grenze; eine zusätzliche minimale Tabelle ist nur zulässig, soweit verlässliche Supabase-Felder nicht genügen | Freigegeben; Architektur/Security; 20.09.2026 | Verhindert Vertrauen in Browserzustand und unnötige Auth-Systemeingriffe. |
| D05 | Keine neue Redis-/Monitoring-Abhängigkeit; atomare PostgreSQL-Limits: 5 Anforderungen je Praxis/10 Minuten, höchstens 3 offene Freigaben, 60 Audit-Lese-/Aktivierungsversuche je Akteur/Minute | Freigegeben; Produkt/Architektur; 20.09.2026 | Direkte RPC-Aufrufe teilen dieselbe Grenze; T06 darf beginnen. |
| D06 | Drosselung schreibt höchstens ein kontrolliertes Ereignis je Akteur/Aktion/Zeitfenster plus aggregierten Zähler | Freigegeben; Security/Datenschutz; 20.09.2026 | Erhält Nachweisbarkeit ohne selbst erzeugte Auditlast; Aufbewahrung folgt der Auditfrist. |
| D07 | Inaktive Freigaben und Idempotenzdaten 90 Tage nach Ende bereinigen; keine automatische Cascade-Löschung; Identitätsreferenzen kontrolliert entkoppeln | Freigegeben für synthetisches MVP; Produkt/Datenschutz-Gate; 20.09.2026 | T08 darf technisch umgesetzt werden; Rechts- und Restore-Freigabe bleibt vor echten Daten zwingend. |
| D08 | Täglicher Cron; Alarm nach 26 Stunden ohne Erfolg oder sofort bei Fehler; vorgeschlagene Reaktionszeit 4 Stunden | Offen; Betrieb/Datenschutz; kein Datum | Benötigt Zielzeitzone, Alarmempfänger und Bereitschaft. Blockiert T09, nicht T03–T08. |
| D09 | Vorgeschlagenes RPO 24 Stunden und RTO 4 Stunden | Offen; Betrieb/Praxis; kein Datum | Benötigt Tarif-, PITR-, Budget- und Verantwortlichkeitsentscheidung. Blockiert T10. |
| D10 | SSR-Cookies bleiben; unter HTTPS `Secure`; noncebasierte CSP ohne pauschales Script-`unsafe-inline`; HttpOnly nur nach separater Machbarkeitsprüfung | Freigegeben; Architektur/Security; 20.09.2026 | Bewahrt das Supabase-SSR-Modell und gibt T05 zur Umsetzung frei. |

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
