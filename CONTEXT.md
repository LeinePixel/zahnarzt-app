# DentPilot

DentPilot unterstützt Zahnarztpraxen bei organisatorischen Arbeitsabläufen. Die Praxissoftware bleibt für medizinische Daten führend; DentPilot verarbeitet bis zur Freigabe des Real-Data-Gates ausschließlich synthetische Daten.

## Identität und Zugriff

**Praxismitglied**:
Eine angemeldete Person, die genau einer Praxis zugeordnet ist und die Rolle `rezeption`, `behandler` oder `praxisadmin` hat.
_Avoid_: Tenant-Admin, Praxis-Admin für anbieterweite Zugriffe

**Portaladmin**:
Eine anbieterweite, von Praxismitgliedern getrennte Supportidentität. Sie erhält nie durch ihre Rolle allein Zugriff auf eine Praxis.
_Avoid_: Superuser, globaler Praxisadmin

**Supportfreigabe**:
Eine von einem Praxisadmin veranlasste, widerrufbare Erlaubnis, mit der ein Portaladmin für eine einzelne Praxis begrenzten Audit-Lesezugriff erhält.
_Avoid_: Dauerzugriff, Break-Glass-Zugang

**Break-Glass-Zugang**:
Ein zeitlich eng begrenzter, außergewöhnlicher Notfallzugang außerhalb der normalen Berechtigungen. Er ist im MVP nicht vorhanden.

## Externe Datenquellen

**Mock-PVS-Service**:
Ein eigenständiger, ausschließlich lokaler und synthetischer HTTP-Dienst, der eine lesende PVS-Quelle für Adapter- und Synchronisationstests simuliert. Er ist weder Teil der DentPilot-Anwendung noch eine echte Praxissoftware-Anbindung.

**Externe PVS-Kennung**:
Eine stabile Kennung aus der simulierten oder später echten PVS-Quelle. Sie ist keine DentPilot-, Supabase- oder Praxis-Kennung und wird erst mit dem Integration-Adapter einer DentPilot-Praxis zugeordnet.

## Nachvollziehbarkeit

**Audit-Ereignis**:
Ein datenminimierter, technischer Nachweis einer sicherheitsrelevanten Aktion oder Zugriffsentscheidung. Es enthält keine Inhaltsdaten, medizinischen Freitexte, Secrets oder Request-Bodies.
_Avoid_: Fachhistorie, Kommunikationsverlauf

**Korrelations-ID**:
Eine technische Kennung, die die zu einer einzelnen Anfrage oder einem Supportfall gehörenden Audit-Ereignisse verbindet, ohne einen fachlichen Inhalt zu speichern.

**Neutrales verweigertes Ergebnis**:
Eine technisch erfolgreiche Antwort ohne Ereignisinhalte, die mitteilt, dass eine PROJ-19-Aktion nicht ausgeführt wurde, ohne den Grund oder die Existenz einer Praxis, Freigabe oder Identität offenzulegen. Sie ermöglicht die dauerhafte Aufzeichnung des `denied`-Audit-Ereignisses in derselben Transaktion.
_Avoid_: SQL-Fehler als Audit-Ersatz, detaillierte Berechtigungsfehlermeldung
