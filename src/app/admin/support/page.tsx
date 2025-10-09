export const runtime = 'nodejs'

import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { LifeBuoy, Inbox, Clock, CheckCircle2, Archive, AlertTriangle } from 'lucide-react'
import type { TicketStatus } from '@/components/support/support-ticket-status-badge'

export default async function AdminSupportPage() {
  await requireAdminSession()

  const [tickets, groupedCounts] = await Promise.all([
    (prisma as any).supportTicket.findMany({
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
        messages: {
          where: { visibility: 'public' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            authorId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    (prisma as any).supportTicket.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    }),
  ])

  const countByStatus = new Map<TicketStatus, number>(
    groupedCounts.map((item: any) => [item.status, item._count._all])
  )

  const statusCards = [
    {
      id: 'open',
      label: 'Open',
      count: countByStatus.get('open') ?? 0,
      icon: LifeBuoy,
      color: 'text-blue-500',
    },
    {
      id: 'pending_support',
      label: 'Pending Support',
      count: countByStatus.get('pending_support') ?? 0,
      icon: Inbox,
      color: 'text-yellow-500',
    },
    {
      id: 'pending_customer',
      label: 'Pending Customer',
      count: countByStatus.get('pending_customer') ?? 0,
      icon: Clock,
      color: 'text-orange-500',
    },
    {
      id: 'resolved',
      label: 'Resolved',
      count: countByStatus.get('resolved') ?? 0,
      icon: CheckCircle2,
      color: 'text-green-500',
    },
    {
      id: 'closed',
      label: 'Closed',
      count: countByStatus.get('closed') ?? 0,
      icon: Archive,
      color: 'text-gray-500',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Support Tickets</h1>
        <p className="text-muted-foreground">
          Manage customer support requests and respond to inquiries
        </p>
      </header>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-5">
        {statusCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.count}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tickets</CardTitle>
          <CardDescription>
            All support tickets sorted by most recently updated
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <LifeBuoy className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No support tickets</h3>
              <p className="text-muted-foreground">
                Support tickets will appear here when customers submit requests
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket: any) => {
                const lastMessage = ticket.messages[0]
                const timeAgo = formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })
                const requesterName = ticket.requester?.name || ticket.requester?.email || 'Unknown'
                const assigneeName = ticket.assignee?.name || ticket.assignee?.email || 'Unassigned'
                const isUrgent = ticket.priority === 'urgent' || ticket.priority === 'high'

                return (
                  <Link
                    key={ticket.id}
                    href={`/admin/support/${ticket.id}`}
                    className="block"
                  >
                    <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {isUrgent && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <h3 className="font-semibold">{ticket.subject}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>From: {requesterName}</span>
                          <span>•</span>
                          <span>Assigned: {assigneeName}</span>
                          <span>•</span>
                          <span>{ticket._count.messages} messages</span>
                          <span>•</span>
                          <span>{timeAgo}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge
                          variant={
                            ticket.status === 'open'
                              ? 'default'
                              : ticket.status === 'resolved'
                              ? 'outline'
                              : ticket.status === 'closed'
                              ? 'secondary'
                              : 'secondary'
                          }
                        >
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                        {ticket.priority !== 'normal' && (
                          <Badge
                            variant={
                              ticket.priority === 'urgent' || ticket.priority === 'high'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {ticket.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
