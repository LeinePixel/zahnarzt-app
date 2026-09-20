import { z } from 'zod'

export type MockPvsConfig = {
  port: number
  readToken: string
  testToken: string
}

export class MockPvsConfigError extends Error {
  override name = 'MockPvsConfigError'
}

const mockPvsConfigSchema = z
  .object({
    MOCK_PVS_PORT: z.coerce.number().int().min(1).max(65535),
    MOCK_PVS_READ_TOKEN: z.string().trim().min(1),
    MOCK_PVS_TEST_TOKEN: z.string().trim().min(1),
  })
  .refine(
    ({ MOCK_PVS_READ_TOKEN: readToken, MOCK_PVS_TEST_TOKEN: testToken }) => readToken !== testToken,
  )

export function loadMockPvsConfig(
  input: Record<string, string | undefined> = process.env,
): MockPvsConfig {
  const result = mockPvsConfigSchema.safeParse(input)

  if (!result.success) {
    throw new MockPvsConfigError('Mock-PVS-Konfiguration ist ungültig.')
  }

  return {
    port: result.data.MOCK_PVS_PORT,
    readToken: result.data.MOCK_PVS_READ_TOKEN,
    testToken: result.data.MOCK_PVS_TEST_TOKEN,
  }
}
