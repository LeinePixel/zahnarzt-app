import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

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
): ProxyAuthClientFactory {
  return (cookies) => ({
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
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe('same-origin')
    expect(response.headers.get('permissions-policy')).toContain('camera=()')
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
