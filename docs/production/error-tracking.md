# Technisches Monitoring und Incident-Erkennung

**Stand:** 07.09.2026. Sentry ist nicht angebunden. Betriebsabnahme offen; T09/T10 des [Security-Umsetzungsplans](../superpowers/plans/2026-09-07-security-remediation.md) sind der Umsetzungseinstieg.

## Anforderungen

- Schedulerfehler und fehlende/überfällige Läufe mit technischen Kennzahlen erkennen; Empfänger, Dienstbereitschaft und Eskalation festlegen und testen.
- Keine Request-/Response-Bodies, Cookies, Tokens, Praxis-/Patientenidentitäten, medizinischen Inhalte, Query-Strings, Session-Replays oder Auth-Screenshots erfassen.
- Fehlermeldungen auf kontrollierte Kategorien beschränken. CSP-Reports und SDK-Breadcrumbs ebenfalls auf Datenabfluss prüfen.
- Historienfrist, Zugriff auf Alarme/Logs und administrative Änderungen dokumentieren. Monitoring ersetzt kein Audit und keinen Restore-/Incident-Test.

## Anbieter und Konfiguration

Die frühere allgemeine Sentry-Wizard-Anleitung ist keine Implementierungsfreigabe. Vor einer konkreten Integration Anbieter, Region, Verträge, Subprozessoren, Übertragungen, Retention und Kosten prüfen. Automatische Instrumentierung vor Aktivierung kontrollieren und mit synthetischen Testereignissen auf Leaks prüfen.

Build-/Uploadtokens bleiben in separater CLI-/CI-Secretverwaltung und gelangen nicht in .env.local, Browser oder normale App-Serverumgebungen. Source-Map-Zugriff begrenzen. Neue Variablen erst im gewählten Konfigurationskonzept dokumentieren; keinen Dienst allein für die Planerstellung installieren oder kontaktieren.
