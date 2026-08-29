'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'

import {
  initialSupportAccessFormState,
  requestSupportAccessFormAction,
  revokeSupportAccessFormAction,
} from './support-access-actions'

export function SupportAccessControls() {
  const [requestState, requestAction] = useActionState(
    requestSupportAccessFormAction,
    initialSupportAccessFormState,
  )
  const [revokeState, revokeAction] = useActionState(
    revokeSupportAccessFormAction,
    initialSupportAccessFormState,
  )

  return (
    <div className="mt-4 grid gap-4">
      <form action={requestAction}>
        <Button type="submit">Supportzugriff anfordern</Button>
      </form>
      {requestState.grantId ? (
        <output className="rounded-md border border-border bg-background p-3 text-sm" aria-live="polite">
          Freigabekennung: <code>{requestState.grantId}</code>
        </output>
      ) : null}
      <form action={revokeAction} className="flex max-w-xl gap-3">
        <label className="sr-only" htmlFor="revoke-grant-id">
          Freigabekennung widerrufen
        </label>
        <input
          id="revoke-grant-id"
          name="grantId"
          required
          type="text"
          defaultValue={requestState.grantId ?? ''}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="Freigabekennung"
        />
        <Button type="submit" variant="outline">
          Supportzugriff widerrufen
        </Button>
      </form>
      {requestState.message || revokeState.message ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {requestState.message ?? revokeState.message}
        </p>
      ) : null}
    </div>
  )
}
