import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { z } from 'zod'
import { hasAccess } from './auth'
import type { MockPvsConfig } from './config'
import { appointmentSchema, changeEventSchema, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, patientSchema, timestampSchema } from './contracts'
import { createScenarioState, InvalidCursorError, type ScenarioState } from './scenario-state'

const errors = {
  unauthorized: { status: 401, body: { error: 'unauthorized' } },
  notFound: { status: 404, body: { error: 'not_found' } },
  invalidRequest: { status: 422, body: { error: 'invalid_request' } },
  internal: { status: 500, body: { error: 'internal_error' } },
} as const
const paginationFields = {
  cursor: z.string().max(128).nullable().default(null),
  limit: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(MAX_PAGE_SIZE)).optional().transform(value => value ?? DEFAULT_PAGE_SIZE),
}
const paginationSchema = z.strictObject(paginationFields)
const appointmentQuerySchema = z.strictObject({
  ...paginationFields,
  patientId: z.string().min(1).max(100).nullable().default(null),
  from: timestampSchema.nullable().default(null),
  to: timestampSchema.nullable().default(null),
}).refine(q => q.from === null || q.to === null || Date.parse(q.from) < Date.parse(q.to))

class InvalidRequestError extends Error {}
function queryValues(search: URLSearchParams) {
  const values: Record<string, string> = Object.create(null)
  for (const [key, value] of search) {
    if (Object.hasOwn(values, key)) throw new InvalidRequestError()
    values[key] = value
  }
  return values
}
function parseQuery<T>(schema: z.ZodType<T>, search: URLSearchParams): T {
  const parsed = schema.safeParse(queryValues(search))
  if (!parsed.success) throw new InvalidRequestError()
  return parsed.data
}
function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}
function sendError(response: ServerResponse, key: keyof typeof errors) {
  const error = errors[key]
  send(response, error.status, error.body)
}

function routeMockPvsRequest(request: IncomingMessage, response: ServerResponse, config: MockPvsConfig, state: ScenarioState) {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const pathname = url.pathname
    if (pathname === '/v1' || pathname.startsWith('/v1/')) {
      if (!hasAccess(request.headers.authorization, 'read', config)) return sendError(response, 'unauthorized')
      if (request.method !== 'GET') return sendError(response, 'notFound')
      if (pathname === '/v1/health') {
        parseQuery(z.strictObject({}), url.searchParams)
        return send(response, 200, { data: { apiVersion: 'v1' } })
      }
      if (pathname === '/v1/patients') {
        const page = state.listPatients(parseQuery(paginationSchema, url.searchParams))
        return send(response, 200, { data: page.data.map(p => patientSchema.parse(p)), nextCursor: page.nextCursor })
      }
      const patientMatch = pathname.match(/^\/v1\/patients\/([^/]+)$/)
      if (patientMatch) {
        parseQuery(z.strictObject({}), url.searchParams)
        const patient = state.listPatients({ cursor: null, limit: MAX_PAGE_SIZE }).data.find(p => p.id === patientMatch[1])
        return patient ? send(response, 200, { data: patientSchema.parse(patient) }) : sendError(response, 'notFound')
      }
      if (pathname === '/v1/appointments') {
        const page = state.listAppointments(parseQuery(appointmentQuerySchema, url.searchParams))
        return send(response, 200, { data: page.data.map(a => appointmentSchema.parse(a)), nextCursor: page.nextCursor })
      }
      if (pathname === '/v1/changes') {
        const page = state.listChanges(parseQuery(paginationSchema, url.searchParams))
        return send(response, 200, { data: page.data.map(e => changeEventSchema.parse(e)), nextCursor: page.nextCursor })
      }
    }
    sendError(response, 'notFound')
  } catch (error) {
    sendError(response, error instanceof InvalidRequestError || error instanceof InvalidCursorError ? 'invalidRequest' : 'internal')
  }
}

export function createMockPvsServer(config: MockPvsConfig, state: ScenarioState = createScenarioState()): Server {
  return createServer((request, response) => { routeMockPvsRequest(request, response, config, state) })
}
