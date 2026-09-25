import { act, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SessionLock } from './session-lock'

const rpc = vi.fn(async (name: string) => ({
  data: name === 'current_session_remaining_ms' ? 240_000 : true,
  error: null,
}))
const signOut = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc, auth: { signOut } }),
}))

class TestBroadcastChannel {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  postMessage() {}
  close() {}
}

describe('SessionLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    rpc.mockClear()
    signOut.mockClear()
  })

  it('loads the server deadline without reporting a human interaction', async () => {
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const mounted = render(<SessionLock />)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('current_session_remaining_ms'))
    expect(rpc).not.toHaveBeenCalledWith('record_current_session_activity')

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown')))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('record_current_session_activity'))
    mounted.unmount()
  })

  it('ignores changes to the system clock when measuring local activity', async () => {
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const mounted = render(<SessionLock />)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('current_session_remaining_ms'))
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86_400_000)

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown')))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('record_current_session_activity'))
    expect(signOut).not.toHaveBeenCalled()
    mounted.unmount()
  })
})
