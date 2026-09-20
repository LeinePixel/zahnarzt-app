'use client'

import { useEffect } from 'react'
import { createSessionActivityController } from '@/features/auth/session-activity'
import { createClient } from '@/lib/supabase/client'

export function SessionLock() {
  useEffect(() => {
    const supabase = createClient()
    const channel = new BroadcastChannel('dentpilot-session-activity')
    let expiring = false
    const expire = () => {
      if (expiring) return
      expiring = true
      channel.postMessage({ type: 'expired' })
      void supabase.auth.signOut({ scope: 'global' }).finally(() => window.location.assign('/login'))
    }
    const controller = createSessionActivityController({
      now: () => Date.now(), inactivityMs: 300_000, reportIntervalMs: 30_000, expire,
      record: async () => {
        const result = await supabase.rpc('record_current_session_activity')
        return !result.error && result.data === true
      },
    })
    const activity = () => {
      if (document.visibilityState !== 'visible') return
      const timestamp = Date.now()
      channel.postMessage({ type: 'activity', timestamp })
      void controller.activity()
    }
    const events: Array<keyof WindowEventMap> = ['keydown', 'pointerdown', 'touchstart']
    for (const event of events) window.addEventListener(event, activity, { passive: true })
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data
      if (!message || typeof message !== 'object' || !('type' in message)) return
      if (message.type === 'expired') expire()
      if (message.type === 'activity' && 'timestamp' in message && typeof message.timestamp === 'number') controller.remoteActivity(message.timestamp)
    }
    const timer = window.setInterval(() => controller.check(), 1000)
    void controller.activity()
    return () => {
      window.clearInterval(timer)
      for (const event of events) window.removeEventListener(event, activity)
      channel.close()
    }
  }, [])
  return null
}
