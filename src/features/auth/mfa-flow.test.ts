import { describe, expect, it, vi } from 'vitest'

import {
  completeTotpChallenge,
  prepareTotpChallenge,
  type TotpClient,
} from './mfa-flow'

function client(overrides: Partial<TotpClient> = {}): TotpClient {
  return {
    challengeAndVerify: vi.fn().mockResolvedValue({ ok: true }),
    enroll: vi.fn().mockResolvedValue({
      factorId: 'synthetic-factor',
      qrCode: 'data:image/svg+xml;base64,synthetic',
    }),
    listFactors: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe('prepareTotpChallenge', () => {
  it('begins in-memory enrollment when no verified TOTP factor exists', async () => {
    const mfaClient = client()

    const result = await prepareTotpChallenge(mfaClient)

    expect(result).toEqual({
      factorId: 'synthetic-factor',
      mode: 'enroll',
      qrCode: 'data:image/svg+xml;base64,synthetic',
    })
    expect(mfaClient.enroll).toHaveBeenCalledWith()
  })

  it('uses an existing verified factor without enrolling a replacement', async () => {
    const mfaClient = client({
      listFactors: vi.fn().mockResolvedValue([
        { id: 'verified-factor', status: 'verified' },
      ]),
    })

    const result = await prepareTotpChallenge(mfaClient)

    expect(result).toEqual({ factorId: 'verified-factor', mode: 'verify' })
    expect(mfaClient.enroll).not.toHaveBeenCalled()
  })

  it('does not enroll a factor from the reauthentication path', async () => {
    const mfaClient = client()

    const result = await prepareTotpChallenge(mfaClient, {
      allowEnrollment: false,
    })

    expect(result).toEqual({ mode: 'unavailable' })
    expect(mfaClient.enroll).not.toHaveBeenCalled()
  })

  it('does not enroll another factor after an interrupted enrollment', async () => {
    const mfaClient = client({
      listFactors: vi.fn().mockResolvedValue([
        { id: 'unverified-factor', status: 'unverified' },
      ]),
    })

    const result = await prepareTotpChallenge(mfaClient)

    expect(result).toEqual({ mode: 'unavailable' })
    expect(mfaClient.enroll).not.toHaveBeenCalled()
  })
})

describe('completeTotpChallenge', () => {
  it('does not send malformed codes or establish a session', async () => {
    const mfaClient = client()
    const establish = vi.fn().mockResolvedValue(true)

    const result = await completeTotpChallenge(
      { factorId: 'synthetic-factor', verificationCode: '12345' },
      mfaClient,
      establish,
    )

    expect(result).toEqual({ status: 'invalid' })
    expect(mfaClient.challengeAndVerify).not.toHaveBeenCalled()
    expect(establish).not.toHaveBeenCalled()
  })

  it('keeps a rejected provider result neutral and does not establish state', async () => {
    const mfaClient = client({
      challengeAndVerify: vi.fn().mockResolvedValue({ ok: false }),
    })
    const establish = vi.fn().mockResolvedValue(true)

    const result = await completeTotpChallenge(
      { factorId: 'synthetic-factor', verificationCode: '123456' },
      mfaClient,
      establish,
    )

    expect(result).toEqual({ status: 'invalid' })
    expect(establish).not.toHaveBeenCalled()
  })

  it('establishes server state only after a valid TOTP result', async () => {
    const mfaClient = client()
    const establish = vi.fn().mockResolvedValue(true)

    const result = await completeTotpChallenge(
      { factorId: 'synthetic-factor', verificationCode: '123456' },
      mfaClient,
      establish,
    )

    expect(result).toEqual({ status: 'ready' })
    expect(establish).toHaveBeenCalledOnce()
  })
})
