'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentUserContext } from '@/features/auth/current-user'
import {
  activateSupportAccess,
  type SupportAccessRpcClient,
  type SupportReason,
} from '@/features/audit/support-access'
import { createClient } from '@/lib/supabase/server'

class PortalSupportAccessActionError extends Error {
  override name = 'PortalSupportAccessActionError'
}

export async function activateSupportAccessForCurrentPortal(
  formData: FormData,
): Promise<void> {
  const context = await getCurrentUserContext()
  const grantId = formData.get('grantId')
  const reason = formData.get('reason')

  if (
    context.status !== 'portal_admin' ||
    typeof grantId !== 'string' ||
    typeof reason !== 'string'
  ) {
    throw new PortalSupportAccessActionError('Supportzugriff wurde verweigert.')
  }

  const client = (await createClient()) as SupportAccessRpcClient

  const activation = await activateSupportAccess(
    client,
    { kind: 'portal_admin', userId: context.userId },
    { grantId, reason: reason as SupportReason },
  )
  revalidatePath('/portal/audit')
  redirect(`/portal/audit?practiceId=${activation.practiceId}`)
}
