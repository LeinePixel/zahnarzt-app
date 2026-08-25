import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

import { loginSchema } from './login-schema'

export type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'

export type LoginState = {
  email: string
  error?: LoginErrorCode
  fieldErrors?: Partial<Record<'email' | 'password', string[]>>
}

type LoginAuthError = {
  code?: string
  message: string
  name: string
  status?: number
}

type LoginAuthResult = {
  data: { session: unknown; user: unknown }
  error: LoginAuthError | null
}

export type LoginAuthFunction = (credentials: {
  email: string
  password: string
}) => Promise<LoginAuthResult>

type LoginRedirect = (path: string) => never

export const initialLoginState: LoginState = { email: '' }

function classifyAuthError(error: LoginAuthError): LoginErrorCode {
  if (error.status === 429 || error.code === 'over_request_rate_limit') {
    return 'RATE_LIMITED'
  }

  if (
    (typeof error.status === 'number' && error.status >= 500) ||
    error.code === 'request_timeout'
  ) {
    return 'SERVICE_UNAVAILABLE'
  }

  return 'INVALID_CREDENTIALS'
}

function retainedEmail(formData: FormData) {
  const email = formData.get('email')

  return typeof email === 'string' ? email.trim().slice(0, 254) : ''
}

export async function runLogin(
  previousState: LoginState,
  formData: FormData,
  authenticate: LoginAuthFunction,
  redirectTo: LoginRedirect,
): Promise<LoginState> {
  void previousState

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      email: retainedEmail(formData),
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  let authResult: LoginAuthResult

  try {
    authResult = await authenticate(parsed.data)
  } catch {
    return {
      email: parsed.data.email,
      error: 'SERVICE_UNAVAILABLE',
    }
  }

  if (authResult.error) {
    return {
      email: parsed.data.email,
      error: classifyAuthError(authResult.error),
    }
  }

  redirectTo('/status')
}

export async function login(
  previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  'use server'

  const supabase = await createClient()

  return runLogin(
    previousState,
    formData,
    (credentials) => supabase.auth.signInWithPassword(credentials),
    redirect,
  )
}
