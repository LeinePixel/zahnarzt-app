# Verweigerte Supportversuche werden neutral beantwortet und dauerhaft auditiert

**Status:** Accepted — 2026-08-28

Verweigerte PROJ-19-Support- und Auditaufrufe liefern ein neutrales Ergebnis statt eines SQL-Fehlers: die Aktion wird nicht ausgeführt und keine Ereignisinhalte werden ausgeliefert, während ein datenminimiertes `denied`-Audit-Ereignis in derselben erfolgreich abgeschlossenen Transaktion gespeichert wird. Das verhindert sowohl Mandanten-Informationslecks als auch den PostgreSQL-Rollback, der einen Audit-Eintrag beim anschließenden `42501`-Fehler wieder entfernen würde.

## Consequences

Die Server-Schicht behandelt ein neutrales Ergebnis als Zugriff verweigert und zeigt keine Ursache oder Existenzinformation an. Ungültige technische Eingaben bleiben validiert; sie erhalten ebenfalls keine Detailinformation an Praxis- oder Portalnutzer. Diese Regel gilt nicht als Freigabe eines Fehler-Schluckens: Audit-Schreibfehler lassen die fachliche Aktion weiterhin fehlschlagen.
