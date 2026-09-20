import { describe, expect, it } from 'vitest'
import { hasRecentTotpAuthentication, safeReauthenticationTarget } from './reauth'

describe('hasRecentTotpAuthentication', () => {
  it('accepts TOTP immediately before and rejects exactly at five minutes', () => {
    expect(hasRecentTotpAuthentication({ aal: 'aal2', amr: [{ method: 'totp', timestamp: 701 }] }, 1000)).toBe(true)
    expect(hasRecentTotpAuthentication({ aal: 'aal2', amr: [{ method: 'totp', timestamp: 700 }] }, 1000)).toBe(false)
  })

  it('rejects AAL1, other methods, and implausible future timestamps', () => {
    expect(hasRecentTotpAuthentication({ aal: 'aal1', amr: [{ method: 'totp', timestamp: 1000 }] }, 1000)).toBe(false)
    expect(hasRecentTotpAuthentication({ aal: 'aal2', amr: [{ method: 'password', timestamp: 1000 }] }, 1000)).toBe(false)
    expect(hasRecentTotpAuthentication({ aal: 'aal2', amr: [{ method: 'totp', timestamp: 1031 }] }, 1000)).toBe(false)
  })
})

describe('safeReauthenticationTarget', () => {
  it('keeps only local portal audit targets', () => {
    expect(safeReauthenticationTarget('/portal/audit?practiceId=synthetic')).toBe('/portal/audit?practiceId=synthetic')
    expect(safeReauthenticationTarget('https://evil.invalid')).toBe('/portal/audit')
    expect(safeReauthenticationTarget('//evil.invalid/portal/audit')).toBe('/portal/audit')
    expect(safeReauthenticationTarget('/status')).toBe('/portal/audit')
  })
})
