import { pathToFileURL } from 'node:url'
import { MockPvsAdapter } from '@/features/integrations/mock-pvs-adapter'
import type { IntegrationAdapter } from '@/features/integrations/adapter'
import { loadPatientSyncConfig } from '@/features/patients/sync-config'
import { PostgresPatientSyncRepository } from '@/features/patients/postgres-sync-repository'
import type { PatientSyncRepository } from '@/features/patients/sync-repository'
import { runPatientSync } from '@/features/patients/sync-patients'

type CliDependencies = {
  environment?: Record<string, string | undefined>
  log?: (line: string) => void
  createRepository?: (databaseUrl: string) => PatientSyncRepository
  createAdapter?: (config: ReturnType<typeof loadPatientSyncConfig>['mockPvs'], deadline: AbortSignal) => IntegrationAdapter
}

export async function runCli(dependencies: CliDependencies = {}): Promise<0 | 1 | 2> {
  const log = dependencies.log ?? console.log
  try {
    const config = loadPatientSyncConfig(dependencies.environment ?? process.env)
    const deadline = AbortSignal.timeout(60_000)
    const repository = (dependencies.createRepository ?? (url => new PostgresPatientSyncRepository(url)))(config.databaseUrl)
    const adapter = (dependencies.createAdapter ?? ((mockPvs, signal) => new MockPvsAdapter(mockPvs, {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) }),
    })))(config.mockPvs, deadline)
    const result = await runPatientSync(adapter, repository, { signal: deadline })
    if (result.ok) { log('Patientensync abgeschlossen.'); return 0 }
    if (result.code === 'sync_busy' || result.code === 'retry_not_due') {
      log('Patientensync ist bereits aktiv oder noch nicht fällig.'); return 2
    }
  } catch { /* neutral CLI boundary */ }
  log('Patientensync konnte nicht abgeschlossen werden.')
  return 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli().then(code => { process.exitCode = code })
}
