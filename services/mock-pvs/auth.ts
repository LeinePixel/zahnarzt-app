import { timingSafeEqual } from 'node:crypto'
import type { MockPvsConfig } from './config'

export type AccessScope = 'read' | 'test'

export function hasAccess(authorization: string | undefined, expected: AccessScope, config: MockPvsConfig): boolean {
  const token = authorization?.match(/^Bearer ([^\s]+)$/)?.[1]
  if (!token) return false
  const actual = Buffer.from(token)
  const required = Buffer.from(expected === 'read' ? config.readToken : config.testToken)
  return actual.length === required.length && timingSafeEqual(actual, required)
}
