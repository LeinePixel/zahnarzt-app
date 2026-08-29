import type { Metadata } from 'next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
          <TableRow key={event.correlationId}>
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

  if (context.status !== 'portal_admin') {
    return (
      <main className="mx-auto min-h-screen max-w-6xl bg-background px-5 py-8 sm:px-8">
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
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">Audit-Einsicht</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Es werden ausschließlich freigegebene technische Audit-Metadaten angezeigt.
          </p>
        </CardHeader>
        <CardContent>{events ? <PortalAuditTable events={events} /> : <AuditDeniedState />}</CardContent>
      </Card>
    </main>
  )
}
