# PROJ-19 Audit and Authorization Design

**Status:** Freigegebener Entwurf, wartet auf die Prüfung der geschriebenen Spezifikation.
**Feature-Spezifikation:** [`features/PROJ-19-audit-logging-and-role-permissions.md`](../../../features/PROJ-19-audit-logging-and-role-permissions.md)

## Architektur

PROJ-19 führt einen zentralen Autorisierungsmodul an der Server-/Datenbankgrenze ein. Er bestimmt aus verifizierter Identität, Identitätstyp, Praxisbezug, Fähigkeit und gegebenenfalls einer aktiven Supportfreigabe, ob eine Aktion erlaubt ist. Alle unbekannten, fehlenden, fremden oder abgelaufenen Zustände werden verweigert; RLS bleibt die letzte Datenbankinstanz.

Für Praxisidentitäten wird die bestehende Zuordnung aus `user_profile` verwendet. Anbieteridentitäten liegen getrennt und erhalten nicht automatisch einen Praxisbezug. Ein Portaladmin kann Auditdaten nur innerhalb einer aktiven, von der betreffenden Praxis freigegebenen Supportfreigabe lesen.

Audit-Lesen und auditpflichtige Mutationen erfolgen über kleine, zweckgebundene Datenbankoperationen: Die Operation prüft die Berechtigung, schreibt das datenminimierte Ereignis und führt die erlaubte Aktion in einer Transaktion aus. Dadurch kann keine sicherheitsrelevante Mutation erfolgreich werden, wenn ihr Nachweis nicht gespeichert werden kann. Der Audit-Leseweg verweigert die Anzeige, wenn der Nachweis der Einsicht nicht geschrieben werden kann.

## Datenfluss

1. Die Server-Schicht verifiziert die Supabase-Claims und löst den Identitätstyp auf.
2. Der Autorisierungsmodul prüft Rolle/Fähigkeit oder die Supportfreigabe für die angeforderte Praxis.
3. Die Datenbankoperation erzwingt RLS, speichert das Audit-Ereignis und liefert nur die zugelassene Antwort.
4. Audit-Einsicht wird ausschließlich dem Portaladmin mit aktiver Freigabe angezeigt; die UI bietet keine Exportfunktion und keine Freitextsuche.
5. Die datenbankseitige Wartungsroutine entfernt Ereignisse nach 90 Tagen.

## Fehlerverhalten

- Unbekannte oder unvollständige Identität: verweigern, keine Details preisgeben.
- Falsche Rolle, fremde Praxis, fehlende/abgelaufene/widerrufene Freigabe: verweigern und ein minimiertes Ereignis schreiben, soweit die Datenbankoperation erreichbar ist.
- Fehler beim Audit-Schreiben: keine auditpflichtige Mutation und keine Audit-Anzeige.
- Fehler der Wartungsroutine: keine unkontrollierte Wiederholung im Browser; Betriebshinweis ohne Auditinhalt.

## Teststrategie

- Unit: Fähigkeitsmatrix, Ablaufzeit, Widerruf, unbekannte Identität und Schema-Redaktion.
- pgTAP: Grants, RLS, Cross-Tenant-Zugriffe, alle verbotenen Mutationen, atomare Audit-Operationen und 90-Tage-Grenze.
- Playwright: Praxisfreigabe, Portaladmin-Einsicht, Ablauf/Widerruf, gesperrter Export und sichere Fehlerzustände.

## Nicht im Entwurf enthalten

Break-Glass, Anbieterzugriff auf Fachinhalte, Benutzerverwaltung, externe Support-Ticket-Integration, Audit-Export, KI-Funktionen und die Freigabe echter Daten.
