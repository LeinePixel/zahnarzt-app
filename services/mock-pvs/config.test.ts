// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { MockPvsConfigError, loadMockPvsConfig } from './config'

const validEnvironment = {
  MOCK_PVS_PORT: '3181',
  MOCK_PVS_READ_TOKEN: randomBytes(32).toString('hex'),
  MOCK_PVS_TEST_TOKEN: randomBytes(32).toString('hex'),
}

describe('loadMockPvsConfig', () => {
  it('returns typed configuration without exposing credentials in assertions', () => {
    const config = loadMockPvsConfig(validEnvironment)
    expect(config.port).toBe(3181)
    expect(config.readToken === validEnvironment.MOCK_PVS_READ_TOKEN).toBe(true)
    expect(config.testToken === validEnvironment.MOCK_PVS_TEST_TOKEN).toBe(true)
  })

  it.each([
    {},
    ...['', '0', '-1', '65536', '1.5', 'not-a-port'].map(MOCK_PVS_PORT => ({ ...validEnvironment, MOCK_PVS_PORT })),
    { ...validEnvironment, MOCK_PVS_READ_TOKEN: '' },
    { ...validEnvironment, MOCK_PVS_TEST_TOKEN: '   ' },
    { ...validEnvironment, MOCK_PVS_TEST_TOKEN: validEnvironment.MOCK_PVS_READ_TOKEN },
  ])('rejects invalid configuration with a neutral error (case %#)', environment => {
    let failure: unknown
    try { loadMockPvsConfig(environment) } catch (error) { failure = error }
    expect(failure instanceof MockPvsConfigError).toBe(true)
    expect(failure instanceof Error && failure.message === 'Mock-PVS-Konfiguration ist ungültig.').toBe(true)
  })
})
