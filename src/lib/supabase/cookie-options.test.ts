import { describe, expect, it } from 'vitest'

import { getAuthCookieOptions } from './cookie-options'

describe('getAuthCookieOptions', () => {
  it('requires secure, same-site cookies in production', () => {
    expect(getAuthCookieOptions(true)).toEqual({
      path: '/',
      sameSite: 'lax',
      secure: true,
    })
  })

  it('keeps local HTTP development usable without weakening production cookies', () => {
    expect(getAuthCookieOptions(false)).toEqual({
      path: '/',
      sameSite: 'lax',
      secure: false,
    })
  })
})
