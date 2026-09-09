const humanInputEvents = new Set(['keydown', 'pointerdown', 'touchstart'])
const inactivityMilliseconds = 5 * 60 * 1000
const touchThrottleMilliseconds = 30 * 1000

export class HumanActivityTracker {
  private lastHumanInputAt: number
  private lastTouchAt = Number.NEGATIVE_INFINITY
  private serverRejectedActivity = false

  constructor(
    private readonly touch: () => Promise<boolean>,
    startedAt: number,
  ) {
    this.lastHumanInputAt = startedAt
  }

  async record(eventType: string, now: number): Promise<void> {
    if (!humanInputEvents.has(eventType)) {
      return
    }

    this.lastHumanInputAt = now

    if (now - this.lastTouchAt < touchThrottleMilliseconds) {
      return
    }

    this.lastTouchAt = now

    try {
      if (!(await this.touch())) {
        this.serverRejectedActivity = true
      }
    } catch {
      this.serverRejectedActivity = true
    }
  }

  isLocked(now: number): boolean {
    return this.serverRejectedActivity || now - this.lastHumanInputAt >= inactivityMilliseconds
  }
}
