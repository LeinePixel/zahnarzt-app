# PROJ-19: Threat Model

**Status:** Freigegebener Architekturentwurf, 26.08.2026
**Scope:** Rollenrechte, Audit-Ereignisse und zeitlich begrenzter Anbieter-Supportzugriff. Ausschließlich synthetische Daten.

## Schutzgüter

- Mandantentrennung und Rolle eines Praxismitglieds,
- Integrität und Vertraulichkeit von Audit-Ereignissen,
- zeitlich und sachlich begrenzte Supportfreigaben,
- die Nachvollziehbarkeit von Anbieterzugriffen,
- Geheimnisse sowie medizinische und personenbezogene Inhaltsdaten.

## Risiken und verbindliche Kontrollen

| Risiko | Kontrolle | Prüfnachweis |
|---|---|---|
| Praxismitglied liest Auditdaten oder eine fremde Praxis | Zentraler Autorisierungsmodul und RLS verweigern jede Audit-Leseabfrage für Praxisrollen und jeden fremden Praxisbezug. | Unit- und pgTAP-Negativtests |
| Portaladmin wird zum dauerhaften Superuser | Getrennte Identität, Praxisfreigabe, Ablaufzeit, erneute Anmeldung und MFA; keine implizite oder globale Freigabe. | Unit-, pgTAP- und E2E-Tests |
| Freigabe wird nach Ablauf oder Widerruf weiter genutzt | Die Berechtigung wird bei jeder Audit-Leseoperation zeit- und praxisbezogen geprüft und standardmäßig verweigert. | Grenzzeit- und Widerrufstests |
| Auditdaten werden verändert, gelöscht oder exportiert | Keine Anwendungsrolle erhält UPDATE-, DELETE- oder Exportrechte; RLS und Grants begrenzen Rohzugriff. | pgTAP-Privileg- und RLS-Tests |
| Sicherheitsrelevante Aktion bleibt ohne Nachweis | Für auditpflichtige Mutationen wird Autorisierung, Aktion und Audit-Schreiben in einer atomaren Datenbankoperation ausgeführt; scheitert das Audit-Schreiben, scheitert die Mutation. | Datenbank- und Integrationstests |
| Auditdaten enthalten sensible Inhalte | Striktes Schema und Validierung erlauben nur kontrollierte Metadaten. | Unit-Tests für Schema/Redaktion |
| Anbieter missbraucht die Auditansicht | Vor der Datenabfrage werden aktive Freigabe und strukturierter Supportgrund geprüft; jede Einsicht erzeugt ein eigenes Audit-Ereignis. | E2E- und pgTAP-Tests |
| Wartungsroutine löscht falsche Daten | Die Routine löscht nur Audit-Ereignisse mit `occurred_at` mindestens 90 Tage vor Ausführung und ist für Anwendungsrollen nicht ausführbar. | pgTAP-Grenzzeit- und Mandantentests |

## Bewusste Restriktionen

- Kein Break-Glass-Zugang im MVP.
- Kein Export und keine Freitextsuche in der Auditansicht.
- Kein Audit- oder Fachinhalt in allgemeinen Logs, Telemetrie, URLs oder Browser-Speicher.
- Kein Anbieterzugriff auf Patienten- oder Fachinhalte durch diese Funktion.

## Regulatorische Einordnung

Auditdaten können personenbezogen sein. Datenminimierung, Zugriffsbeschränkung, Zweckbindung und risikogerechte Sicherheit sind deshalb verbindliche Entwurfsgrundsätze. Die 90-Tage-Frist ist vor echten Daten im Real-Data-Gate gegen konkrete Rechtsgrundlagen, Aufbewahrungsanforderungen, Backups und Wiederherstellbarkeit zu prüfen. PROJ-19 enthält keine KI-Funktion; die EU-AI-Act-Einstufung bleibt für PROJ-15/16 vorbehalten. Quellen und die detaillierte Ableitung stehen in [`proj-19-regulatory-research.md`](proj-19-regulatory-research.md).
