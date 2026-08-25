import type { Metadata } from 'next'
import Image from 'next/image'
import { Check, ShieldCheck } from 'lucide-react'

import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { login } from '@/features/auth/actions'

export const metadata: Metadata = {
  title: 'Anmelden',
  description: 'Sicher am DentPilot-Praxisarbeitsplatz anmelden.',
}

const trustPoints = [
  'Zugriff nur für autorisierte Praxismitarbeitende',
  'Geschützte, serverseitig geprüfte Sitzung',
]

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,hsl(var(--accent))_0,transparent_32%),radial-gradient(circle_at_90%_85%,hsl(var(--accent))_0,transparent_28%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -left-28 bottom-[-13rem] h-[28rem] w-[28rem] rounded-full border-[70px] border-primary/[0.04]"
      />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1280px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="login-reveal flex flex-col justify-between px-6 pb-8 pt-7 sm:px-10 lg:px-16 lg:py-14">
          <Image
            src="/dentpilot-logo-negativ.png"
            alt="DentPilot"
            width={1180}
            height={336}
            priority
            className="h-auto w-[238px] sm:w-[280px]"
          />

          <div className="hidden max-w-xl py-16 lg:block">
            <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <ShieldCheck aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-primary">
              Digitaler Praxisarbeitsplatz
            </p>
            <h2 className="max-w-lg text-balance text-4xl font-bold leading-[1.13] tracking-[-0.035em] text-foreground xl:text-5xl">
              Klarer arbeiten. Mehr Zeit für Ihre Patienten.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
              DentPilot bündelt die wichtigsten Praxisabläufe in einer ruhigen,
              verlässlichen Arbeitsumgebung.
            </p>

            <ul className="mt-9 space-y-3" aria-label="Sicherheitsmerkmale">
              {trustPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-3 text-sm font-medium text-foreground/80"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <p className="hidden text-xs leading-5 text-muted-foreground lg:block">
            DentPilot · Smarter Dentistry. Simplified.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 pb-10 sm:px-10 lg:py-12">
          <Card className="login-reveal w-full max-w-[460px] rounded-2xl border-border/90 bg-card/95 shadow-[0_24px_80px_-36px_hsl(var(--foreground)/0.28)] backdrop-blur-sm [animation-delay:80ms]">
            <CardHeader className="space-y-3 px-6 pb-7 pt-7 sm:px-9 sm:pt-9">
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground lg:hidden">
                <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-primary">Willkommen zurück</p>
              <h1 className="text-3xl font-bold tracking-[-0.025em]">
                Bei DentPilot anmelden
              </h1>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Verwenden Sie die Zugangsdaten, die Sie von Ihrer Praxis erhalten
                haben.
              </p>
            </CardHeader>
            <CardContent className="px-6 pb-7 sm:px-9 sm:pb-9">
              <LoginForm action={login} />
              <div className="mt-7 border-t border-border pt-5">
                <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  />
                  Melden Sie sich nur an einem vertrauenswürdigen Praxisgerät an und
                  geben Sie Ihre Zugangsdaten niemals weiter.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
