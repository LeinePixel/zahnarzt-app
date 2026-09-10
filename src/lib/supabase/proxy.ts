import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getPublicEnv } from '@/lib/env'

export type ProxyCookieMethods = {
  getAll: () => Array<{ name: string; value: string }> | null
  setAll: (
    cookies: Array<{
      name: string
      options: CookieOptions
      value: string
    }>,
    headers: Record<string, string>,
  ) => void
}

type ProxyAuthClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims: { aal?: string; sub?: string } } | null
      error: unknown
    }>
  }
  rpc: (functionName: 'session_gate') => PromiseLike<{
    data: 'mfa_required' | 'reauth_required' | 'ready' | null
    error: unknown
  }>
}

export type ProxyAuthClientFactory = (
  cookies: ProxyCookieMethods,
) => ProxyAuthClient

const createProxyAuthClient: ProxyAuthClientFactory = (cookies) => {
  const env = getPublicEnv()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, { cookies })
}

function createContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development'
  let supabaseOrigin = 'https://*.supabase.co'

  try {
    supabaseOrigin = new URL(getPublicEnv().supabaseUrl).origin
  } catch {
    // Test doubles can exercise proxy routing without a configured provider.
  }

  const connectSources = ["'self'", supabaseOrigin]

  if (isDevelopment) {
    connectSources.push('http://localhost:*', 'http://127.0.0.1:*')
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    `connect-src ${connectSources.join(' ')}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "media-src 'self'",
  ].join('; ')
}

export async function updateSession(
  request: NextRequest,
  createAuthClient: ProxyAuthClientFactory = createProxyAuthClient,
): Promise<NextResponse> {
  const pendingCookies: Parameters<ProxyCookieMethods['setAll']>[0] = []
  const refreshHeaders = new Headers()
  const nonce = btoa(crypto.randomUUID())
  const contentSecurityPolicy = createContentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)
  requestHeaders.set('x-nonce', nonce)
  const cookieMethods: ProxyCookieMethods = {
    getAll: () => request.cookies.getAll(),
    setAll: (cookies, headers) => {
      for (const cookie of cookies) {
        const existingIndex = pendingCookies.findIndex(
          (pending) => pending.name === cookie.name,
        )

        if (existingIndex === -1) {
          pendingCookies.push(cookie)
        } else {
          pendingCookies[existingIndex] = cookie
        }

        request.cookies.set(cookie.name, cookie.value)
      }

      for (const [name, value] of Object.entries(headers)) {
        if (name.toLowerCase() !== 'set-cookie') {
          refreshHeaders.set(name, value)
        }
      }
    },
  }
  const supabase = createAuthClient(cookieMethods)
  const { data, error } = await supabase.auth.getClaims()
  const isAuthenticated =
    !error &&
    typeof data?.claims.sub === 'string' &&
    data.claims.sub.length > 0
  const requiresMfa = isAuthenticated && data?.claims.aal !== 'aal2'
  const pathname = request.nextUrl.pathname
  const isProtectedRoute =
    pathname.startsWith('/status') || pathname.startsWith('/portal')
  const sessionGate =
    isAuthenticated && !requiresMfa && isProtectedRoute
      ? await supabase.rpc('session_gate')
      : null
  const requiresReauthentication =
    sessionGate !== null &&
    (sessionGate.error !== null || sessionGate.data === 'reauth_required')
  let response: NextResponse

  if (requiresMfa && isProtectedRoute) {
    const mfaUrl = request.nextUrl.clone()
    mfaUrl.pathname = '/auth/mfa'
    mfaUrl.search = ''
    mfaUrl.hash = ''
    response = NextResponse.redirect(mfaUrl)
  } else if (requiresReauthentication && isProtectedRoute) {
    const reauthenticationUrl = request.nextUrl.clone()
    reauthenticationUrl.pathname = '/auth/reauth'
    reauthenticationUrl.search = ''
    reauthenticationUrl.hash = ''
    response = NextResponse.redirect(reauthenticationUrl)
  } else if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.hash = ''
    response = NextResponse.redirect(loginUrl)
  } else if (isAuthenticated && pathname === '/login') {
    const statusUrl = request.nextUrl.clone()
    statusUrl.pathname = '/status'
    statusUrl.search = ''
    statusUrl.hash = ''
    response = NextResponse.redirect(statusUrl)
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } })
  }

  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }

  refreshHeaders.forEach((value, name) => response.headers.set(name, value))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)

  return response
}
