import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'

import { MfaChallenge } from '@/components/auth/mfa-challenge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Sicherheitsprüfung' }

export default function MfaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <Card className="w-full max-w-md rounded-2xl border-border/90 bg-card/95 shadow-[0_24px_80px_-36px_hsl(var(--foreground)/0.28)]">
        <CardHeader className="space-y-3 px-6 pt-7 sm:px-9 sm:pt-9">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><ShieldCheck aria-hidden="true" className="h-5 w-5" /></div>
          <p className="text-sm font-semibold text-primary">Zusätzlicher Schutz</p>
          <h1 className="text-3xl font-bold tracking-[-0.025em]">Sicherheitsprüfung</h1>
          <p className="text-sm leading-6 text-muted-foreground">Bestätigen Sie Ihre Anmeldung mit Ihrer Authenticator-App.</p>
        </CardHeader>
        <CardContent className="px-6 pb-7 sm:px-9 sm:pb-9"><MfaChallenge /></CardContent>
      </Card>
    </main>
  )
}
