'use server'

import { revalidatePath } from 'next/cache'

import {
  requestSupportAccess,
  revokeSupportAccess,
  type SupportAccessRpcClient,
} from '@/features/audit/support-access'
import { getCurrentUserContext } from '@/features/auth/current-user'
import { createClient } from '@/lib/supabase/server'

import {
  runRequestSupportAccessForCurrentPractice,
  runRevokeSupportAccessForCurrentPractice,
  SupportAccessActionError,
} from './support-access-action-logic'
import type { SupportAccessFormState } from './support-access-form-state'

async function requestSupportAccessForCurrentPractice(): Promise<string> {
  const client = (await createClient()) as SupportAccessRpcClient

  return runRequestSupportAccessForCurrentPractice(
    getCurrentUserContext,
    client,
    requestSupportAccess,
    revalidatePath,
  )
}

async function revokeSupportAccessForCurrentPractice(
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
