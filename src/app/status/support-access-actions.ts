'use server'

import { revalidatePath } from 'next/cache'

import type { CurrentUserContext } from '@/features/auth/current-user'
import {
  requestSupportAccess,
  revokeSupportAccess,
  type SupportAccessRpcClient,
} from '@/features/audit/support-access'
import { getCurrentUserContext } from '@/features/auth/current-user'
import { createClient } from '@/lib/supabase/server'

export class SupportAccessActionError extends Error {
  override name = 'SupportAccessActionError'
}

type RequestSupportAccess = typeof requestSupportAccess
type RevokeSupportAccess = typeof revokeSupportAccess
type Revalidate = (path: string) => void

export type SupportAccessFormState = {
  grantId: string | null
  message: string | null
}

export const initialSupportAccessFormState: SupportAccessFormState = {
  grantId: null,
  message: null,
}

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

export async function requestSupportAccessForCurrentPractice(): Promise<string> {
  const client = (await createClient()) as SupportAccessRpcClient

  return runRequestSupportAccessForCurrentPractice(
    getCurrentUserContext,
    client,
    requestSupportAccess,
    revalidatePath,
  )
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

export async function revokeSupportAccessForCurrentPractice(
  formData: FormData,
): Promise<void> {
  const grantId = formData.get('grantId')

  if (typeof grantId !== 'string') {
    throw new SupportAccessActionError('Supportzugriff wurde verweigert.')
  }

  const client = (await createClient()) as SupportAccessRpcClient

  return runRevokeSupportAccessForCurrentPractice(
    getCurrentUserContext,
    client,
    revokeSupportAccess,
    grantId,
    revalidatePath,
  )
}

export async function requestSupportAccessFormAction(
  previousState: SupportAccessFormState,
  formData: FormData,
): Promise<SupportAccessFormState> {
  void previousState
  void formData

  try {
    return {
      grantId: await requestSupportAccessForCurrentPractice(),
      message: null,
    }
  } catch {
    return { grantId: null, message: 'Supportzugriff wurde verweigert.' }
  }
}

export async function revokeSupportAccessFormAction(
  _: SupportAccessFormState,
  formData: FormData,
): Promise<SupportAccessFormState> {
  try {
    await revokeSupportAccessForCurrentPractice(formData)
    return {
      grantId: null,
      message: 'Supportzugriff wurde widerrufen.',
    }
  } catch {
    return { grantId: null, message: 'Supportzugriff wurde verweigert.' }
  }
}
