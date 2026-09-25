import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { config } from '@/proxy'

import {
  updateSession,
  type ProxyAuthClientFactory,
  type ProxyCookieMethods,
} from './proxy'

type ClaimsResult = {
  data: { claims: { aal?: string; sub?: string } } | null
  error: Error | null
}

function authFactory(
  result: ClaimsResult,
  onClaims?: (cookies: ProxyCookieMethods) => void,
  sessionValid = true,
): ProxyAuthClientFactory {
  return (cookies) => ({
    rpc: async () => ({ data: sessionValid ? 300_000 : 0, error: null }),
    auth: {
      getClaims: async () => {
        onClaims?.(cookies)
        return result
      },
    },
  })
}

const anonymous = authFactory({
  data: null,
  error: null,
})

afterEach(() => vi.unstubAllEnvs())

describe('updateSession', () => {
  it('redirects anonymous access to a protected route without retaining query data', async () => {
    const request = new NextRequest(
      'https://app.example/status?patient=synthetic-123',
    )

    const response = await updateSession(request, anonymous)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example/login')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('redirects anonymous portal access without retaining query data', async () => {
    const request = new NextRequest(
      'https://app.example/portal/audit?practiceId=21000000-0000-0000-0000-000000000001',
    )

    const response = await updateSession(request, anonymous)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example/login')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('redirects an authenticated user away from login', async () => {
    const request = new NextRequest('https://app.example/login')
    const authenticated = authFactory({
      data: { claims: { sub: 'synthetic-user-id', aal: 'aal2' } },
      error: null,
    })

    const response = await updateSession(request, authenticated)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example/status')
  })

  it('keeps the login page reachable when AAL2 claims outlive the database session', async () => {
    const request = new NextRequest('https://app.example/login')
    const stale = authFactory({
      data: { claims: { sub: 'synthetic-user-id', aal: 'aal2' } },
      error: null,
    }, undefined, false)

    const response = await updateSession(request, stale)
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('routes an AAL1 identity only to the MFA bootstrap', async () => {
    const request = new NextRequest('https://app.example/status?sensitive=never')
    const aal1 = authFactory({
      data: { claims: { sub: 'synthetic-user-id', aal: 'aal1' } },
      error: null,
    })

    const response = await updateSession(request, aal1)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://app.example/auth/mfa')
  })

  it('protects the reauthentication route and sends AAL1 to MFA', async () => {
    const anonymousResponse = await updateSession(new NextRequest('https://app.example/auth/reauth'), anonymous)
    expect(anonymousResponse.headers.get('location')).toBe('https://app.example/login')
    const aal1 = authFactory({ data: { claims: { sub: 'synthetic-user-id', aal: 'aal1' } }, error: null })
    const aal1Response = await updateSession(new NextRequest('https://app.example/auth/reauth'), aal1)
    expect(aal1Response.headers.get('location')).toBe('https://app.example/auth/mfa')
  })

  it('treats failed claim verification as anonymous', async () => {
    const request = new NextRequest('https://app.example/status')
    const invalidClaims = authFactory({
      data: null,
      error: new Error('invalid token'),
    })

    const response = await updateSession(request, invalidClaims)

    expect(response.headers.get('location')).toBe('https://app.example/login')
  })

  it('forwards incoming and refreshed auth cookies with their security attributes', async () => {
    const request = new NextRequest('https://app.example/status', {
      headers: { cookie: 'sb-existing=synthetic-cookie' },
    })
    let incomingCookieValue: string | undefined
    const authenticated = authFactory(
      {
        data: { claims: { sub: 'synthetic-user-id', aal: 'aal2' } },
        error: null,
      },
      (cookies) => {
        incomingCookieValue = cookies
          .getAll()
          ?.find((cookie) => cookie.name === 'sb-existing')?.value
        cookies.setAll(
          [
            {
              name: 'sb-refreshed',
              options: {
                httpOnly: true,
                path: '/',
                sameSite: 'lax',
                secure: true,
              },
              value: 'synthetic-refreshed-cookie',
            },
          ],
          {
            Expires: '0',
            Pragma: 'no-cache',
          },
        )
      },
    )

    const response = await updateSession(request, authenticated)

    expect(incomingCookieValue).toBe('synthetic-cookie')
    expect(request.cookies.get('sb-refreshed')?.value).toBe(
      'synthetic-refreshed-cookie',
    )
    expect(response.cookies.get('sb-refreshed')?.value).toBe(
      'synthetic-refreshed-cookie',
    )
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('Secure')
    expect(response.headers.get('pragma')).toBe('no-cache')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('sets a nonce-based CSP and browser security headers on protected responses', async () => {
    const request = new NextRequest('https://app.example/status')
    const authenticated = authFactory({
        data: { claims: { sub: 'synthetic-user-id', aal: 'aal2' } },
      error: null,
    })

    const response = await updateSession(request, authenticated)
    const policy = response.headers.get('content-security-policy')

    expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/)
    expect(policy).not.toContain("'unsafe-inline'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain('connect-src')
    expect(policy).toContain('https://supabase.invalid')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe('same-origin')
    expect(response.headers.get('permissions-policy')).toContain('camera=()')
  })

  it('does not activate HSTS for an unverified host or a forwarded HTTPS claim', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const unverified = await updateSession(new NextRequest('https://unknown.example/login'), anonymous)
    const forwarded = await updateSession(new NextRequest('http://app.example/login', {
      headers: { 'x-forwarded-proto': 'https' },
    }), anonymous)
    expect(unverified.headers.get('strict-transport-security')).toBeNull()
    expect(forwarded.headers.get('strict-transport-security')).toBeNull()
  })

  it('limits HSTS to the explicitly verified HTTPS host without subdomains or preload', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SECURITY_HSTS_HOST', 'app.example')
    const verified = await updateSession(new NextRequest('https://app.example/login'), anonymous)
    const other = await updateSession(new NextRequest('https://sub.app.example/login'), anonymous)
    expect(verified.headers.get('strict-transport-security')).toBe('max-age=31536000')
    expect(other.headers.get('strict-transport-security')).toBeNull()
  })

  it('uses CSP report-only only on the explicitly configured synthetic HTTPS host', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SECURITY_CSP_REPORT_ONLY_HOST', 'synthetic.example')
    const synthetic = await updateSession(new NextRequest('https://synthetic.example/login'), anonymous)
    const other = await updateSession(new NextRequest('https://app.example/login'), anonymous)
    const http = await updateSession(new NextRequest('http://synthetic.example/login'), anonymous)
    expect(synthetic.headers.get('content-security-policy')).toBeNull()
    expect(synthetic.headers.get('content-security-policy-report-only')).toContain("frame-ancestors 'none'")
    expect(other.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(other.headers.get('content-security-policy-report-only')).toBeNull()
    expect(http.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
  })
})

describe('proxy matcher', () => {
  it.each([
    '/_next/static/chunks/app.js',
    '/_next/image?url=%2Flogo.png&w=128&q=75',
    '/favicon.ico',
    '/brand.svg',
  ])('excludes static asset %s', (path) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: `https://app.example${path}`,
      }),
    ).toBe(false)
  })

  it('includes the protected status route', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: 'https://app.example/status',
      }),
    ).toBe(true)
  })

  it('includes the protected portal route', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: 'https://app.example/portal/audit',
      }),
    ).toBe(true)
  })
})
