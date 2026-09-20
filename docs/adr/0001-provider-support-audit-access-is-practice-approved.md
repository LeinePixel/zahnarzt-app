# Anbieterzugriff auf Audit-Ereignisse ist praxisfreigegeben und zeitlich begrenzt

**Status:** Accepted — 2026-08-26

`portaladmin` ist eine separate Anbieteridentität und keine vierte Praxisrolle. Ein `praxisadmin` legt eine Supportfreigabe für seine Praxis an und kann sie widerrufen. Ein Portaladmin aktiviert diese Freigabe über ihre undurchsichtige ID mit einer strukturierten Ursache; erst dann darf er Audit-Ereignisse dieser Praxis sehen. Der Zugriff läuft standardmäßig acht Stunden und spätestens 24 Stunden nach Aktivierung ab; eine Verlängerung verlangt eine neue Praxisfreigabe. Das schützt vor einer dauerhaften, praxisübergreifenden Superuser-Rolle und lässt dennoch nachvollziehbaren Support zu.

**Präzisierung 06.09.2026:** Die Zuständigkeiten entsprechen der [PROJ-19-Spec](../../features/PROJ-19-audit-logging-and-role-permissions.md) und [ADR-0003](0003-support-grants-are-activated-by-opaque-id.md).

## Considered Options

- **Praxisadmin liest Audits:** verworfen, weil Praxisadministration nicht zugleich eine interne Kontrollrolle sein soll.
- **Dauerhafte anbieterweite Superuser-Rolle:** verworfen, weil sie Mandantentrennung, Datenminimierung und überprüfbare Zweckbindung unterläuft.
- **Break-Glass-Zugang im MVP:** verworfen; es gibt noch keine klinisch kritischen Abläufe und ein Notfallzugang braucht eine eigene Risiko- und Freigabeprüfung.

## Consequences

Supportzugriffe benötigen einen eigenen Zustands- und Ablaufzeitnachweis, MFA und eine erneute Anmeldung vor der Einsicht. Ein späteres Recht, Praxisdaten zu ändern, Konten zu verwalten oder Fachinhalte zu lesen ist nicht durch diese ADR freigegeben und erfordert eine eigene Spezifikation.
