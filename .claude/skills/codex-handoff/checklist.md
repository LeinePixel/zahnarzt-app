# Codex Handoff Self-Check

Work through every item literally — by re-reading or globbing the actual file, not from memory of having written it. This checklist is the entire reason this skill exists: a handoff nobody verified is worse than no handoff, because it looks trustworthy.

## Integrity
- [ ] Every link and file path mentioned in `HANDOFF.md` and `docs/**` actually resolves — checked with Read/Glob, not assumed
- [ ] `docs/handoff/manifest.yaml` lists every artifact this run touched, with an honest `complete` / `partial` / `open` status
- [ ] Design docs, requirement docs, and the implementation plan don't contradict each other (e.g. a screen spec referencing a field the API contract doesn't have, or a plan step that assumes a decision that's actually still open)

## Completeness
- [ ] Every Must-have requirement (from PRD priorities / feature specs) has at least one Given/When/Then acceptance criterion attached — if it doesn't, that's an Open Question, not a silent gap
- [ ] Every technical integration mentioned (external service, webhook, auth provider, DB) has configuration steps, error/retry behavior, and a test hint documented — not just "we use X"
- [ ] `docs/delivery/implementation-plan.md` names exactly one next task, with its own acceptance criteria, prioritized above everything else in the plan

## Safety
- [ ] No real secrets, API keys, tokens, or credentials anywhere in `docs/**`, `HANDOFF.md`, or `.env.example` — `.env.example` has variable names and placeholder values only
- [ ] Nothing in `features/*.md` or `features/INDEX.md` was modified — this skill is read-only there

## Honesty
- [ ] Every fact in the output traces back to a file you read or a command you ran — nothing was filled in because it "seemed likely"
- [ ] Every Assumption made during this run was surfaced to the user in Step 2, not shipped silently
- [ ] Anything genuinely unknown is listed in `docs/delivery/open-questions.md`, not smoothed over with confident-sounding prose

## Before telling the user it's done
- [ ] User has reviewed `HANDOFF.md` + the manifest and given feedback
- [ ] Feedback applied and this checklist re-run for anything that changed
