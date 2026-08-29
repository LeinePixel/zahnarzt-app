import type { Metadata } from 'next'
import Image from 'next/image'
import { Building2, CircleCheck, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react'

import { LogoutButton } from '@/components/auth/logout-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCurrentUserContext, logout } from '@/features/auth/current-user'

import { requestSupportAccessForCurrentPractice } from './support-access-actions'

export const metadata: Metadata = {
  title: 'Kontostatus',
  description: 'Ihr sicherer DentPilot-Kontostatus.',
}

export const dynamic = 'force-dynamic'

export default async function StatusPage() {
  const context = await getCurrentUserContext()

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-5 py-6 sm:px-8 sm:py-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,hsl(var(--accent))_0,transparent_30%),radial-gradient(circle_at_92%_88%,hsl(var(--accent))_0,transparent_26%)]"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between gap-5">
          <Image
            src="/dentpilot-logo-negativ.png"
            alt="DentPilot"
            width={1180}
            height={336}
            priority
            className="h-auto w-[190px] sm:w-[230px]"
          />
          <LogoutButton action={logout} />
        </header>

        <section className="login-reveal flex flex-1 items-center justify-center py-10 sm:py-14">
          {context.status === 'ready' ? (
            <Card className="w-full max-w-3xl overflow-hidden rounded-2xl border-border/90 bg-card/95 shadow-[0_24px_80px_-38px_hsl(var(--foreground)/0.26)] backdrop-blur-sm">
              <div className="h-1.5 bg-primary" />
              <CardHeader className="space-y-4 border-b border-border px-6 py-7 sm:px-9 sm:py-9">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <CircleCheck aria-hidden="true" className="h-4 w-4" />
                  Sicher angemeldet
                </div>
                <h1 className="text-balance text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                  Willkommen, {context.displayName}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Ihre Identität und Praxiszuordnung wurden serverseitig geprüft.
                </p>
              </CardHeader>

              <CardContent className="grid gap-4 px-6 py-7 sm:grid-cols-2 sm:px-9 sm:py-9">
                <div className="rounded-xl border border-border bg-secondary/70 p-5">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <UserRound aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Ihre Rolle
                  </p>
                  <div className="mt-2">
                    <Badge className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/10">
                      {context.roleLabel}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-secondary/70 p-5">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Building2 aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Praxis
                  </p>
                  <p className="mt-2 text-lg font-semibold">{context.practiceName}</p>
                </div>

                {context.role === 'praxisadmin' ? (
                  <div className="rounded-xl border border-border bg-secondary/70 p-5 sm:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Technischer Supportzugriff
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Eine Freigabe gilt standardmäßig acht Stunden und kann
                      jederzeit durch Ihre Praxisadministration widerrufen werden.
                    </p>
                    <form action={requestSupportAccessForCurrentPractice} className="mt-4">
                      <Button type="submit">Supportzugriff anfordern</Button>
                    </form>
                  </div>
                ) : null}

                <p className="flex items-start gap-2 pt-2 text-xs leading-5 text-muted-foreground sm:col-span-2">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  />
                  Aus Datenschutzgründen zeigt diese Statusseite ausschließlich
                  Ihren Kontokontext und keine Patienten- oder Gesundheitsdaten.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full max-w-xl rounded-2xl border-border/90 bg-card/95 shadow-[0_24px_80px_-38px_hsl(var(--foreground)/0.26)] backdrop-blur-sm">
              <CardContent className="p-6 sm:p-9">
                <Alert className="border-amber-500/25 bg-amber-50 text-foreground">
                  <TriangleAlert
                    aria-hidden="true"
                    className="text-amber-700"
                  />
                  <AlertTitle className="text-base">
                    Konto unvollständig eingerichtet
                  </AlertTitle>
                  <AlertDescription className="mt-2 leading-6 text-muted-foreground">
                    Für dieses Anmeldekonto fehlt noch die Zuordnung zu einer Praxis.
                    Bitte wenden Sie sich an Ihre Praxisadministration.
                  </AlertDescription>
                </Alert>
                <p className="mt-5 text-xs leading-5 text-muted-foreground">
                  Es wurden keine Praxis- oder Patientendaten geladen.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <footer className="text-center text-xs text-muted-foreground">
          DentPilot · Geschützter Praxisarbeitsplatz
        </footer>
      </div>
    </main>
  )
}
