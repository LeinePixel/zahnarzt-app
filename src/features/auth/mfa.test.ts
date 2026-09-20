import { describe, expect, it, vi } from 'vitest'

import { prepareTotp, verifyTotp } from './mfa'

describe('prepareTotp', () => {
  it('uses an existing verified TOTP factor without exposing a secret', async () => {
    const enroll = vi.fn()
    await expect(prepareTotp({
      listFactors: async () => ({ data: { totp: [{ id: 'factor-1', status: 'verified' }] }, error: null }),
      enroll,
    })).resolves.toEqual({ factorId: 'factor-1', qrCode: null })
    expect(enroll).not.toHaveBeenCalled()
  })

  it('enrolls one TOTP factor when none exists', async () => {
    await expect(prepareTotp({
      listFactors: async () => ({ data: { totp: [] }, error: null }),
      enroll: async () => ({ data: { id: 'factor-2', totp: { qr_code: 'data:image/svg+xml,test' } }, error: null }),
    })).resolves.toEqual({ factorId: 'factor-2', qrCode: 'data:image/svg+xml,test' })
  })

  it('returns a neutral failure for provider errors', async () => {
    await expect(prepareTotp({
      listFactors: async () => ({ data: null, error: new Error('provider detail') }),
      enroll: vi.fn(),
    })).rejects.toThrow('MFA konnte nicht vorbereitet werden.')
  })
})

describe('verifyTotp', () => {
  it('challenges and verifies without returning provider details', async () => {
    const verify = vi.fn(async () => ({ data: {}, error: null }))
    await expect(verifyTotp({
      challenge: async () => ({ data: { id: 'challenge-1' }, error: null }),
      verify,
    }, 'factor-1', '123456')).resolves.toBe(true)
    expect(verify).toHaveBeenCalledWith({ factorId: 'factor-1', challengeId: 'challenge-1', code: '123456' })
  })

  it('rejects malformed codes before calling the provider', async () => {
    const challenge = vi.fn()
    await expect(verifyTotp({ challenge, verify: vi.fn() }, 'factor-1', '12ab')).resolves.toBe(false)
    expect(challenge).not.toHaveBeenCalled()
  })
})
