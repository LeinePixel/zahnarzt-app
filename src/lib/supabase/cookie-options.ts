import type { CookieOptions } from '@supabase/ssr'

export function getAuthCookieOptions(
  isProduction = process.env.NODE_ENV === 'production',
): CookieOptions {
  return {
    path: '/',
    sameSite: 'lax',
    secure: isProduction,
  }
}
