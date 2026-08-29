'use server'

import { revalidatePath } from 'next/cache'

import type { CurrentUserContext } from '@/features/auth/current-user'
import {
  requestSupportAccess,
  type SupportAccessRpcClient,
} from '@/features/audit/support-access'
import { getCurrentUserContext } from '@/features/auth/current-user'
import { createClient } from '@/lib/supabase/server'

export class SupportAccessActionError extends Error {
  override name = 'SupportAccessActionError'
}

type RequestSupportAccess = typeof requestSupportAccess
type Revalidate = (path: string) => void

export async function runRequestSupportAccessForCurrentPractice(
  getContext: () => Promise<CurrentUserContext>,
  client: SupportAccessRpcClient,
  request: RequestSupportAccess,
  revalidate: Revalidate,
): Promise<void> {
  const context = await getContext()

  if (context.status !== 'ready' || context.role !== 'praxisadmin') {
    throw new SupportAccessActionError('Supportzugriff wurde verweigert.')
  }

  await request(
    client,
    {
      kind: 'practice_member',
      userId: context.userId,
      practiceId: context.practiceId,
      role: context.role,
    },
  )
  revalidate('/status')
}

export async function requestSupportAccessForCurrentPractice(): Promise<void> {
  const client = (await createClient()) as SupportAccessRpcClient

  return runRequestSupportAccessForCurrentPractice(
    getCurrentUserContext,
    client,
    requestSupportAccess,
    revalidatePath,
  )
}
