import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { loginSchema } from './login-schema'

describe('loginSchema', () => {
  it('reports both required fields when the form is empty', () => {
    const result = loginSchema.safeParse({ email: '', password: '' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).fieldErrors).toEqual({
        email: ['E-Mail-Adresse ist erforderlich.'],
        password: ['Passwort ist erforderlich.'],
      })
    }
  })

  it('reports an invalid email format', () => {
    const result = loginSchema.safeParse({
      email: 'keine-adresse',
      password: 'synthetic-password',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(z.flattenError(result.error).fieldErrors.email).toEqual([
        'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      ])
    }
  })

  it('normalizes a valid email without modifying the password', () => {
    expect(
      loginSchema.parse({
        email: '  TESTPERSON@DENTPILOT.EXAMPLE ',
        password: ' synthetic password ',
      }),
    ).toEqual({
      email: 'testperson@dentpilot.example',
      password: ' synthetic password ',
    })
  })
})
