export type AuthenticationMethod = { method?: unknown; timestamp?: unknown }

export function hasRecentTotpAuthentication(
  claims: { aal?: unknown; amr?: unknown },
  nowSeconds: number,
) {
  if (claims.aal !== 'aal2' || !Array.isArray(claims.amr)) return false
  return claims.amr.some((entry: AuthenticationMethod) =>
    entry?.method === 'totp'
      && typeof entry.timestamp === 'number'
      && entry.timestamp > nowSeconds - 300
      && entry.timestamp <= nowSeconds + 30,
  )
}

export function safeReauthenticationTarget(value: string | undefined) {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/portal/audit'
  const url = new URL(value, 'https://dentpilot.invalid')
  return url.pathname === '/portal/audit' ? `${url.pathname}${url.search}` : '/portal/audit'
}
