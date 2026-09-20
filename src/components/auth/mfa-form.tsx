'use client'

import { useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { prepareTotp, verifyTotp } from '@/features/auth/mfa'
import { createClient } from '@/lib/supabase/client'

export function MfaForm() {
  const [factorId, setFactorId] = useState<string>()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void prepareTotp({
      listFactors: () => supabase.auth.mfa.listFactors(),
      enroll: input => supabase.auth.mfa.enroll(input),
    }).then(result => {
      setFactorId(result.factorId)
      setQrCode(result.qrCode)
    }).catch(() => setError(true))
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
    const initialized = await supabase.rpc('initialize_current_session')
    if (initialized.error || initialized.data !== true) {
      await supabase.auth.signOut({ scope: 'global' })
      window.location.assign('/login')
      return
    }
    window.location.assign('/status')
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <Alert variant="destructive"><AlertDescription>Der Sicherheitscode konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.</AlertDescription></Alert> : null}
      {qrCode ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Scannen Sie diesen QR-Code einmalig mit Ihrer Authenticator-App.</p>
          {/* Supabase liefert ausschließlich den flüchtigen lokalen TOTP-QR-Inhalt. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="QR-Code für die Authenticator-App" className="mx-auto h-48 w-48" />
        </div>
      ) : <p className="text-sm text-muted-foreground">Geben Sie den aktuellen Code Ihrer Authenticator-App ein.</p>}
      <div className="space-y-2">
        <Label htmlFor="totp-code">Sicherheitscode</Label>
        <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      </div>
      <Button className="w-full" type="submit" disabled={!factorId || code.length !== 6 || pending}>{pending ? 'Code wird geprüft …' : 'Code bestätigen'}</Button>
    </form>
  )
}
