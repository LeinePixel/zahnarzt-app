# DentPilot: Sicherheitsprüfung vom 06.09.2026

**Umsetzung geplant 07.09.2026:** [Security-Umsetzungsplan](../superpowers/plans/2026-09-07-security-remediation.md) ordnet jedem Finding Aufgaben und Nachweise zu. Dieser Audit bleibt Befundhistorie; ein vorhandener Plan bedeutet keine Behebung.

Abgeschlossen am 07.09.2026 nach Wiederaufnahme; technische Prüfungen am 06.09., Paketpfade und Advisory-Einordnung am 07.09. ergänzt.

## Ergebnis und Geltungsbereich

Die vorhandene Architektur ist eine geeignete Grundlage für die synthetische Entwicklung. Sie ist noch nicht für echte Kunden- oder Gesundheitsdaten abgenommen. Der Audit bestätigt wirksame Mandanten- und Rollenbegrenzungen, findet aber fehlende Echtbetriebs-Kontrollen und zusätzliche Risiken bei Sitzungssperre, Missbrauchsbegrenzung, Widerruf und Löschung. Keine Aussage dieses Berichts ist eine Sicherheitsgarantie, DSGVO-Zertifizierung oder Real-Data-Freigabe.

Prüfbasis: Commit `9d0f50b` plus die uncommittierten Dokumentationskorrekturen des vorherigen Audits. Geprüft wurden PROJ-1/19, Auth-/Audit-/Autorisierungsmodule, Proxy, Server Actions, Client-Konfiguration, alle sechs Migrationen in ihrer wirksamen Kette, repräsentative Tests, Seed-/Secret-Grenzen und Betriebsdokumentation. Die Anwendung enthält noch keine Patienten-, Termin-, PVS- oder KI-Verarbeitung; deren Sicherheit lässt sich nicht vorwegnehmen.

Keine Änderungen an Anwendungscode, Migrationen, Hosted-Konfiguration oder echten Daten. Die ergänzenden SQL-Proben liefen ausschließlich im bestehenden lokalen Supabase-Container und endeten mit `ROLLBACK`. Cloud-Abnahme vom 06.09. ist vorhandene Dokumentation, keine neue Liveprüfung in diesem Audit. Ein externer Pentest, ein vollständiger Git-History-Secret-Scan, Host-/Netzwerkprüfung, Anbieter-/Vertragsprüfung und Cloud-IAM-/Backup-Abnahme waren nicht Teil des belegten Prüfumfangs.

## Frische Nachweise

| Prüfung | Ergebnis / Grenze |
|---|---|
| `npm test` | 17 Dateien, 90 Tests bestanden |
| `npx --no-install supabase test db --local` | 3 Dateien, 108 Tests bestanden; kein Reset oder Seed |
| Zusätzliche lokale SQL-Proben | Ergebnisse unten; vollständig zurückgerollt |
| Musterprüfung versionierter Dateien auf private Schlüssel, Secret-Keys, JWTs und GitHub-Tokens | 193 versionierte Pfade untersucht; keine Treffer der verwendeten Muster; kein vollständiger Secret-Scan oder Historiennachweis |
| App-Konfiguration | Nur die beiden öffentlichen Variablennamen in `.env.local`; `.env.local` und `.env.seed.local` nicht versioniert; Werte nicht ausgegeben |
| `npm audit --json` | Nach ausdrücklicher Zustimmung erfolgreich abgefragt: 4 betroffene Pakete, davon 1 high, 2 moderate, 1 low, 0 critical; Exit 1 wegen Befunden. Details SEC-09. Keine Pakete geändert. |
| Build/Lint/Typecheck | Im unmittelbar vorausgehenden Dokumentationslauf über `npm run verify` erfolgreich; in diesem Audit kein erneut ausgeführter Gesamt- oder Cloud-E2E-Lauf |

## Tragfähige Schutzmaßnahmen

- [Kontokontext](../../src/features/auth/current-user.ts) und [Proxy](../../src/lib/supabase/proxy.ts) prüfen signierte Claims. Geschützte Seiten prüfen erneut; Rollen werden aus der Datenbank gelesen.
- [PROJ-1-Migration](../../supabase/migrations/20260825170000_proj_1_identity.sql) begrenzt direkte Lesezugriffe auf eigenes Profil/eigene Praxis; Browserrollen haben keine direkten Schreibrechte.
- [PROJ-19-Härtung](../../supabase/migrations/20260902203000_proj_19_forward_security_hardening.sql) entzieht direkte Anwendungsgrants auf Portalidentitäten, Freigaben und Auditdaten. RPCs prüfen Rollen, Praxis, Aktivierung, Ablauf und Widerruf selbst. SECURITY-DEFINER-Funktionen verwenden einen leeren `search_path` und qualifizierte Objektnamen.
- Portaladmins sind getrennte Identitäten, keine globale Praxisrolle. Aktivierte Freigaben sind einem Portaladmin zugeordnet; fremde Praxen bleiben unzugänglich. Sperren schützen konkurrierende Freigabeoperationen.
- Audit und erlaubte Operation sind transaktional gekoppelt; neutrale Verweigerungsergebnisse erhalten Auditnachweise ohne Existenzdetails. Auditfelder verwenden kontrollierte Kategorien statt Freitext.
- [Login](../../src/features/auth/actions.ts) validiert mit Zod und neutralisiert Anbieterfehler; Eingabelängen sind begrenzt. React rendert geprüfte Daten als Text; im untersuchten Anwendungscode wurden keine aktiven `dangerouslySetInnerHTML`-/`eval`-Senken gefunden.
- Auth-Antworten sind `private, no-store`; die vorhandenen Tests prüfen dies. Der installierte Next.js-Action-Handler enthält Origin-/Host-Prüfungen gegen CSRF; es ist keine erweiterte `allowedOrigins`-Ausnahme konfiguriert. Eine produktive Reverse-Proxy-/Browserabnahme bleibt erforderlich.
- Service-Role-Key und Seed-Passwörter bleiben außerhalb der App-Konfiguration; E2E-Launcher entfernt diese aus der Child-Umgebung. Auth-Testmedien sind deaktiviert.

Die bestandenen Tests belegen die von ihnen abgedeckten Fälle, nicht die Vollständigkeit der Sicherheitsanforderungen.

## Befunde und erforderliche Abnahmen

Prioritäten bewerten den vorgesehenen Betrieb mit echten Gesundheitsdaten. Ein bekannter, dokumentierter Aufschub ist weiterhin ein Freigabeblocker; er ist nicht automatisch ein akuter Angriff auf die synthetische Entwicklungsumgebung.

### SEC-01 — Hoch: MFA und Re-Authentisierung fehlen an der Datenzugriffsgrenze

**Beleg:** [Lokale Auth-Konfiguration](../../supabase/config.toml) deaktiviert TOTP; [Support-RPCs](../../supabase/migrations/20260902203000_proj_19_forward_security_hardening.sql) prüfen `auth.uid()` und Rollen, aber kein `aal2` und keine frische Authentisierung. Die lokale Probe konnte eine Freigabe mit simulierten `aal1`-Claims aktivieren und Auditdaten lesen.

**Risiko:** Ein kompromittiertes Passwort beziehungsweise eine einfache Sitzung reicht für die derzeit erlaubten Rollenaktionen. Die Praxisfreigabe begrenzt den Umfang, ersetzt aber keine stärkere Authentisierung. Eine spätere reine MFA-Oberfläche wäre über direkte RPC-Aufrufe umgehbar.

**Empfehlung:** PROJ-31 vor Echtdaten spezifizieren; MFA mindestens für privilegierte Identitäten, risikogerecht auch Praxisarbeitsplätze, mit sicherer Wiederherstellung. AAL-/Re-Auth-Anforderungen in der tatsächlichen Datenautorisierung durchsetzen, einschließlich SECURITY-DEFINER-RPCs. Abnahme: gültiges `aal1` verweigert, `aal2` erlaubt nur bei passender Rolle und Freigabe, Wiederherstellung und Faktorwechsel negativ testen. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa).

### SEC-02 — Hoch: Sofortige Sitzungssperre und Arbeitsplatz-Inaktivität nicht durchgesetzt

**Beleg:** [Kontokontext](../../src/features/auth/current-user.ts) prüft Claims, keine aktuelle Sitzungs-ID. SQL-RPCs prüfen ebenfalls keine bestehende Sitzung. In der lokalen Probe existierte die simulierte `session_id` nicht in `auth.sessions`; Aktivierung und Audit-Lesen waren dennoch möglich. `auth.sessions`-Timeouts sind lokal auskommentiert, JWT-TTL ist 3600 Sekunden, `secure_password_change` ist lokal deaktiviert.

**Grenze der Probe:** Das ist ein SQL-Autorisierungsnachweis mit simulierten Claims, kein gefälschtes, über HTTP akzeptiertes JWT und kein reproduzierter Live-Token-Diebstahl. Supabase dokumentiert, dass ein bereits ausgegebenes JWT nach Logout bis zu seinem Ablauf weiter verwendbar sein kann. Die Hosted-TTL wurde nicht erhoben.

**Empfehlung:** Zulässige Sperrverzögerung, Inaktivität, Maximalsitzung und Re-Authentisierung verbindlich definieren. Kritische Zugriffe müssen eine aktuelle Sitzungs-/Sperrinformation auch an REST/RPC-Grenzen berücksichtigen. Ein Sitzungszeilen-Check allein ersetzt keine Inaktivitätsregel. Tests müssen Token-Replay nach Logout/Kontosperre und direkte RPC-Aufrufe einschließen. Bereits dargestellte Informationen werden durch einen DB-Widerruf nicht vom Bildschirm entfernt; dafür benötigt die UI einen passenden Sperrablauf. [Supabase Sessions](https://supabase.com/docs/guides/auth/sessions).

### SEC-03 — Hoch vor Deployment: Cookie-, Browser- und Transportschutz nicht abgenommen

**Beleg:** [next.config.ts](../../next.config.ts) enthält keine Security Header/CSP. [Server-Client](../../src/lib/supabase/server.ts), [Browser-Client](../../src/lib/supabase/client.ts) und [Proxy](../../src/lib/supabase/proxy.ts) setzen keine eigenen Cookie-Sicherheitsoptionen. Die installierten SSR-Defaults sind `sameSite: lax`, `httpOnly: false`, lange Cookie-Maximaldauer und kein `secure: true`. Die [Proxy-Tests](../../src/lib/supabase/proxy.test.ts) reichen vorgegebene sichere Testcookies weiter; sie beweisen nicht die tatsächliche Cookie-Erzeugung unter produktivem HTTPS.

**Risiko:** Ohne explizites Secure-Attribut ist der Cookie nicht auf HTTPS beschränkt. Browserlesbare Sitzungstokens vergrößern die Folgen einer späteren XSS. Ein fehlendes HttpOnly ist beim verwendeten Supabase-SSR-Modell allein kein Implementierungsfehler; es muss als Architekturentscheidung mit XSS-Schutz bewertet werden. In diesem Audit wurde keine ausnutzbare XSS nachgewiesen.

**Empfehlung:** Produktive Secure-Cookies, HTTPS/HSTS, CSP einschließlich `frame-ancestors`, MIME-/Referrer-Regeln und erforderliche Permissions-Policy auf den tatsächlichen Funktionen abstimmen. `HttpOnly` nicht blind aktivieren und dabei den Browser-Client brechen; ein reines Server-Sitzungsmodell wäre eine gesonderte Architekturentscheidung. Abnahme am tatsächlichen Hosting: Cookies, Redirects, Framing, CSP und CSRF mit realem Browser. [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

### SEC-04 — Mittel: Audit- und Supportoperationen ohne belegte Missbrauchsbegrenzung

**Beleg:** `request_support_access` erzeugt je Aufruf eine Freigabe und ein Auditereignis; `record_denied_audit_read` ist für `authenticated` ausführbar und erzeugt je Aufruf einen Eintrag. Drei unmittelbar aufeinanderfolgende lokale Aufrufe erzeugten jeweils drei Datensätze. In den RPCs sind keine Quote, Idempotenz oder Akteur-/Praxisgrenzen für die Aufrufmenge implementiert. Die Auth-Login-Limits sind keine Limits dieser Daten-RPCs.

**Risiko:** Ein kompromittiertes oder missbräuchliches Konto kann Speicher, Kosten und Verfügbarkeit belasten. Es wurde ausdrücklich kein Last-/DoS-Test durchgeführt; die maximale Belastbarkeit ist unbekannt.

**Empfehlung:** Mengen- und Parallelitätsgrenzen, Idempotenz für Freigabeanforderungen sowie ressourcenschonende Behandlung wiederholter Verweigerungen festlegen. Schutz muss direkte Supabase-RPC-Aufrufe einschließen, nicht nur Next.js. Auditierbarkeit erhalten, ohne ungeprüft jeden Wiederholungsversuch unbegrenzt zu speichern. Schwellen, Alarm und begrenzte Lasttests abnehmen.

### SEC-05 — Hoch vor Echtdaten: Aufbewahrung und Kontolöschung sind unvollständig

**Beleg:** [Audit-Migration](../../supabase/migrations/20260827090000_proj_19_audit_authorization.sql) löscht nur `audit_event` nach 90 Tagen. Für `support_access_grant` existiert keine entsprechende Aufbewahrungs-/Bereinigungsroutine. Dessen `requested_by`/`activated_by`-Fremdschlüssel verwenden `ON DELETE RESTRICT`. Die Probe bestätigte: Auch nach Widerruf und Entfernung der zugehörigen Auditereignisse blockierte eine verbleibende Freigabe die Löschung des Portaladmin-Auth-Kontos.

**Risiko:** Identitäts- und Supportmetadaten bleiben ohne festgelegten Endpunkt erhalten; Offboarding und zulässige Löschung brauchen einen geregelten Ablauf. Daraus folgt nicht, dass jede Löschanfrage sofort und ohne Aufbewahrungsprüfung erfüllt werden muss.

**Empfehlung:** Kategorienbezogene Fristen und Lösch-/Anonymisierungspfade einschließlich Freigaben, Identitäten, Auth-Logs, Cron-Historie, Backups und späteren Integrationen spezifizieren. Offboarding zunächst sicher sperren, dann referenzielle Integrität und erforderliche Nachweise gezielt erhalten. Keine pauschale Cascade-Löschung als Schnellfix. 90 Tage sind eine Audit-Produktentscheidung, keine allgemeine Frist für Behandlungsakten.

### SEC-06 — Mittel: Verlässlicher Widerruf hängt an einer flüchtigen Freigabe-ID

**Beleg:** [SupportAccessControls](../../src/app/status/support-access-controls.tsx) hält die angelegte Kennung nur im React-Action-State. Nach erneutem Laden fehlt eine Übersicht eigener aktiver Freigaben; der Widerruf verlangt die manuell bekannte ID. Mehrere Freigaben sind möglich.

**Risiko:** Ein Praxisadmin kann eine bestehende Freigabe praktisch nicht zuverlässig auffinden und widerrufen, wenn die Kennung nicht extern gesichert wurde. Die DB-Widerrufsprüfung funktioniert; die operative Bedienbarkeit ist die Lücke.

**Empfehlung:** Eine ausschließlich praxisgebundene Übersicht eigener Freigaben mit Status/Ablauf/Widerruf vorsehen, server- und datenbankseitig autorisiert. Das Verbot einer anbieterweiten Freigabe-/Praxissuche bleibt bestehen. Abnahme: Reload, mehrere Freigaben, andere Praxisadministration derselben Praxis und verweigerter Fremdpraxiszugriff.

### SEC-07 — Hoch vor Echtdaten: Betriebs-, Wiederherstellungs- und Datenschutznachweise fehlen

**Beleg:** [Security-Gates](../../SECURITY.md), [offene Fragen](../delivery/open-questions.md) und [Abnahme](../delivery/acceptance-tests.md) weisen Scheduler-Monitoring/Löschlauf, Backup-Restore, Incident Response, Anbieterprüfung und weitere Real-Data-Kriterien als offen aus. Es gibt keine versionierte Freigabe. Die Cloud-Konfiguration wurde hier nicht verifiziert; fehlende Repository-Evidenz beweist nicht automatisch eine fehlende Anbieterfunktion.

**Empfehlung:** Betriebsverantwortliche und Alarmwege, RPO/RTO, Restore-Probe, Schlüsselschutz/-rotation, administrative Konten/MFA, Umgebungsisolation und Incident-/Datenschutzverletzungsprozess abnehmen. Verwaltungsschlüssel und Datenbankadministratoren können Auditdaten technisch ändern; Anwendungs-RLS ist kein manipulationssicheres Archiv gegenüber Administratoren. Administrative Rechte/Änderungen und benötigte Integritätsnachweise separat regeln. Gehostete Region, Zugriffe, AVV/Subprozessoren und Rechtsgrundlagen anhand realer Anbieter-/Praxisverhältnisse prüfen.

### SEC-08 — Mittel: Sicherheitsprüfungen werden nicht automatisch erzwungen

**Beleg:** Keine CI-Workflows im Repository; lokale `verify`-/`verify:full`-Skripte sind vorhanden. Der aktuelle npm-Abgleich meldet vier betroffene Pakete (SEC-09). Keine belegte kontinuierliche Dependency-/Secret-Prüfung oder verpflichtende Release-Abnahme.

**Empfehlung:** Geschützte CI mit synthetischen Testdaten, minimalen Secrets und verpflichtenden Sicherheitsprüfungen vor Integration/Release. Dependency-/Secret-Scanning und Update-Reaktionszeiten festlegen. Pull Requests aus unvertrauenswürdigen Quellen dürfen keine Betriebssecrets erhalten. Die betroffenen Pakete gezielt aktualisieren und verifizieren; historische Nullbefunde sind kein aktueller Nachweis.

### SEC-09 — Paketbefunde bis High: vier verwundbare transitive Entwicklungsabhängigkeiten

`npm audit --json` meldet vier betroffene Pakete; Browserslist enthält zwei Advisories. `npm ls ... --all` ordnet alle vier Pakete den Entwicklungs-/Buildwerkzeugen zu. Die npm-Schwere ist eine Paketbewertung, kein Beweis eines direkt erreichbaren Angriffs auf DentPilot. Im geprüften Anwendungscode ist kein Benutzerpfad zu diesen Parser-/Kopierfunktionen belegt. Buildumgebung und Entwicklerarbeitsplätze bleiben trotzdem schutzbedürftig.

| Paket / installiert | npm-Schwere | Herkunft | Gemeldetes Risiko / gepatchte Version |
|---|---|---|---|
| `browserslist` 4.28.1 | high | Autoprefixer und Babel über ESLint-Konfiguration | Unbegrenzter Cache sowie Verarbeitung manipulierter Statistikdaten; ab 4.28.7 gepatcht. [Cache-Advisory](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [Statistik-Advisory](https://github.com/advisories/GHSA-73wf-gq98-2v4g) |
| `@humanfs/node` 0.16.7 | moderate | ESLint | Kopieroperationen folgen Symlinks und können Dateien außerhalb des Quellbaums kopieren; ab 0.16.8 gepatcht. [Advisory](https://github.com/advisories/GHSA-p498-v437-472g) |
| `fflate` 0.8.2 | moderate | `@vitest/ui` | Endlosschleife bei manipulierten ZIP64-Daten; ab 0.8.3 gepatcht. [Advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98) |
| `postcss-selector-parser` 6.1.2 | low | Tailwind / postcss-nested | Unkontrollierte Rekursion bei AST-Verarbeitung; im verwendeten 6er-Zweig ab 6.1.3 gepatcht. [Advisory](https://github.com/advisories/GHSA-w9m9-85wc-3x92) |

**Empfehlung:** Zeitnah gezielte kompatible Updates und Lockfile-Aktualisierung, anschließend `npm audit` und `npm run verify`; kein blindes `npm audit fix --force`. Der Audit hat keine Abhängigkeiten verändert. Die verlinkten Advisories wurden am 07.09.2026 geprüft.

## Die drei offenen Gates konkret

### Scheduler-Monitoring

Der tägliche Job ist laut vorhandener Hosted-Abnahme eingerichtet. Monitoring bedeutet, automatisch zu erkennen, ob er fehlgeschlagen, ausgeblieben oder ungewöhnlich langsam ist, und eine verantwortliche Person zu alarmieren. Zu dokumentieren sind Zielsystem, Job-ID, Aktivstatus, Zeitplan/Zeitzone, letzter Erfolg, erwarteter nächster Lauf und ein getesteter Alarm-/Eskalationsweg. `03:17` gilt in der konfigurierten Cron-Zeitzone; eine deutsche Ortszeit ist hier nicht live nachgewiesen.

### Löschlaufnachweis

Ein eingetragener Zeitplan ist kein Beweis einer Ausführung. Eine erfolgreiche Ausführung mit null fälligen Datensätzen ist ein gültiger Laufnachweis, aber kein vollständiger Beweis der Löschwirkung. Benötigt werden beides: ein tatsächlicher Schedulerlauf und ein sicherer Wirkungstest mit synthetischen Alt-, Grenz- und jüngeren Kontrolldaten. Die 108 lokalen Tests enthalten bereits den 90-Tage-Grenztest; offen ist die betriebliche Zielumgebungs-Evidenz. Ein Cron-Ergebnis `SELECT 1` ist keine Zahl gelöschter Ereignisse.

Die Routine löscht beim Lauf Datensätze mit Alter mindestens 90 Tage. Bei täglicher Ausführung können Ereignisse regulär bis knapp 91 Tage verbleiben, bei Jobausfällen länger. Toleranz und Nachholung gehören in die Frist-/Betriebsabnahme. SQL-Löschung löscht keine bereits vorhandenen Backups; diese benötigen geregelte Fristen und Wiederanwendung fälliger Löschungen nach Restore. [Quellen und konkrete Prüfschritte](2026-09-06-security-primary-sources.md).

### Real-Data-Freigabe

Das ist die dokumentierte Entscheidung, dass eine bestimmte Umgebung und ein bestimmter Funktionsumfang echte beziehungsweise re-identifizierbare Daten verarbeiten dürfen. Sie benötigt technische Wirksamkeitsnachweise und organisatorisch/rechtlich geprüfte Verarbeitung: Zwecke, Art.-6-Grundlage und passende Art.-9-Ausnahme, Rollen, AVV/Subprozessoren/Transfers, Aufbewahrung, Betroffenenrechte, DSFA nach Projektgate sowie Betriebs- und Sicherheitsabnahme. EU-Hosting oder grüne Tests allein genügen nicht. [DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/2016-05-04?locale=de).

Verantwortliche/Betreiber tragen die Entscheidung; eine gegebenenfalls bestellte Datenschutzbeauftragte berät und überwacht. Die genaue Rolle von Praxis und Anbieter muss je Datenfluss geklärt sein. Das Projekt verlangt unter anderem MFA, DSFA und externen Pentest als Gates; diese sind nicht als pauschal für jede Software gesetzlich vorgeschriebene Einzelmaßnahmen zu verwechseln. Neue KI-Funktionen benötigen später zusätzlich eine Bewertung ihres konkreten Zwecks; heute ist keine KI implementiert.

## Reihenfolge und Freigabebedarf

1. Für dieses Audit und die vorliegenden lokalen Prüfungen ist keine weitere Nutzerfreigabe erforderlich.
2. Paketbefunde SEC-09 zeitnah beheben und PROJ-31 mit messbaren Sitzungs-/MFA-Anforderungen spezifizieren; SEC-01 bis SEC-03 vor Echtdaten umsetzen und negativ testen.
3. SEC-04 bis SEC-06 mit freigegebenen Ergänzungen zu PROJ-19 bearbeiten; anschließend vollständige RLS-/Browser-Abnahme einschließlich direkter RPCs.
4. Schedulerüberwachung, Zielumgebungs-Laufnachweis, Restore/Incident-Probe, CI und Anbieter-/Datenschutzakten abnehmen.
5. Erst nach Erfüllung aller Gates eine versionierte Real-Data-Freigabe für die konkrete Umgebung erteilen. Ein bloßes Nutzer-„Ja“ ersetzt fehlende Nachweise nicht.

Der Auditauftrag autorisiert weder das Einspielen echter Gesundheitsdaten noch destruktive Hosted-Löschtests, produktive Auth-/Migrationsänderungen oder kostenpflichtige Dienste. Solche Schritte sind vorher konkret vorzubereiten und innerhalb einer passenden Beauftragung auszuführen. Der npm-Abgleich wurde nach ausdrücklicher Nutzerzustimmung durchgeführt; die zwischenzeitliche automatische Ablehnung ist damit aufgelöst. Für den abgeschlossenen Audit ist keine weitere Freigabe offen.
