'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getVerifiedTotpFactorId, verifyTotp } from '@/features/auth/mfa'
import { createClient } from '@/lib/supabase/client'

export function ReauthForm({ returnTo }: { returnTo: string }) {
  const [factorId, setFactorId] = useState<string>()
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void getVerifiedTotpFactorId({ listFactors: () => supabase.auth.mfa.listFactors() })
      .then(setFactorId)
      .catch(() => setError(true))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!factorId || pending) return
    setPending(true)
    setError(false)
    const supabase = createClient()
    const valid = await verifyTotp({
      challenge: input => supabase.auth.mfa.challenge(input),
      verify: input => supabase.auth.mfa.verify(input),
    }, factorId, code)
    if (!valid) {
      setCode('')
      setError(true)
      setPending(false)
      return
    }
    window.location.assign(returnTo)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <Alert variant="destructive"><AlertDescription>Der Sicherheitscode konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.</AlertDescription></Alert> : null}
      <p className="text-sm text-muted-foreground">Bestätigen Sie die sensible Supportaktion erneut mit Ihrer Authenticator-App.</p>
      <div className="space-y-2">
        <Label htmlFor="reauth-totp-code">Sicherheitscode</Label>
        <Input id="reauth-totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      </div>
      <Button className="w-full" type="submit" disabled={!factorId || code.length !== 6 || pending}>{pending ? 'Code wird geprüft …' : 'Erneut bestätigen'}</Button>
    </form>
  )
}
