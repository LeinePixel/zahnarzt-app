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
