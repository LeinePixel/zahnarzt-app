import { describe, expect, it, vi } from 'vitest'

import type { CurrentUserContext } from '@/features/auth/current-user'
import type { SupportAccessRpcClient } from '@/features/audit/support-access'

import {
  SupportAccessActionError,
  runRequestSupportAccessForCurrentPractice,
} from './support-access-actions'

const praxisadmin: CurrentUserContext = {
  status: 'ready',
  displayName: 'PROJ-19 Praxisadmin',
  practiceId: '21000000-0000-0000-0000-000000000001',
  practiceName: 'PROJ-19 Testpraxis',
  role: 'praxisadmin',
  roleLabel: 'Praxisadministration',
  userId: '11000000-0000-0000-0000-000000000001',
}

describe('runRequestSupportAccessForCurrentPractice', () => {
  it('requests only the current praxisadmin support access and revalidates status', async () => {
    const request = vi.fn().mockResolvedValue('31000000-0000-0000-0000-000000000001')
    const revalidate = vi.fn()

    await expect(
      runRequestSupportAccessForCurrentPractice(
        async () => praxisadmin,
        {} as SupportAccessRpcClient,
        request,
        revalidate,
      ),
    ).resolves.toBeUndefined()

    expect(request).toHaveBeenCalledWith(
      {},
      {
        kind: 'practice_member',
        userId: praxisadmin.userId,
        practiceId: praxisadmin.practiceId,
        role: 'praxisadmin',
      },
    )
    expect(revalidate).toHaveBeenCalledWith('/status')
  })

  it('does not call an RPC for incomplete or non-admin contexts', async () => {
    const request = vi.fn()

    await expect(
      runRequestSupportAccessForCurrentPractice(
        async () => ({ status: 'incomplete', userId: 'unknown-user' }),
        {} as SupportAccessRpcClient,
        request,
        vi.fn(),
      ),
    ).rejects.toThrow(SupportAccessActionError)
    await expect(
      runRequestSupportAccessForCurrentPractice(
        async () => ({ ...praxisadmin, role: 'behandler', roleLabel: 'Behandler' }),
        {} as SupportAccessRpcClient,
        request,
        vi.fn(),
      ),
    ).rejects.toThrow(SupportAccessActionError)

    expect(request).not.toHaveBeenCalled()
  })
})
