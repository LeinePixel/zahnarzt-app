import { pathToFileURL } from 'node:url'
import type { IntegrationAdapter } from '@/features/integrations/adapter'
import { MockPvsAdapter } from '@/features/integrations/mock-pvs-adapter'
import { loadAppointmentSyncConfig } from '@/features/appointments/sync-config'
import { PostgresAppointmentSyncRepository } from '@/features/appointments/postgres-sync-repository'
import type { AppointmentSyncRepository, AppointmentSyncResult } from '@/features/appointments/sync-repository'
import { runAppointmentSync } from '@/features/appointments/sync-appointments'

type CliDependencies = {
  environment?: Record<string, string | undefined>
  log?: (line: string) => void
  createRepository?: (databaseUrl: string) => AppointmentSyncRepository
  createAdapter?: (
    config: ReturnType<typeof loadAppointmentSyncConfig>['mockPvs'],
    deadline: AbortSignal,
  ) => IntegrationAdapter
}

export function messageFor(result: AppointmentSyncResult): {
  text: string
  exitCode: 0 | 1 | 2
} {
  if (result.ok) return { text: 'Terminsync abgeschlossen.', exitCode: 0 }
  if (result.code === 'sync_busy' || result.code === 'retry_not_due') {
    return { text: 'Terminsync derzeit nicht möglich.', exitCode: 2 }
  }
  return { text: 'Terminsync fehlgeschlagen.', exitCode: 1 }
}

export async function runCli(dependencies: CliDependencies = {}): Promise<0 | 1 | 2> {
  const log = dependencies.log ?? console.log
  let output: ReturnType<typeof messageFor> = { text: 'Terminsync fehlgeschlagen.', exitCode: 1 }
  try {
    const config = loadAppointmentSyncConfig(dependencies.environment ?? process.env)
    const deadline = AbortSignal.timeout(60_000)
    const repository = (dependencies.createRepository
      ?? (url => new PostgresAppointmentSyncRepository(url)))(config.databaseUrl)
    const adapter = (dependencies.createAdapter ?? ((mockPvs, signal) =>
      new MockPvsAdapter(mockPvs, {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]),
        }),
      })))(config.mockPvs, deadline)
    output = messageFor(await runAppointmentSync(adapter, repository, { signal: deadline }))
  } catch { /* neutral CLI boundary */ }
  log(output.text)
  return output.exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli().then(code => { process.exitCode = code })
}
