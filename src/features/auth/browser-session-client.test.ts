import { describe, expect, it, vi } from 'vitest'

import {
  createBrowserTotpClient,
  establishSessionState,
  touchSessionState,
} from './browser-session-client'

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient }))

describe('browser session client', () => {
  it('maps provider failures to a neutral MFA result', async () => {
    const challengeAndVerify = vi.fn().mockResolvedValue({ data: null, error: {} })
    createClient.mockReturnValue({
      auth: { mfa: { challengeAndVerify } },
    })

    const result = await createBrowserTotpClient().challengeAndVerify({
      factorId: 'synthetic-factor',
      code: '123456',
    })

    expect(result).toEqual({ ok: false })
  })

  it('returns false when the session-state RPC is rejected', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: {} })
    createClient.mockReturnValue({ rpc })

    await expect(establishSessionState()).resolves.toBe(false)
    await expect(touchSessionState()).resolves.toBe(false)
    expect(rpc).toHaveBeenNthCalledWith(1, 'establish_session_state')
    expect(rpc).toHaveBeenNthCalledWith(2, 'touch_session_state')
  })
})
