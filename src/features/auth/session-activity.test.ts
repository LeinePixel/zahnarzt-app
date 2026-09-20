import { describe, expect, it, vi } from 'vitest'

import { createSessionActivityController } from './session-activity'

describe('session activity controller', () => {
  it('records at most once per interval and expires at the exact boundary', async () => {
    let now = 0
    const record = vi.fn(async () => true)
    const expire = vi.fn()
    const controller = createSessionActivityController({ now: () => now, record, expire, inactivityMs: 300_000, reportIntervalMs: 30_000 })
    await controller.activity()
    now = 29_999
    await controller.activity()
    expect(record).toHaveBeenCalledOnce()
    now = 30_000
    await controller.activity()
    expect(record).toHaveBeenCalledTimes(2)
    now = 330_000
    controller.check()
    expect(expire).toHaveBeenCalledOnce()
  })

  it('expires immediately when the server refuses an activity update', async () => {
    const expire = vi.fn()
    const controller = createSessionActivityController({ now: () => 0, record: async () => false, expire, inactivityMs: 300_000, reportIntervalMs: 30_000 })
    await controller.activity()
    expect(expire).toHaveBeenCalledOnce()
  })
})
