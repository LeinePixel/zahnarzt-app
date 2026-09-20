// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { messageFor, runCli } from './run-appointment-sync'

it('maps results to constant neutral German output and exit codes', () => {
  expect(messageFor({ ok: true })).toEqual({ text: 'Terminsync abgeschlossen.', exitCode: 0 })
  expect(messageFor({ ok: false, code: 'sync_busy' }))
    .toEqual({ text: 'Terminsync derzeit nicht möglich.', exitCode: 2 })
  expect(messageFor({ ok: false, code: 'retry_not_due' }))
    .toEqual({ text: 'Terminsync derzeit nicht möglich.', exitCode: 2 })
  expect(messageFor({ ok: false, code: 'source_contract_invalid' }))
    .toEqual({ text: 'Terminsync fehlgeschlagen.', exitCode: 1 })
})

it('rejects invalid configuration before constructing runtime dependencies', async () => {
  const lines: string[] = []
  const createRepository = vi.fn()
  const createAdapter = vi.fn()
  expect(await runCli({
    environment: {}, log: line => lines.push(line), createRepository, createAdapter,
  })).toBe(1)
  expect(lines).toEqual(['Terminsync fehlgeschlagen.'])
  expect(createRepository).not.toHaveBeenCalled()
  expect(createAdapter).not.toHaveBeenCalled()
})
