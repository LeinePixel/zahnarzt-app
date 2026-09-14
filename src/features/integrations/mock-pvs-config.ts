import 'server-only'

export type MockPvsConfig = { baseUrl: URL; readToken: string }
export class MockPvsConfigError extends Error {
  override name = 'MockPvsConfigError'
}
export function loadMockPvsConfig(environment: Record<string, string | undefined> = process.env): MockPvsConfig {
  try {
    const baseUrl = new URL(environment.MOCK_PVS_BASE_URL ?? '')
    const readToken = environment.MOCK_PVS_READ_TOKEN?.trim()
    if (baseUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(baseUrl.hostname) || !baseUrl.port || baseUrl.username || baseUrl.password || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash || !readToken || /[\r\n]/.test(readToken)) throw new Error()
    return { baseUrl: new URL(baseUrl.origin), readToken }
  } catch {
    throw new MockPvsConfigError('Mock-PVS-Integration ist ungültig.')
  }
}
