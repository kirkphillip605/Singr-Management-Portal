import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, ArrowUpRight } from 'lucide-react'

import {
  SupportTicketStatusBadge,
  type TicketStatus,
} from '@/components/support/support-ticket-status-badge'
import {
  SupportTicketPriorityBadge,
  type TicketPriority,
} from '@/components/support/support-ticket-priority-badge'
import { Badge } from '@/components/ui/badge'

type TicketListItem = {
  id: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  createdAt: Date
  updatedAt: Date
  messageCount: number
  lastMessageAt?: Date | null
  lastMessageAuthorId?: string | null
  assigneeName?: string | null
}

type SupportTicketListProps = {
  tickets: TicketListItem[]
  currentUserId: string
}

export function SupportTicketList({ tickets, currentUserId }: SupportTicketListProps) {
  if (!tickets.length) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        You haven’t created any support tickets yet. Submit a request using the form above to get started.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Priority
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Last update
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Messages
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assignee
            </th>
            <th className="px-4 py-3 text-xs" aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-white">
          {tickets.map((ticket) => {
            const hasNewMessage =
              ticket.lastMessageAuthorId && ticket.lastMessageAuthorId !== currentUserId
            const lastUpdateLabel = formatDistanceToNow(ticket.updatedAt, { addSuffix: true })
            const messageLabel = `${ticket.messageCount} ${ticket.messageCount === 1 ? 'message' : 'messages'}`

            return (
              <tr key={ticket.id} className="text-sm">
                <td className="max-w-[320px] px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/dashboard/support/${ticket.id}`}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {ticket.subject}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Opened {formatDistanceToNow(ticket.createdAt, { addSuffix: true })}</span>
                      {hasNewMessage ? (
                        <Badge variant="destructive" className="uppercase tracking-wide">
                          New response
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <SupportTicketStatusBadge status={ticket.status} />
                </td>
                <td className="px-4 py-4">
                  <SupportTicketPriorityBadge priority={ticket.priority} />
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">{lastUpdateLabel}</td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  <div className="inline-flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    {messageLabel}
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {ticket.assigneeName ? ticket.assigneeName : 'Unassigned'}
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={`/dashboard/support/${ticket.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

SupportTicketList.displayName = 'SupportTicketList'
