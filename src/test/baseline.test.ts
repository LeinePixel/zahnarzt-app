import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

describe('test baseline', () => {
  it('keeps the last conflicting Tailwind utility', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
