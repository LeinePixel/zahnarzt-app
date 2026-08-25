'use client'

import { CircleAlert, LoaderCircle, LockKeyhole } from 'lucide-react'
import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import type { LoginErrorCode, LoginState } from '@/features/auth/actions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type LoginFormAction = (
  previousState: LoginState,
  formData: FormData,
) => Promise<LoginState>

type LoginFormProps = {
  action: LoginFormAction
}

const loginErrorMessages: Record<LoginErrorCode, string> = {
  INVALID_CREDENTIALS: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  RATE_LIMITED:
    'Zu viele Anmeldeversuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
  SERVICE_UNAVAILABLE:
    'Die Anmeldung ist derzeit nicht möglich. Bitte versuchen Sie es später erneut.',
}

const initialLoginState: LoginState = { email: '' }

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      size="lg"
      className="h-12 w-full rounded-[10px] bg-primary font-semibold shadow-sm shadow-primary/10 hover:bg-primary/90"
      disabled={pending}
      aria-label={pending ? 'Anmeldung läuft' : undefined}
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" />
          Anmeldung läuft …
        </>
      ) : (
        <>
          <LockKeyhole aria-hidden="true" />
          Sicher anmelden
        </>
      )}
    </Button>
  )
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useActionState(action, initialLoginState)
  const passwordRef = useRef<HTMLInputElement>(null)
  const emailErrors = state.fieldErrors?.email
  const passwordErrors = state.fieldErrors?.password

  useEffect(() => {
    if (passwordRef.current) {
      passwordRef.current.value = ''
    }
  }, [state])

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? (
        <Alert
          variant="destructive"
          className="border-destructive/20 bg-destructive/5 text-foreground"
        >
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{loginErrorMessages[state.error]}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          defaultValue={state.email}
          aria-invalid={emailErrors ? true : undefined}
          aria-describedby={emailErrors ? 'email-error' : undefined}
          className="h-12 rounded-[10px] bg-background/80 px-4"
        />
        {emailErrors ? (
          <div id="email-error" className="space-y-1 text-sm text-destructive">
            {emailErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={passwordErrors ? true : undefined}
          aria-describedby={passwordErrors ? 'password-error' : undefined}
          className="h-12 rounded-[10px] bg-background/80 px-4"
        />
        {passwordErrors ? (
          <div
            id="password-error"
            className="space-y-1 text-sm text-destructive"
          >
            {passwordErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  )
}
