export const runtime = 'nodejs'

import { notFound, redirect } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { ArrowLeft, MessageCirclePlus } from 'lucide-react'
import Link from 'next/link'

import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SupportTicketStatusBadge } from '@/components/support/support-ticket-status-badge'
import { SupportTicketPriorityBadge } from '@/components/support/support-ticket-priority-badge'
import { SupportTicketMessageThread } from '@/components/support/support-ticket-message-thread'
import { SupportTicketReplyForm } from '@/components/support/support-ticket-reply-form'

type PageProps = {
  params: Promise<{ ticketId: string }>
}

export default async function SupportTicketDetailPage({ params }: PageProps) {
  const paramsResolved = await params
  const { ticketId } = paramsResolved

  const session = await getAuthSession()

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  if (session.user.accountType && session.user.accountType !== 'customer') {
    redirect('/admin')
  }

  const ticket = await (prisma as any).supportTicket.findFirst({
    where: {
      id: ticketId,
      requesterId: session.user.id,
    },
    include: {
      assignee: {
        select: {
          name: true,
          email: true,
        },
      },
      requester: {
        select: {
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
      visibility: 'public',
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
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

  const isClosed = ticket.status === 'closed'
  const openedAt = format(ticket.createdAt, 'MMM d, yyyy p')
  const lastUpdated = formatDistanceToNow(ticket.updatedAt, { addSuffix: true })
  const assignee = ticket.assignee?.name || ticket.assignee?.email || 'Unassigned'
  const requester = ticket.requester?.name || ticket.requester?.email || 'You'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Button asChild variant="ghost" className="w-fit gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/support">
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
            This ticket has been closed. You can review past messages below or open a new ticket if you need further
            assistance.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
        <Card className="order-last border border-border/70 lg:order-first">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCirclePlus className="h-5 w-5 text-primary" aria-hidden="true" /> Conversation
            </CardTitle>
            <CardDescription>All customer-visible messages and file attachments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SupportTicketMessageThread currentUserId={session.user.id} messages={messages} />
            <div className="rounded-md border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              Internal notes from the support team are hidden from this view. Replies you send are always public to our team.
            </div>
          </CardContent>
          <CardFooter>
            <SupportTicketReplyForm ticketId={ticket.id} disabled={isClosed} />
          </CardFooter>
        </Card>

        <Card className="border border-border/70 bg-muted/10">
          <CardHeader>
            <CardTitle>Ticket details</CardTitle>
            <CardDescription>Key metadata to help you track this request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Requester</span>
              <span className="font-medium text-foreground">{requester}</span>
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
            {ticket.externalReference ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">External reference</span>
                <span className="font-medium text-foreground">{ticket.externalReference}</span>
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            <div className="text-xs text-muted-foreground">
              Created by {ticket.creator?.name || ticket.creator?.email || 'Support'} on{' '}
              {format(ticket.createdAt, 'MMM d, yyyy p')}.
            </div>
          </CardFooter>
        </Card>
      </section>
    </div>
  )
}
