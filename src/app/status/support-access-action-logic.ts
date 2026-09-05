import 'server-only'

import type { CurrentUserContext } from '@/features/auth/current-user'
import {
  requestSupportAccess,
  revokeSupportAccess,
  type SupportAccessRpcClient,
} from '@/features/audit/support-access'

export class SupportAccessActionError extends Error {
  override name = 'SupportAccessActionError'
}

type RequestSupportAccess = typeof requestSupportAccess
type RevokeSupportAccess = typeof revokeSupportAccess
type Revalidate = (path: string) => void

export async function runRequestSupportAccessForCurrentPractice(
  getContext: () => Promise<CurrentUserContext>,
  client: SupportAccessRpcClient,
  request: RequestSupportAccess,
  revalidate: Revalidate,
): Promise<string> {
  const context = await getContext()

  if (context.status !== 'ready' || context.role !== 'praxisadmin') {
    throw new SupportAccessActionError('Supportzugriff wurde verweigert.')
  }

  const grantId = await request(
    client,
    {
      kind: 'practice_member',
      userId: context.userId,
      practiceId: context.practiceId,
      role: context.role,
    },
  )
  revalidate('/status')
  return grantId
}

export async function runRevokeSupportAccessForCurrentPractice(
  getContext: () => Promise<CurrentUserContext>,
  client: SupportAccessRpcClient,
  revoke: RevokeSupportAccess,
  grantId: string,
  revalidate: Revalidate,
): Promise<void> {
  const context = await getContext()

  if (context.status !== 'ready' || context.role !== 'praxisadmin') {
    throw new SupportAccessActionError('Supportzugriff wurde verweigert.')
  }

  await revoke(
    client,
    {
      kind: 'practice_member',
      userId: context.userId,
      practiceId: context.practiceId,
      role: context.role,
    },
    { grantId },
  )
  revalidate('/status')
}
