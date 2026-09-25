type Options = {
  now: () => number
  record: () => Promise<boolean>
  expire: () => void
  inactivityMs: number
  reportIntervalMs: number
}

export function createSessionActivityController(options: Options) {
  let lastActivity = options.now()
  let lastReport = Number.NEGATIVE_INFINITY
  let expired = false

  function expire() {
    if (!expired) {
      expired = true
      options.expire()
    }
  }

  return {
    syncRemaining(remainingMs: number) {
      if (expired) return
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        expire()
        return
      }
      lastActivity = options.now() - (options.inactivityMs - Math.min(remainingMs, options.inactivityMs))
    },
    async activity() {
      if (expired) return false
      const timestamp = options.now()
      if (timestamp - lastActivity >= options.inactivityMs) {
        expire()
        return false
      }
      lastActivity = timestamp
      if (timestamp - lastReport < options.reportIntervalMs) return true
      lastReport = timestamp
      try {
        if (!await options.record()) expire()
      } catch {
        expire()
      }
      return !expired
    },
    remoteActivity() {
      if (!expired) lastActivity = options.now()
    },
    check() {
      if (options.now() - lastActivity >= options.inactivityMs) expire()
    },
  }
}
