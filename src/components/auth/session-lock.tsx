'use client'

import { useEffect } from 'react'

import { touchSessionState } from '@/features/auth/browser-session-client'
import { HumanActivityTracker } from '@/features/auth/human-activity'

export function SessionLock() {
  useEffect(() => {
    let locked = false
    const tracker = new HumanActivityTracker(touchSessionState, performance.now())
    const record = (event: Event) => {
      void tracker.record(event.type, performance.now())
    }
    const check = () => {
      if (!locked && tracker.isLocked(performance.now())) {
        locked = true
        window.location.replace('/auth/reauth')
      }
    }
    const events = ['pointerdown', 'keydown', 'touchstart']

    events.forEach((event) => window.addEventListener(event, record, { passive: true }))
    const timer = window.setInterval(check, 1_000)

    return () => {
      events.forEach((event) => window.removeEventListener(event, record))
      window.clearInterval(timer)
    }
  }, [])

  return null
}
