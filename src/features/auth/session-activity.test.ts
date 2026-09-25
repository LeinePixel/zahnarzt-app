import { describe, expect, it, vi } from 'vitest'

import { createSessionActivityController } from './session-activity'

describe('session activity controller', () => {
  it('does not extend inactivity on mount and expires after the server remaining time', () => {
    let now = 1000
    const expire = vi.fn()
    const controller = createSessionActivityController({ now: () => now, record: async () => true, expire, inactivityMs: 300_000, reportIntervalMs: 30_000 })
    controller.syncRemaining(10_000)
    now += 9_999
    controller.check()
    expect(expire).not.toHaveBeenCalled()
    now += 1
    controller.check()
    expect(expire).toHaveBeenCalledOnce()
  })
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

  it('uses the receiving tab clock for activity from another tab', () => {
    let now = 0
    const expire = vi.fn()
    const controller = createSessionActivityController({ now: () => now, record: async () => true, expire, inactivityMs: 300_000, reportIntervalMs: 30_000 })
    controller.syncRemaining(30_000)
    now = 20_000
    controller.remoteActivity()
    now = 319_999
    controller.check()
    expect(expire).not.toHaveBeenCalled()
    now = 320_000
    controller.check()
    expect(expire).toHaveBeenCalledOnce()
  })

  it('locks on a failed activity report and cannot revive at the deadline', async () => {
    let now = 0
    const record = vi.fn(async () => { throw new Error('offline') })
    const expire = vi.fn()
    const controller = createSessionActivityController({ now: () => now, record, expire, inactivityMs: 300_000, reportIntervalMs: 30_000 })
    controller.syncRemaining(5_000)
    await controller.activity()
    expect(expire).toHaveBeenCalledOnce()
    now = 5_000
    await controller.activity()
    expect(record).toHaveBeenCalledOnce()
  })
})
