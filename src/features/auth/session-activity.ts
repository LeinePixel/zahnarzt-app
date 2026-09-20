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
    async activity() {
      if (expired) return
      const timestamp = options.now()
      lastActivity = timestamp
      if (timestamp - lastReport < options.reportIntervalMs) return
      lastReport = timestamp
      if (!await options.record()) expire()
    },
    remoteActivity(timestamp: number) {
      if (!expired && timestamp > lastActivity) lastActivity = timestamp
    },
    check() {
      if (options.now() - lastActivity >= options.inactivityMs) expire()
    },
  }
}
