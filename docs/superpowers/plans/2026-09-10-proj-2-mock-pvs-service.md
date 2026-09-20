# PROJ-2 Mock-PVS-Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen getrennten lokalen TypeScript-HTTP-Dienst bereitstellen, der ausschließlich synthetische PVS-Patienten, Termine und reproduzierbare Änderungs- sowie Fehlerszenarien über einen versionierten, token-geschützten Vertrag liefert.

**Architecture:** Der Dienst lebt unter `services/mock-pvs/`, hält versionierte Fixtures ausschließlich im Speicher und verwendet Node-HTTP sowie Zod. Die reguläre `/v1`-Fläche ist lesend und nur mit Lese-Token erreichbar; der davon getrennte `/__test`-Zugang schaltet ausschließlich feste Szenarien mit eigenem Test-Token. DentPilot, Supabase und Browsercode greifen in PROJ-2 nicht auf den Dienst zu.

**Tech Stack:** TypeScript 5, Node-HTTP und Node-Crypto, Zod 4, Vitest 4, `tsx`; keine neue Laufzeitabhängigkeit, keine Datenbank und keine Next.js-Route.

**Spec:** `features/PROJ-2-mock-pvs-service.md` und `docs/superpowers/specs/2026-09-10-proj-2-mock-pvs-service-design.md`

## Global Constraints

- Alle Fixtures, Testwerte und Dokumentationsbeispiele bleiben eindeutig synthetisch; echte oder re-identifizierbare Patient:innen-, Gesundheits-, Kontakt- und Beschäftigtendaten sind untersagt.
- Der Dienst benutzt weder Supabase noch DentPilot-Tabellen, Migrationen, RLS, Next.js-Routen oder Browsercode.
- `MOCK_PVS_READ_TOKEN` und `MOCK_PVS_TEST_TOKEN` liegen nur in `.env.mock-pvs.local`; die Beispiel-Datei lässt alle Werte leer. Tokens, `Authorization`-Header und vollständige Antwortkörper dürfen nicht geloggt, in URLs gesetzt oder in Testartefakte geschrieben werden.
- Der Prozess startet fail-closed, wenn Port oder Token fehlen, der Port ungültig ist oder beide Tokens gleich sind.
- `/v1` akzeptiert ausschließlich `GET`; Teststeuerung akzeptiert ausschließlich die beiden dokumentierten `POST`-Routen. Es gibt keine freie Ressourcenerstellung oder sonstige fachliche Schreiboperation.
- Cursor sind opaque, szenariogebunden und nicht aus PVS-Kennungen oder Zeitstempeln ableitbar. Alle regulären Listenantworten verwenden exakt `data` und `nextCursor`.
- `invalid-source-data` ist ausschließlich ein aktiver Testzustand, in dem eine reguläre Datenroute absichtlich eine ungültige Quellressource liefert. Alle übrigen Szenarien erfüllen die normalen Zod-Ausgabeverträge.
- PROJ-2 öffnet weder das Hosting- noch das Real-Data-Gate und markiert keinen Folgepunkt als produktionsreif.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `services/mock-pvs/config.ts` | fail-closed Validierung der lokalen Port- und Token-Konfiguration |
| `services/mock-pvs/config.test.ts` | isolierter Nachweis für gültige und verweigerte Konfiguration |
| `services/mock-pvs/contracts.ts` | Zod-Schemas, exportierte Vertragstypen, Paginierungs- und Szenario-Konstanten |
| `services/mock-pvs/contracts.test.ts` | Nachweis der gültigen und absichtlich ungültigen Ressourcenformen |
| `services/mock-pvs/fixtures.ts` | deterministische Grunddaten und abgeleitete Änderungs-/Fehlerzustände |
| `services/mock-pvs/scenario-state.ts` | szenariogebundener In-Memory-Zustand und opaque Cursor-Registry |
| `services/mock-pvs/scenario-state.test.ts` | stabile Reihenfolge, Cursor, Reset und Szenariowechsel |
| `services/mock-pvs/auth.ts` | Bearer-Auswertung und strikt getrennte Lese-/Testberechtigung |
| `services/mock-pvs/router.ts` | Node-HTTP-Routen, Antwortformen und neutrale Fehlerzuordnung |
| `services/mock-pvs/router.test.ts` | HTTP-Vertrags-, Authentifizierungs-, Pagination- und Fehlertests |
| `services/mock-pvs/server.ts` | Prozessstart, Signalbehandlung und kontrolliertes Beenden |
| `services/mock-pvs/server.smoke.test.ts` | Start eines separaten `tsx`-Prozesses und geschützter Health-Smoketest |
| `.env.mock-pvs.local.example` | nur Variablennamen und lokale Startanleitung |
| `package.json` | `mock-pvs`- und `test:mock-pvs`-Skripte |
| `README.md` | dokumentierter lokaler Start, Test und Secret-Grenze |
| `features/PROJ-2-mock-pvs-service.md` | Status und Abnahmeevidenz erst nach nachgewiesener Implementierung |
| `docs/architecture/overview.md` | tatsächlichen Implementierungsstand nach Abschluss spiegeln |
| `docs/delivery/acceptance-tests.md` | konkrete, ausschließlich synthetische Testevidenz nach Abschluss |

## Task 1: Lokale Konfiguration, Skripte und fail-closed Startgrenze

**Files:**
- Create: `services/mock-pvs/config.ts`
- Create: `services/mock-pvs/config.test.ts`
- Create: `.env.mock-pvs.local.example`
- Modify: `package.json`
- Modify: `features/PROJ-2-mock-pvs-service.md`

**Interfaces:**
- Produces: `MockPvsConfig`, `MockPvsConfigError` und `loadMockPvsConfig(input)` für alle Folgetasks.
- Produces: `npm run mock-pvs` und `npm run test:mock-pvs`.

- [ ] **Step 1: Write the failing configuration tests.**

  Create `services/mock-pvs/config.test.ts` with the Node environment directive and these cases:

  ```ts
  // @vitest-environment node
  import { describe, expect, it } from 'vitest'
  import { MockPvsConfigError, loadMockPvsConfig } from './config'

  const validEnvironment = {
    MOCK_PVS_PORT: '3181',
    MOCK_PVS_READ_TOKEN: 'synthetic-read-token',
    MOCK_PVS_TEST_TOKEN: 'synthetic-test-token',
  }

  describe('loadMockPvsConfig', () => {
    it('returns a typed local configuration', () => {
      expect(loadMockPvsConfig(validEnvironment)).toEqual({
        port: 3181,
        readToken: 'synthetic-read-token',
        testToken: 'synthetic-test-token',
      })
    })

    it.each([
      {},
      { ...validEnvironment, MOCK_PVS_PORT: '0' },
      { ...validEnvironment, MOCK_PVS_PORT: 'not-a-port' },
      { ...validEnvironment, MOCK_PVS_TEST_TOKEN: 'synthetic-read-token' },
    ])('rejects invalid local configuration without echoing values', (environment) => {
      expect(() => loadMockPvsConfig(environment)).toThrow(MockPvsConfigError)
      expect(() => loadMockPvsConfig(environment)).not.toThrow('synthetic-read-token')
    })
  })
  ```

- [ ] **Step 2: Run the focused test and confirm it fails because `./config` is absent.**

  Run: `npx vitest run services/mock-pvs/config.test.ts`
  Expected: FAIL with an unresolved `./config` module.

- [ ] **Step 3: Implement minimal, typed configuration loading.**

  Create `services/mock-pvs/config.ts` with this public interface and no configuration fallback:

  ```ts
  export type MockPvsConfig = {
    port: number
    readToken: string
    testToken: string
  }

  export class MockPvsConfigError extends Error {
    override name = 'MockPvsConfigError'
  }

  export function loadMockPvsConfig(
    input: Record<string, string | undefined> = process.env,
  ): MockPvsConfig {
    const port = Number(input.MOCK_PVS_PORT)
    const readToken = input.MOCK_PVS_READ_TOKEN?.trim()
    const testToken = input.MOCK_PVS_TEST_TOKEN?.trim()

    if (!Number.isInteger(port) || port < 1 || port > 65535 || !readToken || !testToken || readToken === testToken) {
      throw new MockPvsConfigError('Mock-PVS-Konfiguration ist ungültig.')
    }

    return { port, readToken, testToken }
  }
  ```

  Add `.env.mock-pvs.local.example`:

  ```dotenv
  # Local synthetic Mock-PVS only. Copy to .env.mock-pvs.local; never commit values.
  MOCK_PVS_PORT=
  MOCK_PVS_READ_TOKEN=
  MOCK_PVS_TEST_TOKEN=
  ```

  Add these scripts to `package.json`:

  ```json
  "mock-pvs": "tsx --env-file=.env.mock-pvs.local services/mock-pvs/server.ts",
  "test:mock-pvs": "vitest run services/mock-pvs"
  ```

  Change the PROJ-2 feature status from `Planned` to `In Progress`; leave every acceptance criterion unchecked.

- [ ] **Step 4: Run configuration checks.**

  Run: `npx vitest run services/mock-pvs/config.test.ts`
  Expected: PASS.

  Run: `npm run typecheck`
  Expected: PASS. Das npm-Skript wird von TypeScript nicht importiert; `server.ts` entsteht verbindlich in Task 3.

- [ ] **Step 5: Commit the configuration boundary.**

  ```bash
  git add package.json .env.mock-pvs.local.example services/mock-pvs/config.ts services/mock-pvs/config.test.ts features/PROJ-2-mock-pvs-service.md
  git commit -m "feat(mock-pvs): add local service configuration"
  ```

## Task 2: Vertrag, deterministische Fixtures und opaque Cursor

**Files:**
- Create: `services/mock-pvs/contracts.ts`
- Create: `services/mock-pvs/contracts.test.ts`
- Create: `services/mock-pvs/fixtures.ts`
- Create: `services/mock-pvs/scenario-state.ts`
- Create: `services/mock-pvs/scenario-state.test.ts`

**Interfaces:**
- Consumes: `MockPvsConfig` only later; this task stays rein fachlich und ohne HTTP.
- Produces: `Patient`, `Appointment`, `ChangeEvent`, `ScenarioName`, `createScenarioState()` und `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`.
- Produces: `ScenarioState.listPatients`, `listAppointments`, `listChanges`, `activate` und `reset` for Task 3 and Task 4.

- [ ] **Step 1: Write the failing contract and scenario-state tests.**

  Define the required contract tests:

  ```ts
  // @vitest-environment node
  import { describe, expect, it } from 'vitest'
  import { appointmentSchema, patientSchema } from './contracts'
  import { createScenarioState } from './scenario-state'

  describe('Mock-PVS contracts', () => {
    it('accepts a synthetic E.164 patient and a timezone-aware appointment', () => {
      expect(patientSchema.safeParse({
        id: 'mock-patient-001', version: 1, firstName: 'Test1', lastName: 'Patient1',
        birthDate: '1980-01-01', email: 'test1@mock-pvs.invalid', phoneE164: '+999000000001',
        sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
      }).success).toBe(true)
    })

    it('rejects a normal appointment whose end is not after its start', () => {
      expect(appointmentSchema.safeParse({
        id: 'mock-appointment-001', version: 1, patientId: 'mock-patient-001',
        startsAt: '2026-10-02T10:00:00+02:00', endsAt: '2026-10-02T09:30:00+02:00',
        status: 'confirmed', practitionerId: 'mock-practitioner-001',
        sourceCreatedAt: '2026-01-01T00:00:00Z', sourceUpdatedAt: '2026-01-01T00:00:00Z',
      }).success).toBe(false)
    })
  })

  describe('scenario state', () => {
    it('returns 25 stable patients followed by a final page and an opaque cursor', () => {
      const state = createScenarioState()
      const first = state.listPatients({ cursor: null, limit: 25 })
      expect(first.nextCursor).not.toBeNull()
      const second = state.listPatients({ cursor: first.nextCursor!, limit: 25 })
      expect(first.data).toHaveLength(25)
      expect(second.data).toHaveLength(1)
      expect(second.nextCursor).toBeNull()
      expect(first.nextCursor).not.toContain('mock-patient-')
    })

    it('rejects a cursor from another scenario and reset restores baseline', () => {
      const state = createScenarioState()
      state.activate('changes')
      const changesCursor = state.listChanges({ cursor: null, limit: 1 }).nextCursor
      expect(changesCursor).not.toBeNull()
      state.activate('baseline')
      expect(() => state.listChanges({ cursor: changesCursor!, limit: 1 })).toThrow('Ungültiger Cursor.')
      state.reset()
      expect(state.activeScenario()).toBe('baseline')
    })
  })
  ```

- [ ] **Step 2: Run the focused suites and confirm the imports fail.**

  Run: `npx vitest run services/mock-pvs/contracts.test.ts services/mock-pvs/scenario-state.test.ts`
  Expected: FAIL because the contract and scenario modules do not yet exist.

- [ ] **Step 3: Define exact schemas, fixtures and state transitions.**

  In `contracts.ts`, export `patientSchema`, `appointmentSchema`, `changeEventSchema`, `scenarioNameSchema`, the inferred types, `DEFAULT_PAGE_SIZE = 25` and `MAX_PAGE_SIZE = 100`.

  Use `z.string().regex(/^\+[1-9]\d{1,14}$/)` for normal `phoneE164`, `z.string().datetime({ offset: true })` for timestamps, and an appointment `.refine()` requiring `startsAt < endsAt`. Define `email` as `z.string().email().nullable()` so the field is always present.

  In `fixtures.ts`, construct exactly 26 `baseline` patients with IDs `mock-patient-001` through `mock-patient-026`, synthetic `.invalid` e-mail addresses, E.164-shaped `+999` numbers and fixed ISO timestamps. Construct at least five appointments, one for each accepted status, with external IDs `mock-appointment-001` onward and fixed `+02:00` offsets. Build `changes` from baseline with a version-2 patient upsert, a version-2 `rescheduled` appointment upsert, and a strictly later event timestamp. Build `deletions` with a version-2 tombstone. Build `invalid-source-data` with one raw patient `phoneE164: 'not-a-phone-number'` and one raw appointment whose end precedes its start; do not pass this special fixture through the normal output schemas.

  In `scenario-state.ts`, keep the active scenario and no mutable global singleton. Model it as:

  ```ts
  export type Page<T> = { data: readonly T[]; nextCursor: string | null }

  export type ScenarioState = {
    activeScenario(): ScenarioName
    activate(name: ScenarioName): void
    reset(): void
    listPatients(input: { cursor: string | null; limit: number }): Page<Patient>
    listAppointments(input: { patientId: string | null; from: string | null; to: string | null; cursor: string | null; limit: number }): Page<Appointment>
    listChanges(input: { cursor: string | null; limit: number }): Page<ChangeEvent>
  }
  ```

  Create every cursor as a base64url SHA-256 digest of the literal contract version, stream name, active scenario and offset. Build a local map from that digest to its stream, scenario and offset. The map makes cursors opaque and lets the service reject a cursor from the wrong stream or scenario without decoding user-controlled content. Sort patients and appointments by `id`; sort changes by their declared event order. Apply `patientId` exactly, `from` inclusively and `to` exclusively to `startsAt`.

- [ ] **Step 4: Run the domain suites.**

  Run: `npx vitest run services/mock-pvs/contracts.test.ts services/mock-pvs/scenario-state.test.ts`
  Expected: PASS, including two-page patient pagination, all appointment statuses, scenario reset and cross-scenario cursor rejection.

- [ ] **Step 5: Commit the deterministic source model.**

  ```bash
  git add services/mock-pvs/contracts.ts services/mock-pvs/contracts.test.ts services/mock-pvs/fixtures.ts services/mock-pvs/scenario-state.ts services/mock-pvs/scenario-state.test.ts
  git commit -m "feat(mock-pvs): add synthetic source contracts and scenarios"
  ```

## Task 3: Geschützte lesende HTTP-API

**Files:**
- Create: `services/mock-pvs/auth.ts`
- Create: `services/mock-pvs/router.ts`
- Create: `services/mock-pvs/router.test.ts`
- Create: `services/mock-pvs/server.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `MockPvsConfig`, all Task-2 contracts and a `ScenarioState` instance.
- Produces: `createMockPvsServer(config, state?)` returning a Node `http.Server` for HTTP tests and process start.
- Produces: `startMockPvsServer()` in `server.ts` for `npm run mock-pvs`.

- [ ] **Step 1: Write failing HTTP contract tests against an ephemeral port.**

  In `router.test.ts`, use the Node environment, `beforeEach` to construct an isolated state and an `afterEach` to close the `http.Server`. Start on port `0`, derive the actual port from `server.address()`, and use native `fetch`.

  Start the file with this complete test harness; the later cases use only these helpers:

  ```ts
  // @vitest-environment node
  import type { Server } from 'node:http'
  import type { AddressInfo } from 'node:net'
  import { afterEach, beforeEach, describe, expect, it } from 'vitest'
  import type { ChangeEvent, Patient } from './contracts'
  import { loadMockPvsConfig } from './config'
  import { createMockPvsServer } from './router'
  import { createScenarioState } from './scenario-state'

  type Paged<T> = { data: T[]; nextCursor: string | null }
  const readToken = 'test-read-token'
  const testToken = 'test-control-token'
  const config = loadMockPvsConfig({
    MOCK_PVS_PORT: '3181',
    MOCK_PVS_READ_TOKEN: readToken,
    MOCK_PVS_TEST_TOKEN: testToken,
  })
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    server = createMockPvsServer(config, createScenarioState())
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    baseUrl = 'http://127.0.0.1:' + address.port
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  })

  function request(path: string, token?: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', 'Bearer ' + token)
    return fetch(baseUrl + path, { ...init, headers })
  }

  async function json<T>(path: string, token: string): Promise<Paged<T>> {
    const response = await request(path, token)
    expect(response.status).toBe(200)
    return await response.json() as Paged<T>
  }
  ```

  Cover these concrete cases:

  ```ts
  it('returns the protected v1 health envelope', async () => {
    const response = await request('/v1/health', readToken)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { apiVersion: 'v1' } })
  })

  it.each([undefined, 'wrong-token', testToken])('returns one neutral 401 body for non-read tokens', async (token) => {
    const response = await request('/v1/patients', token)
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' })
  })

  it('paginates patients without duplicated IDs and returns a final null cursor', async () => {
    const first = await json<Patient>('/v1/patients?limit=25', readToken)
    expect(first.nextCursor).not.toBeNull()
    const second = await json<Patient>('/v1/patients?limit=25&cursor=' + encodeURIComponent(first.nextCursor!), readToken)
    expect([...first.data, ...second.data].map((patient) => patient.id)).toHaveLength(26)
    expect(second.nextCursor).toBeNull()
  })

  it('returns 422 for invalid pagination and an invalid appointment interval', async () => {
    expect((await request('/v1/patients?limit=101', readToken)).status).toBe(422)
    expect((await request('/v1/appointments?from=2026-10-02T10:00:00%2B02:00&to=2026-10-02T10:00:00%2B02:00', readToken)).status).toBe(422)
  })
  ```

  Also assert: one patient lookup succeeds, an unknown patient returns 404 with `{ error: 'not_found' }`, an unknown path returns the same 404 body, `POST /v1/patients` returns 404, and a valid appointment filter applies `from` inclusive and `to` exclusive.

- [ ] **Step 2: Run the router test and confirm the imports fail.**

  Run: `npx vitest run services/mock-pvs/router.test.ts`
  Expected: FAIL because `auth`, `router` and `server` are absent.

- [ ] **Step 3: Implement auth, routing and process entrypoint.**

  `auth.ts` exports the two explicit scopes and compares only the parsed Bearer value:

  ```ts
  export type AccessScope = 'read' | 'test'

  export function hasAccess(
    authorization: string | undefined,
    expected: AccessScope,
    config: MockPvsConfig,
  ): boolean {
    const token = authorization?.match(/^Bearer ([^\s]+)$/)?.[1]
    return expected === 'read' ? token === config.readToken : token === config.testToken
  }
  ```

  `router.ts` must export this exact factory; it is the only production constructor tests and `server.ts` use:

  ```ts
  export function createMockPvsServer(
    config: MockPvsConfig,
    state: ScenarioState = createScenarioState(),
  ): Server {
    return createServer((request, response) => {
      void routeMockPvsRequest(request, response, config, state)
    })
  }
  ```

  `server.ts` must expose and invoke this entrypoint:

  ```ts
  export function startMockPvsServer(): Server {
    const config = loadMockPvsConfig()
    const server = createMockPvsServer(config)
    const { port } = config
    server.listen(port, () => process.stdout.write('Mock-PVS bereit auf Port ' + port + '.\n'))
    return server
  }

  startMockPvsServer()
  ```

  In `router.ts`, create `http.createServer` and route by `request.method` plus `new URL(request.url ?? '/', baseUrl).pathname`. For every `/v1` route, first require `hasAccess(request.headers.authorization, 'read', config)`, then return a single JSON shape. Implement helpers that set `content-type: application/json; charset=utf-8`, `cache-control: no-store` and never log request data.

  Map errors exactly as follows:

  ```ts
  const errors = {
    unauthorized: { status: 401, body: { error: 'unauthorized' } },
    notFound: { status: 404, body: { error: 'not_found' } },
    invalidRequest: { status: 422, body: { error: 'invalid_request' } },
    internal: { status: 500, body: { error: 'internal_error' } },
  } as const
  ```

  Before route handling, ask scenario state whether `rate-limited` or `temporarily-unavailable` is active. For `/v1/patients`, `/v1/patients/:id`, `/v1/appointments` and `/v1/changes`, return 429 with `retry-after: 1` and `{ error: 'rate_limited' }`, or 503 with `retry-after: 1` and `{ error: 'temporarily_unavailable' }`. Leave `/v1/health` available for diagnosis.

  `server.ts` calls `loadMockPvsConfig()`, creates a state, listens on the configured port and handles `SIGINT`/`SIGTERM` by calling `server.close()` once. It writes only `Mock-PVS bereit auf Port <port>.` to stdout; it never writes a token, header, cursor or fixture data.

  Now add the two `package.json` scripts if they were deferred in Task 1:

  ```json
  "mock-pvs": "tsx --env-file=.env.mock-pvs.local services/mock-pvs/server.ts",
  "test:mock-pvs": "vitest run services/mock-pvs"
  ```

- [ ] **Step 4: Run the focused HTTP and type checks.**

  Run: `npx vitest run services/mock-pvs/router.test.ts`
  Expected: PASS for health, authentication, routes, pagination, filters, 404 and 422.

  Run: `npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit the regular service API.**

  ```bash
  git add package.json services/mock-pvs/auth.ts services/mock-pvs/router.ts services/mock-pvs/router.test.ts services/mock-pvs/server.ts
  git commit -m "feat(mock-pvs): add protected read API"
  ```

## Task 4: Getrennte Teststeuerung, Fehlerszenarien und Prozess-Smoke-Test

**Files:**
- Modify: `services/mock-pvs/router.ts`
- Modify: `services/mock-pvs/router.test.ts`
- Create: `services/mock-pvs/server.smoke.test.ts`

**Interfaces:**
- Consumes: Task-2 `ScenarioState`, Task-3 `createMockPvsServer` and `npm run mock-pvs`.
- Produces: only `POST /__test/scenarios/:name` and `POST /__test/reset` for local tests; no new regular API.

- [ ] **Step 1: Write failing scenario and process tests.**

  Extend `router.test.ts` with these concrete cases:

  ```ts
  it('keeps test control separate from regular reads', async () => {
    expect((await request('/__test/scenarios/changes', readToken, { method: 'POST' })).status).toBe(401)
    expect((await request('/v1/changes', testToken)).status).toBe(401)
  })

  it('activates a fixed change scenario and resets to baseline', async () => {
    expect((await request('/__test/scenarios/changes', testToken, { method: 'POST' })).status).toBe(204)
    const changes = await json<ChangeEvent>('/v1/changes?limit=100', readToken)
    expect(changes.data.some((event) => event.operation === 'upsert' && event.version === 2)).toBe(true)
    expect((await request('/__test/reset', testToken, { method: 'POST' })).status).toBe(204)
  })

  it.each([
    ['rate-limited', 429],
    ['temporarily-unavailable', 503],
  ])('returns retry-after for %s', async (scenario, expectedStatus) => {
    await request('/__test/scenarios/' + scenario, testToken, { method: 'POST' })
    const response = await request('/v1/patients', readToken)
    expect(response.status).toBe(expectedStatus)
    expect(response.headers.get('retry-after')).toBe('1')
  })

  it('serves deliberately malformed source data only in the declared test scenario', async () => {
    await request('/__test/scenarios/invalid-source-data', testToken, { method: 'POST' })
    const body = await json<{ phoneE164: string }>('/v1/patients?limit=100', readToken)
    expect(body.data.some((patient) => patient.phoneE164 === 'not-a-phone-number')).toBe(true)
  })
  ```

  In `server.smoke.test.ts`, spawn `node_modules/tsx/dist/cli.mjs` with temporary synthetic environment values and a free local port. Poll `/v1/health` with the read token until 200, assert `{ data: { apiVersion: 'v1' } }`, then always terminate the child in `finally`. Capture stdout/stderr only for process completion diagnostics and assert that neither captured string contains either injected token.

- [ ] **Step 2: Run the scenario tests and confirm missing `/__test` behavior.**

  Run: `npx vitest run services/mock-pvs/router.test.ts services/mock-pvs/server.smoke.test.ts`
  Expected: FAIL because test-control routes and/or smoke startup behavior have not yet been implemented.

- [ ] **Step 3: Implement only fixed test-control routes.**

  Add these paths before the generic 404 route:

  ```ts
  if (request.method === 'POST' && pathname === '/__test/reset') {
    requireTestAccess(request, config)
    state.reset()
    response.writeHead(204).end()
    return
  }

  const scenarioMatch = pathname.match(/^\/__test\/scenarios\/(baseline|changes|deletions|invalid-source-data|rate-limited|temporarily-unavailable)$/)
  if (request.method === 'POST' && scenarioMatch) {
    requireTestAccess(request, config)
    state.activate(scenarioMatch[1] as ScenarioName)
    response.writeHead(204).end()
    return
  }
  ```

  Before each Testroute, call `hasAccess(request.headers.authorization, 'test', config)`. Bei `false` schreibe exakt `{ error: 'unauthorized' }` mit HTTP 401 und beende die Route. Any other `/__test` method or path returns the normal 404 body. Do not parse a request body and do not add CORS headers.

  In the router, return raw invalid fixture objects only while `invalid-source-data` is active. For valid scenarios, run fixture output through the normal resource schemas before serializing; if a valid scenario violates a schema, respond with the neutral 500 body.

- [ ] **Step 4: Run the complete Mock-PVS suite.**

  Run: `npm run test:mock-pvs`
  Expected: PASS for configuration, contracts, scenario state, router integration and separate-process smoke tests.

  Run: `npm run lint && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit resilience and test control.**

  ```bash
  git add services/mock-pvs/router.ts services/mock-pvs/router.test.ts services/mock-pvs/server.smoke.test.ts
  git commit -m "test(mock-pvs): cover scenarios and process startup"
  ```

## Task 5: Betriebsdokumentation, Abnahmeevidenz und Gesamtverifikation

**Files:**
- Modify: `README.md`
- Modify: `features/PROJ-2-mock-pvs-service.md`
- Modify: `docs/architecture/overview.md`
- Modify: `docs/delivery/acceptance-tests.md`
- Modify: `docs/delivery/known-issues.md` only if a newly discovered, unresolved implementation risk exists

**Interfaces:**
- Consumes: actual commands and test counts from Tasks 1–4.
- Produces: evidence-backed local `In Review` status; never an Approved, Hosted or Real-Data-Gate claim.

- [ ] **Step 1: Write the documentation assertions before editing the documents.**

  Add tests or command-level checks only for executable behavior; documentation itself is verified by requiring these exact facts after the final runs:

  ```text
  - Start requires .env.mock-pvs.local and npm run mock-pvs.
  - The service is local and synthetic; browser code never receives either token.
  - npm run test:mock-pvs starts no Supabase service and performs no migration.
  - Feature status is In Review only after actual tests pass.
  ```

- [ ] **Step 2: Run the final verification before recording evidence.**

  Run: `npm run test:mock-pvs`
  Expected: PASS.

  Run: `npm run verify`
  Expected: PASS for lint, typecheck, all Vitest suites including `services/mock-pvs`, and the production build.

  Run: `npm run verify:full`
  Expected: PASS for the preceding checks, local pgTAP and the current Edge-required browser suite. Use only the existing synthetic Supabase stack and test accounts. If prior E2E audit residue makes pgTAP red, reset and reseed the local synthetic stack only with the already-authorized local reset procedure, then rerun the complete command.

- [ ] **Step 3: Record only executed evidence.**

  In `README.md`, add a local Mock-PVS section with these commands and no token values:

  ```bash
  Copy-Item .env.mock-pvs.local.example .env.mock-pvs.local
  npm run mock-pvs
  npm run test:mock-pvs
  ```

  In the feature spec, tick only acceptance criteria demonstrated by the actual final results. Add a dated evidence paragraph with actual test counts and commands. Change the feature status from `In Progress` to `In Review` only when all local criteria are proven. Keep the statements that the service is local, synthetic, unhosted and not a Real-Data-Gate proof.

  In `docs/architecture/overview.md`, replace “Vertrag spezifiziert, nicht implementiert” with an evidence-backed local service status. Add the same actual counts to `docs/delivery/acceptance-tests.md`. Update `docs/delivery/known-issues.md` only if verification identifies a concrete residual risk; do not create a hypothetical warning.

- [ ] **Step 4: Review the final diff and verify the security boundary.**

  Run: `git diff --check HEAD`
  Expected: no whitespace errors.

  Run: `rg -n "MOCK_PVS_(READ|TEST)_TOKEN|Authorization" --glob '!*.example' --glob '!docs/**' --glob '!services/mock-pvs/*.test.ts'`
  Expected: only source-level configuration key references and header parsing; no token values, generated reports or browser-facing variables.

  Review that no file under `src/app/`, `src/components/`, `supabase/migrations/` or `supabase/tests/` changed for PROJ-2.

- [ ] **Step 5: Commit documented evidence and request independent review.**

  ```bash
  git add README.md features/PROJ-2-mock-pvs-service.md docs/architecture/overview.md docs/delivery/acceptance-tests.md docs/delivery/known-issues.md
  git commit -m "docs(mock-pvs): record local verification evidence"
  ```

  Request a security/code review of the complete PROJ-2 range before changing the feature from `In Review` to `Approved`. Hosted deployment, real PVS access, production monitoring and the Real-Data-Gate remain outside this plan.

## Spec Coverage Review

| Spezifikationspunkt | Plan-Task |
|---|---|
| separater lokaler TypeScript-HTTP-Prozess ohne Supabase oder Next.js-Route | 1, 3 |
| getrennte Bearer-Token, fail-closed Konfiguration und keine Secret-Leaks | 1, 3, 5 |
| Patienten- und Terminvertrag einschließlich E.164, E-Mail und Statuswerten | 2 |
| stabile Pagination, opaque Cursor, Filter und Änderungsstrom | 2, 3 |
| feste Szenarien, Tombstones, ungültige Quelle, 429 und 503 | 2, 4 |
| neutrale HTTP-Fehler, keine freien Schreiboperationen und keine Logs | 3, 4 |
| Unit-, HTTP-, Prozess- und vollständige Repository-Verifikation | 1–5 |
| aktuelle Spezifikation, Architektur- und Abnahmedokumentation | 1, 5 |
| Hosting- und Real-Data-Gate geschlossen | Global Constraints, 5 |
