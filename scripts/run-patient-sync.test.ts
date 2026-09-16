// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { runCli } from './run-patient-sync'

it('rejects invalid configuration before constructing runtime dependencies', async () => {
  const lines: string[] = []
  const createRepository = vi.fn()
  const createAdapter = vi.fn()
  expect(await runCli({ environment: {}, log: line => lines.push(line), createRepository, createAdapter })).toBe(1)
  expect(lines).toEqual(['Patientensync konnte nicht abgeschlossen werden.'])
  expect(createRepository).not.toHaveBeenCalled()
  expect(createAdapter).not.toHaveBeenCalled()
})
