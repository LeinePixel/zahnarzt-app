# Anbieterzugriff auf Audit-Ereignisse ist praxisfreigegeben und zeitlich begrenzt

**Status:** Accepted — 2026-08-26

`portaladmin` ist eine separate Anbieteridentität und keine vierte Praxisrolle. Sie darf Audit-Ereignisse nur für eine einzeln ausgewählte Praxis sehen, wenn ein `praxisadmin` die Supportfreigabe aktiviert hat; der Zugriff läuft standardmäßig nach acht Stunden und spätestens nach 24 Stunden ab, eine Verlängerung verlangt eine neue Praxisfreigabe. Das schützt vor einer dauerhaften, praxisübergreifenden Superuser-Rolle und lässt dennoch nachvollziehbaren Support zu.

## Considered Options

- **Praxisadmin liest Audits:** verworfen, weil Praxisadministration nicht zugleich eine interne Kontrollrolle sein soll.
- **Dauerhafte anbieterweite Superuser-Rolle:** verworfen, weil sie Mandantentrennung, Datenminimierung und überprüfbare Zweckbindung unterläuft.
- **Break-Glass-Zugang im MVP:** verworfen; es gibt noch keine klinisch kritischen Abläufe und ein Notfallzugang braucht eine eigene Risiko- und Freigabeprüfung.

## Consequences

Supportzugriffe benötigen einen eigenen Zustands- und Ablaufzeitnachweis, MFA und eine erneute Anmeldung vor der Einsicht. Ein späteres Recht, Praxisdaten zu ändern, Konten zu verwalten oder Fachinhalte zu lesen ist nicht durch diese ADR freigegeben und erfordert eine eigene Spezifikation.
