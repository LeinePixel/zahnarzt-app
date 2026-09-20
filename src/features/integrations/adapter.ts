import type { SourceAppointment, SourceChangeEvent, SourcePatient } from './contracts'
export type { SourceAppointment, SourceChangeEvent, SourcePatient } from './contracts'

export type IntegrationFailureCode = 'configuration_invalid' | 'network_unavailable' | 'rate_limited' | 'temporarily_unavailable' | 'source_protocol_invalid' | 'source_contract_invalid'
export type AdapterResult<T> = { ok: true; value: T } | { ok: false; error: { code: IntegrationFailureCode; retryAt: Date | null } }
export type Page<T> = { data: T[]; nextCursor: string | null }
export type PageInput = { cursor?: string; limit?: number }
export type AppointmentInput = PageInput & { patientId?: string; from?: string; to?: string }
export interface IntegrationAdapter {
  checkHealth(): Promise<AdapterResult<void>>
  listPatients(input: PageInput): Promise<AdapterResult<Page<SourcePatient>>>
  listAppointments(input: AppointmentInput): Promise<AdapterResult<Page<SourceAppointment>>>
  listChanges(input: PageInput): Promise<AdapterResult<Page<SourceChangeEvent>>>
}
