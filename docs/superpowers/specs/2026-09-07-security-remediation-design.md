# Security-remediation design — decision source

**Status:** Planning baseline, 2026-09-07

**Scope:** Decision summary for PROJ-31 and its PROJ-19 authorization boundary.

This document is the single decision-source summary for the security-remediation
work. It records approved parameters separately from unresolved product,
operations and privacy decisions. It does not evidence implementation, hosting,
or Real-Data-Gate approval.

## Approved decisions

| ID | Approved decision | Rationale |
|---|---|---|
| D01 | TOTP MFA for every current practice role and `portaladmin`; no durable recovery bypass | The second factor must not be optional for identities with practice or provider access. |
| D02 | Five minutes of human inactivity before global client lock/logout; eight-hour maximum session | Limits unattended access at practice workstations. |
| D03 | Five-minute JWT lifetime; revocation/account lock effective for new protected data operations within at most 60 seconds through a current server/database session-state check | Browser/UI state cannot authoritatively enforce lock or revocation. |
| D04 | AAL2 enforcement in RLS and every protected `SECURITY DEFINER` RPC | The database boundary, not UI or proxy, is the authorization boundary. |
| D10 | Retain existing SSR cookies; `Secure` over HTTPS; nonce-based CSP without a broad script `unsafe-inline` exception | Preserves the tested SSR model while tightening transport and script execution. |

Sensitive support actions require authentication no older than five minutes.
These controls are planned implementation requirements, not statements that the
current product already enforces them.

## Explicitly open decisions

| ID | Open decision | Boundary |
|---|---|---|
| D05 | Support/audit quotas and their audit treatment | No quota, response behavior or audit payload may be invented. |
| D06 | Support-grant retention | No retention or deletion period may be assumed. |
| D07 | Cron alert recipient/channel | No recipient, channel or external alerting service may be assumed. |
| D08 | Backup RPO/RTO and operations | No operational recovery objective or process may be claimed. |
| D09 | Legal/privacy readiness decisions | No legal, privacy, provider or Real-Data-Gate approval may be inferred. |

## Non-regression constraints

PROJ-19 retains separated `portaladmin` identities, practice-scoped and
time-limited support grants, no audit export, 90-day audit deletion, and no
Break-Glass access. The existing SSR-cookie architecture is retained; this
design does not authorize an untested move to a server-only/HttpOnly-session
architecture.

## Status boundary

PROJ-31 remains **Planned**. The current repository contains only the approved
decision baseline. Implementation, test evidence, hosted configuration and
Real-Data-Gate approval remain separate future work.
