'use client'

import { useEffect } from 'react'
import { createSessionActivityController } from '@/features/auth/session-activity'
import { createClient } from '@/lib/supabase/client'

export function SessionLock() {
  useEffect(() => {
    const supabase = createClient()
    const channel = new BroadcastChannel('dentpilot-session-activity')
    let expiring = false
    let disposed = false
    let activityRevision = 0
    const expire = () => {
      if (expiring) return
      expiring = true
      channel.postMessage({ type: 'expired' })
      void supabase.auth.signOut({ scope: 'global' }).finally(() => window.location.assign('/login'))
    }
    const controller = createSessionActivityController({
      now: () => performance.now(), inactivityMs: 300_000, reportIntervalMs: 30_000, expire,
      record: async () => {
        const result = await supabase.rpc('record_current_session_activity')
        return !result.error && result.data === true
      },
    })
    const syncDeadline = async () => {
      const revision = activityRevision
      try {
        const result = await supabase.rpc('current_session_remaining_ms')
        if (disposed || revision !== activityRevision) return
        controller.syncRemaining(!result.error && typeof result.data === 'number' ? result.data : 0)
      } catch {
        if (!disposed && revision === activityRevision) controller.syncRemaining(0)
      }
    }
    const activity = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return
      activityRevision += 1
      void controller.activity().then(active => {
        if (active && !disposed) channel.postMessage({ type: 'activity' })
      })
    }
    const events: Array<keyof WindowEventMap> = ['keydown', 'pointerdown', 'touchstart']
    for (const event of events) window.addEventListener(event, activity, { passive: true })
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data
      if (!message || typeof message !== 'object' || !('type' in message)) return
      if (message.type === 'expired') expire()
      if (message.type === 'activity') {
        activityRevision += 1
        controller.remoteActivity()
      }
    }
    const timer = window.setInterval(() => controller.check(), 1000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void syncDeadline()
    }
    const onFocus = () => { void syncDeadline() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    void syncDeadline()
    return () => {
      disposed = true
      window.clearInterval(timer)
      for (const event of events) window.removeEventListener(event, activity)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      channel.close()
    }
  }, [])
  return null
}
