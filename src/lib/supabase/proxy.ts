import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getPublicEnv } from '@/lib/env'

import { getAuthCookieOptions } from './cookie-options'

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
}

export type ProxyAuthClientFactory = (
  cookies: ProxyCookieMethods,
) => ProxyAuthClient

const createProxyAuthClient: ProxyAuthClientFactory = (cookies) => {
  const env = getPublicEnv()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies,
  })
}

function createContentSecurityPolicy(nonce: string): string {
  const developmentSource =
    process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
  const localDevelopmentConnections =
    process.env.NODE_ENV === 'development' ? ' http://localhost:* http://127.0.0.1:*' : ''

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentSource}`,
    "style-src 'self' 'nonce-" + nonce + "'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' https://*.supabase.co${localDevelopmentConnections}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

function setSecurityHeaders(
  response: NextResponse,
  policy: string,
  useHsts: boolean,
): void {
  response.headers.set('Content-Security-Policy', policy)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'same-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  )
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  if (useHsts) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  }
}

export async function updateSession(
  request: NextRequest,
  createAuthClient: ProxyAuthClientFactory = createProxyAuthClient,
): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const contentSecurityPolicy = createContentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)
  requestHeaders.set('x-nonce', nonce)
  const pendingCookies: Parameters<ProxyCookieMethods['setAll']>[0] = []
  const refreshHeaders = new Headers()
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
  const pathname = request.nextUrl.pathname
  const isMfaRoute = pathname.startsWith('/auth/mfa')
  const isReauthenticationRoute = pathname.startsWith('/auth/reauth')
  const isProtectedRoute = pathname.startsWith('/status')
    || pathname.startsWith('/portal')
    || isMfaRoute
    || isReauthenticationRoute
  let response: NextResponse

  if (
    !isAuthenticated &&
    isProtectedRoute
  ) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.hash = ''
    response = NextResponse.redirect(loginUrl)
  } else if (isAuthenticated && data?.claims.aal !== 'aal2' && !isMfaRoute) {
    const mfaUrl = request.nextUrl.clone()
    mfaUrl.pathname = '/auth/mfa'
    mfaUrl.search = ''
    mfaUrl.hash = ''
    response = NextResponse.redirect(mfaUrl)
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
  setSecurityHeaders(
    response,
    contentSecurityPolicy,
    process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:',
  )

  return response
}
