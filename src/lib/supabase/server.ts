import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getPublicEnv } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  const env = getPublicEnv()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options)
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes them.
        }
      },
    },
  })
}
