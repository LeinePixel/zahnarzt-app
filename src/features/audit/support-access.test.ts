import { describe, expect, it, vi } from 'vitest'

import type { ActorContext } from '@/features/authorization/policy'

import {
  SupportAccessError,
  activateSupportAccess,
  requestSupportAccess,
  revokeSupportAccess,
} from './support-access'

const praxisadmin: ActorContext = {
  kind: 'practice_member',
  userId: '11000000-0000-0000-0000-000000000001',
  practiceId: '21000000-0000-0000-0000-000000000001',
  role: 'praxisadmin',
}

const rezeption: ActorContext = {
  ...praxisadmin,
  role: 'rezeption',
}

const portalAdmin: ActorContext = {
  kind: 'portal_admin',
  userId: '11000000-0000-0000-0000-000000000003',
}

function rpcClient(result: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(result) }
}

describe('support-access server adapter', () => {
  it('rejects a requested duration outside the allowed range before calling Postgres', async () => {
    const client = rpcClient({ data: 'unused', error: null })

    await expect(
      requestSupportAccess(client, praxisadmin, { requestedDurationHours: 25 }),
    ).rejects.toThrow('maximal 24 Stunden')

    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('uses the eight-hour default and only sends the controlled RPC payload', async () => {
    const client = rpcClient({
      data: '31000000-0000-0000-0000-000000000001',
      error: null,
    })

    await expect(requestSupportAccess(client, praxisadmin)).resolves.toBe(
      '31000000-0000-0000-0000-000000000001',
    )

    expect(client.rpc).toHaveBeenCalledWith('request_support_access', {
      p_requested_duration: '8 hours',
    })
  })

  it('rejects a practice role before it can request support access', async () => {
    const client = rpcClient({ data: 'unused', error: null })

    await expect(requestSupportAccess(client, rezeption)).rejects.toThrow(
      SupportAccessError,
    )
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('only accepts the controlled support reasons for provider activation', async () => {
    const client = rpcClient({ data: 'unused', error: null })

    await expect(
      activateSupportAccess(client, portalAdmin, {
        grantId: '31000000-0000-0000-0000-000000000001',
        reason: 'free text is never allowed' as never,
      }),
    ).rejects.toThrow('Ungültiger Supportgrund')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('maps neutral database denials and provider errors to the same safe message', async () => {
    const deniedClient = rpcClient({ data: null, error: null })
    const failedClient = rpcClient({
      data: null,
      error: new Error('tenant table details must never reach the UI'),
    })

    await expect(
      revokeSupportAccess(deniedClient, praxisadmin, {
        grantId: '31000000-0000-0000-0000-000000000001',
      }),
    ).rejects.toThrow('Supportzugriff wurde verweigert.')
    await expect(
      revokeSupportAccess(failedClient, praxisadmin, {
        grantId: '31000000-0000-0000-0000-000000000001',
      }),
    ).rejects.toThrow('Supportzugriff wurde verweigert.')
  })
})
