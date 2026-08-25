import { createBrowserClient } from '@supabase/ssr'

import { getPublicEnv } from '@/lib/env'

export function createClient() {
  const env = getPublicEnv({
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })

  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey)
}
