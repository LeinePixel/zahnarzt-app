'use client'

import { CircleAlert, LoaderCircle, ScanLine, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  completeTotpChallenge,
  prepareTotpChallenge,
  type TotpPreparation,
} from '@/features/auth/mfa-flow'
import {
  createBrowserTotpClient,
  establishSessionState,
} from '@/features/auth/browser-session-client'

type MfaChallengeProps = {
  reauthentication?: boolean
}

export function MfaChallenge({ reauthentication = false }: MfaChallengeProps) {
  const router = useRouter()
  const [preparation, setPreparation] = useState<TotpPreparation | null>(null)
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    let active = true

    void prepareTotpChallenge(createBrowserTotpClient(), {
      allowEnrollment: !reauthentication,
    }).then((result) => {
      if (active) setPreparation(result)
    })

    return () => {
      active = false
    }
  }, [reauthentication])

  if (!preparation) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        Sicherheitsprüfung wird vorbereitet …
      </p>
    )
  }

  if (preparation.mode === 'unavailable') {
    return (
      <Alert className="border-amber-500/25 bg-amber-50 text-foreground">
        <CircleAlert aria-hidden="true" className="text-amber-700" />
        <AlertDescription>
          Die Sicherheitsprüfung kann derzeit nicht abgeschlossen werden. Bitte
          wenden Sie sich an den Support.
        </AlertDescription>
      </Alert>
    )
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setShowError(false)

    const result = await completeTotpChallenge(
      { factorId: preparation.factorId, verificationCode: code },
      createBrowserTotpClient(),
      establishSessionState,
    )

    setCode('')
    setIsSubmitting(false)

    if (result.status !== 'ready') {
      setShowError(true)
      return
    }

    router.refresh()
    router.replace('/status')
  }

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      {preparation.mode === 'enroll' ? (
        <div className="rounded-xl border border-border bg-secondary/60 p-4">
          <div className="flex items-start gap-3">
            <ScanLine aria-hidden="true" className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Authenticator-App einrichten</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Scannen Sie diesen QR-Code mit Ihrer Authenticator-App. Er wird
                nur während dieser Einrichtung angezeigt.
              </p>
            </div>
          </div>
          {/* The provider returns an in-memory data image; Next image optimization must not persist it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preparation.qrCode}
            alt="QR-Code zur Einrichtung der Authenticator-App"
            className="mx-auto mt-4 h-44 w-44 rounded-lg bg-white p-2"
          />
        </div>
      ) : null}

      {showError ? (
        <Alert variant="destructive" className="border-destructive/20 bg-destructive/5 text-foreground">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>
            Die Sicherheitsprüfung konnte nicht bestätigt werden. Bitte
            versuchen Sie es erneut.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="totp-code">Code aus der Authenticator-App</Label>
        <Input
          id="totp-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="h-12 rounded-[10px] bg-background/80 px-4 tracking-[0.35em]"
          aria-describedby="totp-help"
        />
        <p id="totp-help" className="text-xs leading-5 text-muted-foreground">
          Geben Sie den sechsstelligen, zeitbasierten Code ein.
        </p>
      </div>
      <Button type="submit" size="lg" className="h-12 w-full rounded-[10px]" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ShieldCheck aria-hidden="true" />}
        Sicherheitsprüfung bestätigen
      </Button>
    </form>
  )
}
