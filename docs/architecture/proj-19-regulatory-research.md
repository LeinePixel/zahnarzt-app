# PROJ-19: Regulatorische Recherche zu Audit-Logging und Rollenrechten

**Stand:** 26.08.2026
**Status:** Entscheidungsgrundlage; keine Rechtsberatung und keine Freigabe des Real-Data-Gates.

Diese Notiz ergänzt, aber ändert nicht die verbindlichen Produktvorgaben in
[`privacy-security-ai-compliance.md`](privacy-security-ai-compliance.md). Sie verwendet
nur amtliche Primärquellen bzw. die offizielle BSI-Fachleitlinie.

## Für die Feature-Spezifikation verbindlich ableiten

| Thema | Entscheidung für PROJ-19 | Grundlage |
|---|---|---|
| Zweckbindung und Datenminimierung | Jedes Audit-Ereignis braucht einen dokumentierten Sicherheits-/Nachweiszweck. Speichern: Akteur-ID, Praxis, Aktion, Objektart/-referenz, Ergebnis und Zeit; nicht speichern: Passwörter, Tokens, Request-Bodies, medizinische Freitexte, Prompts oder unnötige Patientenattribute. | [DSGVO Art. 5](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) |
| Rollenrechte | Rechte müssen server- und datenbankseitig nach geringstem Privileg erzwungen werden; UI-Ausblendung genügt nicht. Zugriffe auf sensible Daten sind auf die für die Aufgabe benötigten Lese- und Schreibrechte zu beschränken. | [DSGVO Art. 25 und 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng); [BSI TR-03161-2, OSP.Authorization](https://www.bsi.bund.de/SharedDocs/Downloads/EN/BSI/Publications/TechGuidelines/TR03161/TR-03161-2.pdf?__blob=publicationFile&v=2) |
| Integrität und Zugriff auf Logs | Audit-Log und fachliche Historie bleiben getrennt. Normale Fachrollen und `praxisadmin` dürfen Audit-Ereignisse weder verändern noch löschen; ein später zu spezifizierendes, restriktives Audit-Leserecht erhält nur den erforderlichen Ausschnitt. Manipulationsschutz, Zugriffskontrolle, Wiederherstellbarkeit und Wirksamkeitsprüfungen sind Teil des risikobasierten Sicherheitskonzepts. | [DSGVO Art. 5, 25 und 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng); [BSI IT-Grundschutz OPS.1.1.5](https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Grundschutz/IT-GS-Kompendium_Einzel_PDFs_2022/04_OPS_Betrieb/OPS_1_1_5_Protokollierung_Edition_2022.html) |
| Aufbewahrung | Keine pauschale DSGVO-Frist festlegen. Vor Echtbetrieb werden Zweck, Empfänger, Zugriff, Aussonderungs-/Löschweg und begründete Frist pro Log-Kategorie dokumentiert und freigegeben. | [DSGVO Art. 5 Abs. 1 lit. b, c und e; Art. 30](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) |

Die Entscheidungen sind Architekturableitungen aus den genannten Normen, nicht
behauptete wörtliche Einzelpflichten der DSGVO.

## DSGVO-Kontext und offene Freigaben

- **Art. 5:** Auditdaten sind personenbezogen, sobald sie Mitarbeitenden oder Betroffenen zugeordnet oder zuordenbar sind. Neben Rechtmäßigkeit gelten Zweckbindung, Datenminimierung, Speicherbegrenzung, Integrität/Vertraulichkeit und die Nachweispflicht des Verantwortlichen.
- **Art. 9:** Gesundheitsdaten sind besondere Kategorien. Für die spätere Gesundheitsdatenverarbeitung ist neben einer Grundlage aus Art. 6 eine einschlägige Ausnahme aus Art. 9 Abs. 2 fachkundig festzulegen. Diese Notiz legt weder Rechtsgrundlage noch Ausnahme fest.
- **Art. 25:** Datenschutz durch Technikgestaltung und datenschutzfreundliche Voreinstellungen verlangt, bereits bei Gestaltung und Verarbeitung notwendige Maßnahmen umzusetzen; standardmäßig sind Datenmenge, Verarbeitungsumfang, Speicherfrist und Zugänglichkeit auf das Erforderliche zu begrenzen.
- **Art. 30:** Das Verzeichnis der Verarbeitungstätigkeiten muss u. a. Zwecke, Datenkategorien, Empfänger, Löschfristen und die allgemeinen Art.-32-Maßnahmen abbilden. Die Ausnahme für Organisationen unter 250 Beschäftigten greift nicht bei nicht nur gelegentlicher, riskanter oder Art.-9-Verarbeitung.
- **Art. 32:** Sicherheitsmaßnahmen richten sich nach Risiko und umfassen je nach Erforderlichkeit u. a. Verschlüsselung/Pseudonymisierung, fortlaufende Vertraulichkeit, Integrität, Verfügbarkeit und Belastbarkeit, Wiederherstellung sowie regelmäßige Wirksamkeitstests.
- **Art. 35:** Vor einer wahrscheinlich hochriskanten Verarbeitung ist eine DSFA durchzuführen. Groß angelegte Verarbeitung besonderer Kategorien und systematische, umfassende Bewertung sind ausdrücklich genannte Fälle. Für den Pilotbetrieb ist deshalb die DSFA-Schwelle einschließlich Restrisikoentscheidung mit Datenschutzfachkunde zu beurteilen; PROJ-19 ersetzt diese Prüfung nicht.

## AI-Act-Grenze

PROJ-19 selbst enthält gemäß Roadmap keine KI-Funktion. Die KI-bezogenen Audit-Anforderungen werden deshalb **nicht** vorgezogen: Der AI Act ist kein allgemeines Audit-Logging- oder RBAC-Gesetz. Seine Anwendung erfasst aber Anbieter und Betreiber von KI-Systemen in der EU; die DSGVO bleibt für dabei verarbeitete personenbezogene Daten unberührt ([AI Act Art. 2](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)).

Vor PROJ-15/16 ist der tatsächliche beabsichtigte Zweck separat zu klassifizieren. Eine Gesundheitsanwendung ist nicht allein deshalb Hochrisiko. Relevante Anknüpfungspunkte wären insbesondere Art. 6 und die Anhänge I/III; bei einem Hochrisiko-System gelten unter anderem automatische Ereignisprotokollierung (Art. 12), Transparenz-/Nutzungsinformationen (Art. 13), menschliche Aufsicht (Art. 14) und Betreiberpflichten (Art. 26). Die bereits geltende Pflicht zu angemessener KI-Kompetenz nach Art. 4 ist bei Einführung einer KI-Funktion zu prüfen. Ein AI-Impact-Check und eine mögliche Medizinproduktebewertung bleiben die in der Architektur dokumentierten Freigabegates.

## Entscheidungen vor Architekturfreigabe

1. Die zulässigen Aktionen und Lese-/Schreib-/Export-/Administrationsrechte je Rolle (`rezeption`, `behandler`, `praxisadmin`) festlegen; zukünftige Patienten- und Exportrechte nicht vorwegnehmen.
2. Audit-Leseverantwortung, Zweck, Empfängerkreis, Retention und prüfbaren Lösch-/Aussonderungsweg festlegen.
3. Den Schutz gegen nachträgliche Manipulation, das Notfall-/Break-glass-Verfahren und die Revisions-/Nachweisanforderungen mit Datenschutz- und Security-Owner entscheiden.
4. Vor realen oder re-identifizierbaren Daten Rechtsgrundlagen (einschließlich Art. 9), Verzeichnis nach Art. 30 und DSFA-Entscheidung nach Art. 35 im Real-Data-Gate dokumentieren und freigeben.

## Quellen

- [Verordnung (EU) 2016/679 (DSGVO), amtlicher Volltext](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) — Art. 5, 9, 25, 30, 32 und 35.
- [Verordnung (EU) 2024/1689 (AI Act), amtlicher Volltext](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng) — Art. 2, 4, 6, 12–14 und 26.
- [BSI TR-03161-2: Security Requirements for Healthcare Applications](https://www.bsi.bund.de/SharedDocs/Downloads/EN/BSI/Publications/TechGuidelines/TR03161/TR-03161-2.pdf?__blob=publicationFile&v=2) — insbesondere OSP.Authorization und OSP.Purpose.
- [BSI IT-Grundschutz-Kompendium, OPS.1.1.5 Protokollierung](https://www.bsi.bund.de/SharedDocs/Downloads/DE/BSI/Grundschutz/IT-GS-Kompendium_Einzel_PDFs_2022/04_OPS_Betrieb/OPS_1_1_5_Protokollierung_Edition_2022.html) — Schutz und Verwaltung von Protokolldaten.
