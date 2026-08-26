<!--
Template for docs/architecture/decisions.md — the ONE running Decision Log
for the whole project. Merge every Decision Log table found across
features/PROJ-X-*.md (Product + Technical sections), plus project-level
decisions (tech stack, hosting) that don't belong to a single feature.

Never add a row without a rationale. If you can't find the rationale for
something that was clearly decided (e.g. Next.js is already in package.json),
write "assumed — not explicitly discussed" rather than inventing one.
Delete this comment block when generating the real file.
-->
# Decision Log

Every consequential decision made on this project, with why — so nobody re-litigates something already settled. Sourced from feature specs' Decision Log sections and project-level choices. New decisions get appended here by `/architecture`, `/backend`, `/frontend`, or manually — never edit past rows, only add new ones or mark them superseded.

## Non-negotiable constraints
_Things the user stated as fixed, not open for debate._

| Constraint | Why | Source |
|---|---|---|
| _example: Must use Supabase, no other backend_ | _team already has Supabase infra_ | PRD Constraints |

## Project-level decisions

| Decision | Rationale | Alternatives considered | Date | Source |
|---|---|---|---|---|
| _example: Next.js 16 App Router_ | _template default; team knows it_ | _(none discussed)_ | YYYY-MM-DD | CLAUDE.md |

## Feature-level decisions
_One row per Decision Log entry across all `features/PROJ-X-*.md` files. Group by feature._

### PROJ-X: [Feature name]
| Decision | Rationale | Date |
|---|---|---|
| | | |

<!-- repeat per feature -->

## Open preferences
_Things leaning one way but not locked — Codex can proceed with the stated default but should flag if it turns out to matter._

| Topic | Current lean | Why not locked yet |
|---|---|---|
