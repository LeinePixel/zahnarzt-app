import 'server-only'
import { z } from 'zod'
import type { AdapterResult, AppointmentInput, IntegrationAdapter, IntegrationFailureCode, PageInput } from './adapter'
import { appointmentPageSchema, changePageSchema, healthSchema, patientPageSchema, timestampSchema } from './contracts'
import { validateMockPvsConfig, type MockPvsConfig } from './mock-pvs-config'

const pageInputSchema = z.strictObject({ cursor: z.string().max(128).optional(), limit: z.number().int().min(1).max(100).optional() })
const appointmentInputSchema = pageInputSchema.extend({ patientId: z.string().min(1).max(100).optional(), from: timestampSchema.optional(), to: timestampSchema.optional() }).refine(input => !input.from || !input.to || Date.parse(input.from) < Date.parse(input.to))
const MAX_BODY_BYTES = 1_048_576
class ProtocolError extends Error {}
class TransportError extends Error {}
function failure(code: IntegrationFailureCode, retryAt: Date | null = null): AdapterResult<never> { return { ok: false, error: { code, retryAt } } }

export class MockPvsAdapter implements IntegrationAdapter {
  private readonly config: MockPvsConfig | null
  constructor(config: MockPvsConfig, private readonly dependencies: { fetch?: typeof fetch; now?: () => Date } = {}) {
    try { this.config = validateMockPvsConfig(config.baseUrl.href, config.readToken) } catch { this.config = null }
  }
  async checkHealth(): Promise<AdapterResult<void>> {
    const result = await this.get('/v1/health', {}, healthSchema)
    return result.ok ? { ok: true, value: undefined } : result
  }
  listPatients(input: PageInput) { return this.page('/v1/patients', input, pageInputSchema, patientPageSchema) }
  listAppointments(input: AppointmentInput) { return this.page('/v1/appointments', input, appointmentInputSchema, appointmentPageSchema) }
  listChanges(input: PageInput) { return this.page('/v1/changes', input, pageInputSchema, changePageSchema) }
  private async page<T>(path: '/v1/patients' | '/v1/appointments' | '/v1/changes', input: PageInput | AppointmentInput, inputSchema: z.ZodType, responseSchema: z.ZodType<T>): Promise<AdapterResult<T>> {
    if (!inputSchema.safeParse(input).success) return failure('configuration_invalid')
    return this.get(path, input, responseSchema)
  }
  private async get<T>(path: '/v1/health' | '/v1/patients' | '/v1/appointments' | '/v1/changes', input: PageInput | AppointmentInput, schema: z.ZodType<T>): Promise<AdapterResult<T>> {
    if (!this.config) return failure('configuration_invalid')
    const url = new URL(path, this.config.baseUrl)
    for (const [key, value] of Object.entries(input)) if (value !== undefined) url.searchParams.set(key, String(value))
    let response: Response
    try {
      response = await (this.dependencies.fetch ?? fetch)(url, { headers: { Authorization: 'Bearer ' + this.config.readToken }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(3000) })
    } catch (error) {
      // Node fetch reports a refused redirect through its cause, without exposing it.
      const redirect = error instanceof Error && error.cause instanceof Error && error.cause.message === 'unexpected redirect'
      return failure(redirect ? 'source_protocol_invalid' : 'network_unavailable')
    }
    try {
      if (response.status === 429 || response.status === 503) {
        const header = response.headers.get('retry-after') ?? ''
        const seconds = /^\d+$/.test(header) && Number(header) >= 1 && Number(header) <= 300 ? Number(header) : 60
        await response.body?.cancel()
        return failure(response.status === 429 ? 'rate_limited' : 'temporarily_unavailable', new Date((this.dependencies.now?.() ?? new Date()).getTime() + seconds * 1000))
      }
      if (response.status !== 200 || response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || Number(response.headers.get('content-length')) > MAX_BODY_BYTES) {
        await response.body?.cancel()
        return failure('source_protocol_invalid')
      }
      if (!response.body) return failure('source_protocol_invalid')
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const chunk = await reader.read().catch(() => { throw new TransportError() })
          if (chunk.done) break
          size += chunk.value.byteLength
          if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new ProtocolError() }
          chunks.push(chunk.value)
        }
      } finally { reader.releaseLock() }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      const parsed = schema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
      return parsed.success ? { ok: true, value: parsed.data } : failure('source_contract_invalid')
    } catch (error) {
      return failure(error instanceof TransportError || (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) ? 'network_unavailable' : 'source_protocol_invalid')
    }
  }
}
