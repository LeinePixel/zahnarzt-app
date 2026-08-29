import { describe, expect, it, vi } from 'vitest'

import type { ActorContext } from '@/features/authorization/policy'

import { AuditReadError, readAuditEvents } from './read-events'

const portalAdmin: ActorContext = {
  kind: 'portal_admin',
  userId: '11000000-0000-0000-0000-000000000003',
}

const praxisadmin: ActorContext = {
  kind: 'practice_member',
  userId: '11000000-0000-0000-0000-000000000001',
  practiceId: '21000000-0000-0000-0000-000000000001',
  role: 'praxisadmin',
}

function rpcClient(result: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(result) }
}

describe('audit read server adapter', () => {
  it('rejects invalid scope and an over-limit before calling Postgres', async () => {
    const client = rpcClient({ data: [], error: null })

    await expect(
      readAuditEvents(client, portalAdmin, { practiceId: 'bad', limit: 101 }),
    ).rejects.toThrow('zwischen 1 und 100')

    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('calls the scoped RPC with fixed metadata inputs only', async () => {
    const client = rpcClient({
      data: [
        {
          action: 'audit_read',
          actor_id: '11000000-0000-0000-0000-000000000003',
          actor_type: 'portal_admin',
          correlation_id: '41000000-0000-0000-0000-000000000001',
          occurred_at: '2026-08-28T12:00:00.000Z',
          outcome: 'allowed',
          resource_id: '31000000-0000-0000-0000-000000000001',
          resource_type: 'support_access_grant',
        },
      ],
      error: null,
    })

    await expect(
      readAuditEvents(client, portalAdmin, {
        practiceId: '21000000-0000-0000-0000-000000000001',
        before: new Date('2026-08-28T12:00:00.000Z'),
        limit: 100,
      }),
    ).resolves.toEqual([
      {
        action: 'audit_read',
        actorId: '11000000-0000-0000-0000-000000000003',
        actorType: 'portal_admin',
        correlationId: '41000000-0000-0000-0000-000000000001',
        occurredAt: '2026-08-28T12:00:00.000Z',
        outcome: 'allowed',
        resourceId: '31000000-0000-0000-0000-000000000001',
        resourceType: 'support_access_grant',
      },
    ])

    expect(client.rpc).toHaveBeenCalledWith('read_audit_events', {
      p_practice_id: '21000000-0000-0000-0000-000000000001',
      p_before: '2026-08-28T12:00:00.000Z',
      p_limit: 100,
    })
    expect(client.rpc).toHaveBeenCalledWith(
      'read_audit_events',
      expect.not.objectContaining({
        export: expect.anything(),
        query: expect.anything(),
        search: expect.anything(),
      }),
    )
  })

  it('accepts a PostgreSQL timestamptz response with a numeric UTC offset', async () => {
    const client = rpcClient({
      data: [
        {
          action: 'audit_read',
          actor_id: '11000000-0000-0000-0000-000000000003',
          actor_type: 'portal_admin',
          correlation_id: '41000000-0000-0000-0000-000000000001',
          occurred_at: '2026-08-28T12:00:00+00:00',
          outcome: 'allowed',
          resource_id: '31000000-0000-0000-0000-000000000001',
          resource_type: 'support_access_grant',
        },
      ],
      error: null,
    })

    await expect(
      readAuditEvents(client, portalAdmin, {
        practiceId: '21000000-0000-0000-0000-000000000001',
      }),
    ).resolves.toHaveLength(1)
  })

  it('blocks practice identities before the audit RPC', async () => {
    const client = rpcClient({ data: [], error: null })

    await expect(
      readAuditEvents(client, praxisadmin, {
        practiceId: '21000000-0000-0000-0000-000000000001',
      }),
    ).rejects.toThrow(AuditReadError)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('treats empty, malformed, and failed database responses as neutral denials', async () => {
    const emptyClient = rpcClient({ data: [], error: null })
    const malformedClient = rpcClient({ data: [{ action: 'audit_read' }], error: null })
    const failedClient = rpcClient({
      data: null,
      error: new Error('permission detail must never reach the UI'),
    })
    const input = { practiceId: '21000000-0000-0000-0000-000000000001' }

    for (const client of [emptyClient, malformedClient, failedClient]) {
      await expect(readAuditEvents(client, portalAdmin, input)).rejects.toThrow(
        'Audit-Zugriff wurde verweigert.',
      )
    }
  })
})
