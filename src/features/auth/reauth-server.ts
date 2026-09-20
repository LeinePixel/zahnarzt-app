import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { hasRecentTotpAuthentication } from './reauth'

export function hasRecentTotpAuthenticationNow(claims: { aal?: unknown; amr?: unknown }) {
  return hasRecentTotpAuthentication(claims, Math.floor(Date.now() / 1000))
}

export async function hasCurrentRecentTotpAuthentication() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  return !error && !!data?.claims && hasRecentTotpAuthenticationNow(data.claims)
}
