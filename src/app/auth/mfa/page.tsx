import { redirect } from 'next/navigation'

import { MfaForm } from '@/components/auth/mfa-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function MfaPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims.sub) redirect('/login')
  if (data.claims.aal === 'aal2') redirect('/status')

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Zweiten Faktor bestätigen</CardTitle></CardHeader>
        <CardContent><MfaForm /></CardContent>
      </Card>
    </main>
  )
}
