# PROJ-19: Rollen- und Audit-Modell

**Status:** Freigegebener Architekturentwurf, 26.08.2026
**Bindende Feature-Spezifikation:** [`features/PROJ-19-audit-logging-and-role-permissions.md`](../../features/PROJ-19-audit-logging-and-role-permissions.md)

Diese Beschreibung definiert die Begriffe und Sicherheitsgrenzen. Akzeptanzkriterien und Implementierungsdetails stehen ausschließlich in der Feature-Spezifikation.

## Rollenmatrix

| Identität | Audit lesen | Audit exportieren | Audit ändern/löschen | Praxisübergreifend |
|---|---:|---:|---:|---:|
| `rezeption` | Nein | Nein | Nein | Nein |
| `behandler` | Nein | Nein | Nein | Nein |
| `praxisadmin` | Nein | Nein | Nein | Nein |
| `portaladmin` | Nur mit aktiver Supportfreigabe für genau eine Praxis | Nein | Nein | Nur innerhalb der Freigabe |

`portaladmin` ist nicht Teil von `public.user_role` und hat kein `user_profile`. Es ist eine separate Anbieteridentität. Die drei Praxisrollen behalten ihre bisherige Bedeutung; fachliche Rechte für noch nicht existierende Patienten-, Termin- oder Kommunikationsfunktionen werden nicht vorweggenommen.

## Supportfreigabe

1. Ein `praxisadmin` eröffnet für seine eigene Praxis einen begrenzten Supportfall.
2. Ein `portaladmin` aktiviert die Freigabe mit einer strukturierten Supportkategorie und erneuter Anmeldung.
3. Die Freigabe gilt standardmäßig acht Stunden, höchstens 24 Stunden, und ist durch einen `praxisadmin` widerrufbar.
4. Nach Ablauf oder Widerruf ist jeder Zugriff sofort zu verweigern. Eine Verlängerung ist eine neue Praxisfreigabe.

Der Supportfall darf länger offen bleiben als seine Zugriffsfreigabe. Eine Freigabe gewährt ausschließlich Audit-Lesezugriff; kein Export, keine Änderung, keine Benutzerverwaltung und keinen Zugriff auf Fach- oder Patienteninhalte.

## Audit-Datenvertrag

Ein Audit-Ereignis enthält nur:

- Akteurtyp und Akteurkennung,
- Praxiskennung,
- Aktion als kontrollierter Wert,
- Objektart und undurchsichtige Objektreferenz,
- Ergebnis (`allowed`, `denied` oder `failed`),
- Zeitpunkt und Korrelations-ID.

Nicht zulässig sind Freitext, Anzeige- oder Patientennamen, medizinische Inhalte, Prompts, Request-/Response-Bodies, Passwörter, Tokens, IP-Adressen oder Exportdaten. Audit- und fachliche Kommunikationshistorie bleiben getrennt.

## Aufbewahrung und Grenzen

Eine ausschließlich datenbankseitige Wartungsroutine löscht Audit-Ereignisse mit einem Ereigniszeitpunkt von mindestens 90 Tagen; sie läuft nicht im Browser und ist für alle Anwendungsrollen unaufrufbar. Dies ist eine bestätigte MVP-Produktentscheidung, keine pauschale gesetzliche Aufbewahrungsfrist. Backup-, Wiederherstellungs- und Rechtsgrundlagenentscheidungen bleiben Teil des Real-Data-Gates.

Break-Glass-Zugriff, Audit-Export, dauerhafter Anbieterzugriff, providerseitige Praxisverwaltung und Zugriffe auf Patienten- oder Fachinhalte sind nicht Bestandteil von PROJ-19.
