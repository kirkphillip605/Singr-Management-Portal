'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type AuditRecord = {
  id: string
  ticketId: string
  actorId: string
  action: string
  oldValues: any
  newValues: any
  createdAt: Date
  actor: {
    id: string
    name: string | null
    email: string | null
  }
}

type TicketAuditTrailProps = {
  audits: AuditRecord[]
}

function formatJsonForDisplay(data: any): string {
  if (!data) return 'null'
  return JSON.stringify(data, null, 2)
}

function getActionBadgeVariant(action: string) {
  switch (action) {
    case 'created':
      return 'default'
    case 'status_changed':
      return 'secondary'
    case 'priority_changed':
      return 'outline'
    case 'assignee_changed':
      return 'outline'
    case 'message_added':
    case 'internal_note_added':
      return 'secondary'
    default:
      return 'outline'
  }
}

function getActionLabel(action: string): string {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function TicketAuditTrail({ audits }: TicketAuditTrailProps) {
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null)

  if (!audits || audits.length === 0) {
    return (
      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>All changes to this ticket are tracked here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No audit records available.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>All changes to this ticket are tracked here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium text-muted-foreground">ID</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">Actor</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">Action</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => {
                  const actorName = audit.actor.name || audit.actor.email || 'Unknown'
                  const timestamp = format(new Date(audit.createdAt), 'MMM d, yyyy p')

                  return (
                    <tr key={audit.id} className="border-b last:border-0">
                      <td className="py-2">
                        <button
                          onClick={() => setSelectedAudit(audit)}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {audit.id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="py-2">{actorName}</td>
                      <td className="py-2">
                        <Badge variant={getActionBadgeVariant(audit.action)}>
                          {getActionLabel(audit.action)}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{timestamp}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={selectedAudit !== null} onOpenChange={(open) => !open && setSelectedAudit(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Record Details</DialogTitle>
            <DialogDescription>
              ID: {selectedAudit?.id} • Action: {selectedAudit ? getActionLabel(selectedAudit.action) : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedAudit && (
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Actor</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedAudit.actor.name || selectedAudit.actor.email || 'Unknown'}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Timestamp</h3>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedAudit.createdAt), 'MMMM d, yyyy h:mm:ss a')}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Old Values</h3>
                <pre className="rounded-md bg-muted p-4 text-xs overflow-x-auto">
                  <code>{formatJsonForDisplay(selectedAudit.oldValues)}</code>
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">New Values</h3>
                <pre className="rounded-md bg-muted p-4 text-xs overflow-x-auto">
                  <code>{formatJsonForDisplay(selectedAudit.newValues)}</code>
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
