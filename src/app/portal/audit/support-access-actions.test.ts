import { describe, expect, it, vi } from 'vitest'

import { getCurrentUserContext } from '@/features/auth/current-user'
import { activateSupportAccess } from '@/features/audit/support-access'
import { createClient } from '@/lib/supabase/server'

import { activateSupportAccessForCurrentPortal } from './support-access-actions'

vi.mock('@/features/auth/current-user', () => ({
  getCurrentUserContext: vi.fn(),
}))
vi.mock('@/features/audit/support-access', () => ({
  activateSupportAccess: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

describe('activateSupportAccessForCurrentPortal', () => {
  it('enters exactly the practice returned after activating the submitted opaque grant', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({
      status: 'portal_admin',
      userId: '11000000-0000-0000-0000-000000000003',
    })
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(activateSupportAccess).mockResolvedValue({
      practiceId: '21000000-0000-0000-0000-000000000001',
      expiresAt: '2026-08-28T20:00:00Z',
    })
    const formData = new FormData()
    formData.set('grantId', '31000000-0000-0000-0000-000000000001')
    formData.set('reason', 'technical_investigation')

    await expect(activateSupportAccessForCurrentPortal(formData)).resolves.toBeUndefined()

    expect(activateSupportAccess).toHaveBeenCalledWith(
      {},
      {
        kind: 'portal_admin',
        userId: '11000000-0000-0000-0000-000000000003',
      },
      {
        grantId: '31000000-0000-0000-0000-000000000001',
        reason: 'technical_investigation',
      },
    )
    const { redirect } = await import('next/navigation')
    expect(redirect).toHaveBeenCalledWith(
      '/portal/audit?practiceId=21000000-0000-0000-0000-000000000001',
    )
  })
})
