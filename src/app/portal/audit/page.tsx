import type { Metadata } from 'next'

import { SessionLock } from '@/components/auth/session-lock'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCurrentUserContext } from '@/features/auth/current-user'
import {
  readAuditEvents,
  type AuditEvent,
  type AuditReadRpcClient,
} from '@/features/audit/read-events'
import { createClient } from '@/lib/supabase/server'

import { activateSupportAccessForCurrentPortal } from './support-access-actions'

export const metadata: Metadata = {
  title: 'Audit-Einsicht',
  description: 'Zeitlich begrenzte Einsicht in freigegebene Audit-Metadaten.',
}

export const dynamic = 'force-dynamic'

type PortalAuditPageProps = {
  searchParams: Promise<{ practiceId?: string | string[] }>
}

function AuditDeniedState() {
  return (
    <Alert>
      <AlertTitle>Audit-Zugriff wurde verweigert.</AlertTitle>
      <AlertDescription>
        Es werden keine Audit-Ereignisse angezeigt.
      </AlertDescription>
    </Alert>
  )
}

function SupportActivationForm() {
  return (
    <form action={activateSupportAccessForCurrentPortal} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <label htmlFor="grant-id">Freigabekennung</label>
        <input
          id="grant-id"
          name="grantId"
          required
          type="text"
          className="rounded-md border border-input bg-background px-3 py-2"
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="support-reason">Supportgrund</label>
        <select
          id="support-reason"
          name="reason"
          defaultValue="technical_investigation"
          className="rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="technical_investigation">Technische Untersuchung</option>
          <option value="account_support">Kontounterstützung</option>
        </select>
      </div>
      <Button type="submit">Supportzugriff aktivieren</Button>
    </form>
  )
}

export function PortalAuditTable({ events }: { events: AuditEvent[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Akteur</TableHead>
          <TableHead>Zeit</TableHead>
          <TableHead>Aktion</TableHead>
          <TableHead>Ergebnis</TableHead>
          <TableHead>Objekt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell>{event.actorType}</TableCell>
            <TableCell>{new Date(event.occurredAt).toLocaleString('de-DE')}</TableCell>
            <TableCell>{event.action}</TableCell>
            <TableCell>{event.outcome}</TableCell>
            <TableCell>
              {event.resourceType} · {event.resourceId ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default async function PortalAuditPage({
  searchParams,
}: PortalAuditPageProps) {
  const context = await getCurrentUserContext()
  const parameters = await searchParams
  const practiceId =
    typeof parameters.practiceId === 'string' ? parameters.practiceId : ''

  if (context.status === 'ready') {
    try {
      const client = (await createClient()) as AuditReadRpcClient
      await readAuditEvents(
        client,
        {
          kind: 'practice_member',
          userId: context.userId,
          practiceId: context.practiceId,
          role: context.role,
        },
        { practiceId: context.practiceId },
      )
    } catch {
      // The database records the denial; the page intentionally stays neutral.
    }

    return (
      <main className="mx-auto min-h-screen max-w-6xl bg-background px-5 py-8 sm:px-8">
        <SessionLock />
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold">Audit-Einsicht</h1>
          </CardHeader>
          <CardContent>
            <AuditDeniedState />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (context.status === 'incomplete') {
    try {
      const client = await createClient()
      await client.rpc('read_audit_events', {
        p_before: new Date().toISOString(),
        p_limit: 1,
        p_practice_id: null,
      })
    } catch {
      // The response remains neutral even if the durable denial path is unavailable.
    }
  }

  if (context.status !== 'portal_admin') {
    return (
      <main className="mx-auto min-h-screen max-w-6xl bg-background px-5 py-8 sm:px-8">
        <SessionLock />
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold">Audit-Einsicht</h1>
          </CardHeader>
          <CardContent>
            <AuditDeniedState />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!practiceId) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl bg-background px-5 py-8 sm:px-8">
        <SessionLock />
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold">Audit-Einsicht</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Aktivieren Sie eine im Supportfall übermittelte Freigabekennung.
              Das Portal listet oder sucht keine Praxen und keine Freigaben.
            </p>
          </CardHeader>
          <CardContent>
            <SupportActivationForm />
          </CardContent>
        </Card>
      </main>
    )
  }

  let events: AuditEvent[] | null = null

  try {
    const client = (await createClient()) as AuditReadRpcClient
    events = await readAuditEvents(
      client,
      { kind: 'portal_admin', userId: context.userId },
      { practiceId },
    )
  } catch {
    events = null
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-background px-5 py-8 sm:px-8">
      <SessionLock />
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">Audit-Einsicht</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Es werden ausschließlich freigegebene technische Audit-Metadaten angezeigt.
          </p>
        </CardHeader>
        <CardContent>
          {events ? <PortalAuditTable events={events} /> : <AuditDeniedState />}
        </CardContent>
      </Card>
    </main>
  )
}
