# CI-Sicherheitskontrollen

Die eingecheckten Workflow-Definitionen bilden eine reproduzierbare, öffentlich
prüfbare Mindestkontrolle für DentPilot. Sie verwenden nur synthetische oder
keine Daten und übergeben weder Supabase-, Seed-, Deploy- noch Upload-Secrets.
Das gilt auch für Pull Requests aus Forks: Die Workflows nehmen keine
Repository-Secrets entgegen.

## Eingecheckte Workflows

- [verify.yml](../../.github/workflows/verify.yml) läuft bei Pull Requests und
  Pushes nach `main`. Er führt `npm ci` und anschließend `npm run verify` aus.
- [security.yml](../../.github/workflows/security.yml) läuft zusätzlich jeden
  Montag um 04:00 UTC sowie manuell. Er installiert reproduzierbar mit `npm ci`,
  prüft Abhängigkeiten ab Schweregrad `high`, prüft Whitespace-Diffs und scannt
  die vollständige eingecheckte Git-Historie nach Secret-Mustern.

Beide Workflows haben standardmäßig ausschließlich `contents: read` und
checkout speichert keine Zugangsdaten im Repository. Die Action-Pins sind
absichtlich unveränderliche Commit-SHAs:

- `actions/checkout`: `11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2)
- `actions/setup-node`: `49933ea5288caeca8642d1e84afbd3f7d6820020` (v4.4.0)
- `trufflesecurity/trufflehog`: `363923b901c911a9164f50b6c423f47c15372b1c`
  (v3.97.4)

Der TruffleHog-Aufruf wird ohne übergebene Zugangsdaten und mit
`--no-verification` ausgeführt. Dadurch werden mögliche Funde nicht gegen
externe Anbieter validiert. Die vollständige Historie wird durch
`fetch-depth: 0` und den Scan bis zum aktuellen Commit berücksichtigt.

## Umgang mit Funden

Workflow-Logs, Issues und Tickets dürfen keinen Rohwert eines möglichen
Secrets enthalten. Der Fund ist auf Pfad, Commit und den von dem Scanner
redigierten Kontext zu beschränken. Anschließend wird der vermeintliche Wert
außerhalb öffentlicher Kanäle geprüft; ein echter oder nicht sicher
auszuschließender Fund wird unverzüglich widerrufen/rotiert und nach dem
geltenden Incident-Prozess behandelt. Historisches Entfernen allein ersetzt
keinen Widerruf.

## Bewusst nicht durch diese Änderung konfiguriert

Diese Dateien aktivieren keine verpflichtenden Checks, Branch Protection,
Repository-Secrets, Environments, Cloud-Zugänge oder sonstige Einstellungen in
GitHub. Diese remote betriebenen Kontrollen müssen nach einer separaten
betrieblichen Freigabe eingerichtet und dokumentiert werden.

`npm run verify:full` ist ebenfalls nicht Teil dieser Workflows. Dieser Lauf
benötigt eine getrennte, rein synthetische lokale Supabase-Umgebung und einen
Edge-fähigen Browser; sie muss separat bereitgestellt und betrieben werden.
