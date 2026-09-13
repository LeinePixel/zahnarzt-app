import { describe, expect, it, vi } from 'vitest'

import { HumanActivityTracker } from './human-activity'

describe('HumanActivityTracker', () => {
  it('touches a current session only for throttled human input', async () => {
    const touch = vi.fn().mockResolvedValue(true)
    const tracker = new HumanActivityTracker(touch, 0)

    await tracker.record('pointerdown', 1)
    await tracker.record('keydown', 10_000)
    await tracker.record('touchstart', 31_000)

    expect(touch).toHaveBeenCalledTimes(2)
  })

  it('does not treat timers, visibility or network activity as human interaction', async () => {
    const touch = vi.fn().mockResolvedValue(true)
    const tracker = new HumanActivityTracker(touch, 0)

    await tracker.record('timer', 1)
    await tracker.record('visibilitychange', 2)
    await tracker.record('network', 3)

    expect(touch).not.toHaveBeenCalled()
  })

  it('locks after five monotonic minutes without an input event', () => {
    const tracker = new HumanActivityTracker(vi.fn().mockResolvedValue(true), 0)

    expect(tracker.isLocked(299_999)).toBe(false)
    expect(tracker.isLocked(300_000)).toBe(true)
  })

  it('locks when the server rejects an otherwise human activity touch', async () => {
    const tracker = new HumanActivityTracker(vi.fn().mockResolvedValue(false), 0)

    await tracker.record('pointerdown', 1)

    expect(tracker.isLocked(2)).toBe(true)
  })

  it('locks when the server touch cannot be completed', async () => {
    const tracker = new HumanActivityTracker(
      vi.fn().mockRejectedValue(new Error('Network unavailable')),
      0,
    )

    await tracker.record('keydown', 1)

    expect(tracker.isLocked(2)).toBe(true)
  })
})
