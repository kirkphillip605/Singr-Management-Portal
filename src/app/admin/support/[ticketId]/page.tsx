export const runtime = 'nodejs'

import { notFound, redirect } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SupportTicketStatusBadge } from '@/components/support/support-ticket-status-badge'
import { SupportTicketPriorityBadge } from '@/components/support/support-ticket-priority-badge'
import { SupportTicketMessageThread } from '@/components/support/support-ticket-message-thread'
import { AdminTicketActions } from '@/components/admin/admin-ticket-actions'
import { AdminTicketReplyForm } from '@/components/admin/admin-ticket-reply-form'

type PageProps = {
  params: Promise<{ ticketId: string }>
}

export default async function AdminSupportTicketDetailPage({ params }: PageProps) {
  const session = await requireAdminSession()
  const paramsResolved = await params
  const { ticketId } = paramsResolved

  const ticket = await (prisma as any).supportTicket.findFirst({
    where: {
      id: ticketId,
    },
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      creator: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  if (!ticket) {
    notFound()
  }

  const messages = await (prisma as any).supportTicketMessage.findMany({
    where: {
      ticketId,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          accountType: true,
        },
      },
      attachments: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          byteSize: true,
          storageUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const adminUsers = await prisma.user.findMany({
    where: {
      accountType: {
        in: ['admin', 'support'],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: 'asc' },
  })

  const isClosed = ticket.status === 'closed'
  const openedAt = format(ticket.createdAt, 'MMM d, yyyy p')
  const lastUpdated = formatDistanceToNow(ticket.updatedAt, { addSuffix: true })
  const assignee = ticket.assignee?.name || ticket.assignee?.email || 'Unassigned'
  const requester = ticket.requester?.name || ticket.requester?.email || 'Unknown'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Button asChild variant="ghost" className="w-fit gap-2 text-sm text-muted-foreground">
          <Link href="/admin/support">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to tickets
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <SupportTicketStatusBadge status={ticket.status} />
          <SupportTicketPriorityBadge priority={ticket.priority} />
          {ticket.category ? <Badge variant="outline">{ticket.category}</Badge> : null}
        </div>
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold break-words">{ticket.subject}</h1>
        <p className="text-muted-foreground">
          Ticket #{ticket.id.slice(0, 8)} • Opened {openedAt} • Last updated {lastUpdated}
        </p>
      </header>

      {isClosed ? (
        <Alert>
          <AlertDescription>
            This ticket has been closed. You can reopen it or review past messages below.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
        <Card className="order-last border border-border/70 lg:order-first">
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>All messages and file attachments for this ticket.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SupportTicketMessageThread 
              currentUserId={session.user!.id} 
              messages={messages}
              showInternal={true}
            />
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <AdminTicketReplyForm ticketId={ticket.id} disabled={false} />
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border/70 bg-muted/10">
            <CardHeader>
              <CardTitle>Ticket details</CardTitle>
              <CardDescription>Metadata and assignment information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Requester</span>
                <Link 
                  href={`/admin/users/${ticket.requester.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {requester}
                </Link>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Assigned to</span>
                <span className="font-medium text-foreground">{assignee}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Opened</span>
                <span className="font-medium text-foreground">{openedAt}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Current status</span>
                <span className="font-medium text-foreground capitalize">{ticket.status.replace('_', ' ')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Priority</span>
                <span className="font-medium text-foreground capitalize">{ticket.priority}</span>
              </div>
              {ticket.externalReference ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">External reference</span>
                  <span className="font-medium text-foreground">{ticket.externalReference}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <AdminTicketActions 
            ticketId={ticket.id}
            currentStatus={ticket.status}
            currentPriority={ticket.priority}
            currentAssigneeId={ticket.assignee?.id || null}
            adminUsers={adminUsers}
          />
        </div>
      </section>
    </div>
  )
}
