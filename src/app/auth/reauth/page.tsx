import { redirect } from 'next/navigation'
import { ReauthForm } from '@/components/auth/reauth-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { safeReauthenticationTarget } from '@/features/auth/reauth'
import { hasRecentTotpAuthenticationNow } from '@/features/auth/reauth-server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ReauthenticationPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims.sub) redirect('/login')
  if (data.claims.aal !== 'aal2') redirect('/auth/mfa')
  const parameters = await searchParams
  const returnTo = safeReauthenticationTarget(typeof parameters.next === 'string' ? parameters.next : undefined)
  if (hasRecentTotpAuthenticationNow(data.claims)) redirect(returnTo)

  return <main className="flex min-h-screen items-center justify-center bg-background px-5"><Card className="w-full max-w-md"><CardHeader><CardTitle>Supportaktion erneut bestätigen</CardTitle></CardHeader><CardContent><ReauthForm returnTo={returnTo} /></CardContent></Card></main>
}
