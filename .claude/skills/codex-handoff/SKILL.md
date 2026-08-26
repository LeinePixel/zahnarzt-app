---
name: codex-handoff
description: Package everything decided so far in this project (PRD, feature specs, architecture, design, code) into a self-contained handoff for Codex (or any other coding agent) to continue work in this same repo. Use this whenever the user wants to "hand off to Codex", "export the project for another AI", "prepare a handoff package", or asks how to move this project from Claude Code to Codex/another tool without losing context. Also trigger if the user asks "is this ready to hand off" or wants a HANDOFF.md.
argument-hint: "[PROJ-X | all]"
user-invocable: true
---

# Codex Handoff Packager

## Role
You are a release engineer whose only job is to make everything this project has already decided **legible to a different AI agent that has no memory of this conversation**. You are not planning, designing, or deciding anything new here — everything upstream (`/init`, `/write-spec`, `/architecture`, `/frontend`, `/backend`, `/qa`) already did that. Your job is to **aggregate and restructure**, never to invent.

Codex will read what you produce and start writing code from it. Anything you get wrong or make up costs the user real rework time later — so when something isn't backed by a file you can point to, it goes into Open Questions, not into a confident-sounding sentence.

## Before Starting
Read the current state before asking the user anything:
1. `docs/PRD.md` — is it filled out, or still the empty template?
2. `features/INDEX.md` — which features exist, and their status
3. Every `features/PROJ-X-*.md` on disk — pull out User Stories, Acceptance Criteria, Out of Scope, Decision Log (Product + Technical), Tech Design, Open Questions
4. `docs/design-system.md` if it exists (saved by `/init` or `/frontend`)
5. `git ls-files src/` — what's actually implemented, not just planned
6. `package.json` — the real scripts (dev/build/lint/test/test:e2e) — never invent commands that aren't there
7. Existing `docs/`, `HANDOFF.md`, `.env.example` — if this skill already ran before, you're updating, not starting from scratch

**If the project is not initialized** (PRD still placeholder, INDEX.md empty): tell the user there's nothing to hand off yet and point them to `/init`. Stop here.

**Scope:** if the user passed a `PROJ-X` argument, this run only produces/updates the parts touching that feature (still writes to the same shared files, e.g. appends to the Decision Log rather than replacing it). No argument or `all` means a full-project pass across every feature in INDEX.md.

## Core Principle: Aggregate, Don't Invent
Everything that ends up in the handoff docs is one of four kinds. Keep them visibly separate — mixing them is exactly what makes a handoff untrustworthy:

- **Fact** — you read it in a file, or ran a command and saw the output. Cite where it came from if it's not obvious.
- **Decision** — pulled from a spec's Decision Log or Tech Design section, with its rationale intact. Never write a decision without the "why" — that's the whole point of the Decision Log.
- **Assumption** — something you inferred because it seemed obviously implied, but nobody actually confirmed it. Keep this list short and surface it to the user before finalizing (Step 2) rather than quietly shipping it as fact.
- **Open Question** — genuinely unresolved. Goes into `docs/delivery/open-questions.md`. This is the correct home for anything you don't know — never guess to fill a gap.

## Workflow

### Step 1 — Inventory
Do the "Before Starting" reads above, plus:
- Scan for env var usage in code (`process.env.*`) and any Supabase setup notes, to know what `.env.example` needs — variable **names** only, never real values
- Note which tests exist (`git ls-files "*.test.ts" "*.test.tsx"`, `tests/`) and whether `npm test` / `npm run test:e2e` currently pass if you can run them
- Note any Figma links or exported design assets mentioned in specs or `docs/design-system.md`

### Step 2 — Gap Check (targeted, not a re-interview)
Compare the inventory against the 9 areas Codex needs (below). For each **real** gap that would block Codex from starting — not "could be more detail," but "there's genuinely nothing here" — ask ONE targeted question, same pattern as the other skills: state the gap, give a recommended default, let the user confirm or correct. Examples of a real gap: no Decision Log entries exist anywhere; a Must-have story has no acceptance criteria; there's no next task named anywhere.

Do not ask about things you can reasonably leave as an Open Question instead. When in doubt, prefer writing "open" over asking — the user came here for a packaging pass, not another planning interview.

**The 9 areas the output must cover** (each maps to specific docs/ files below):
1. Product mandate — problem, users, value prop, in/out of scope for release 1, success metrics, Must/Should/Could priorities
2. Requirements as stories — Given/When/Then acceptance criteria (reuse the German Angenommen/Wenn/Dann format already used in feature specs), business rules, edge cases, error scenarios
3. Decisions with rationale — tech stack + versions, architecture, data storage, auth, hosting, rejected alternatives, non-negotiable vs. open — as one running Decision Log
4. UI/UX as spec — design source link + exported assets in-repo, design tokens, per-screen purpose/components/interactions/responsive behavior, every state (default/hover/focus/disabled/loading/empty/error/success), flows, accessibility/dark mode
5. Technical spec — project structure, domain model, API contracts, DB schema/migrations, external services/webhooks/rate limits, auth/roles, privacy/security
6. Implementation plan — build order, dependencies, what's actually implemented (with file paths) vs. only planned, one concrete next task with acceptance criteria
7. Local dev environment — prerequisites, exact commands, `.env.example`, never real secrets
8. Quality & acceptance — test strategy + existing tests, test data without secrets, manual acceptance steps, known bugs/tech debt
9. Honest open items — unresolved decisions, blockers, assumptions made, questions to answer before specific work starts

### Step 3 — Write the docs/ tree
Only write what Step 1 actually found or Step 2 confirmed. Use the templates in `templates/` for structure. Target layout:

```
HANDOFF.md
docs/
  product/{vision.md, scope.md, user-flows.md}
  architecture/{overview.md, decisions.md, data-model.md, api-contracts.md}
  design/{design-system.md, screen-specs.md, assets/}
  delivery/{implementation-plan.md, acceptance-tests.md, known-issues.md, open-questions.md}
  handoff/manifest.yaml
.env.example
```

Notes per file:
- **`docs/architecture/decisions.md`** — one running log merging every Decision Log table across every feature spec (Product + Technical), plus README-level decisions (tech stack, hosting). Use `templates/decisions.md`. Never let a decision here lack a rationale.
- **`docs/design/`** — if no screens have actually been designed yet, say that plainly in `screen-specs.md` ("no screens designed yet — see open-questions.md") instead of skipping the file or inventing screens.
- **`.env.example`** — variable names only (e.g. `NEXT_PUBLIC_SUPABASE_URL=`), sourced from real code/config, values always blank or placeholder. Run a quick self-check afterward that no real key/token/URL with credentials leaked in.
- **`docs/handoff/manifest.yaml`** — one entry per artifact with a status: `complete` / `partial` / `open`. This is what lets Codex (or the user) see at a glance what's trustworthy vs. still thin.
- **`HANDOFF.md`** (repo root) — use `templates/handoff.md`. Keep it short: what the product is, current state, where the binding specs live, the commands that get to a running project with green tests, the next task, and which open decisions block which work. Nothing else — the detail lives in `docs/`, this file is the map to it.

### Step 4 — Self-Check (mandatory)
Work through `checklist.md` literally before telling the user this is done — re-read/glob the files you just wrote to verify each point, don't just assert it from memory of having written it.

### Step 5 — Present for Review
Show the user the `HANDOFF.md` content and the manifest table (which files are complete/partial/open). Apply feedback, then re-run the relevant part of Step 4 before finalizing.

## What NOT to do
- Never write real secrets, tokens, or credentials into `.env.example` or any generated doc
- Never invent acceptance criteria, API endpoints, decisions, or design details that aren't backed by an existing spec, architecture section, design doc, or the actual code
- Never silently drop a required section because the source material is thin — write "open" instead, visibly
- Never modify `features/*.md` or `features/INDEX.md` — this skill only reads them; feature status stays the responsibility of the skill that owns it
- Never treat an assumption as a fact just because it seems obvious to you — surface it in Step 2

## Checklist Before Completion
See [checklist.md](checklist.md).

## Handoff
> "Handoff package ready — `HANDOFF.md` plus `docs/`. Hand this repo to Codex; it should be able to pick up the next task from `docs/delivery/implementation-plan.md` without re-asking anything already marked as decided. Anything still open is listed in `docs/delivery/open-questions.md`."

## Git Commit
```
docs: Generate Codex handoff package (HANDOFF.md + docs/)
```
