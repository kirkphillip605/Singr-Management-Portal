export const runtime = 'nodejs'

import { redirect } from 'next/navigation'
import { LifeBuoy, Inbox, Clock, CheckCircle2, Archive, type LucideIcon } from 'lucide-react'

import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SupportTicketCreateForm } from '@/components/support/support-ticket-create-form'
import { SupportTicketList } from '@/components/support/support-ticket-list'
import type { TicketStatus } from '@/components/support/support-ticket-status-badge'

const STATUS_SUMMARY: Array<{
  id: string
  label: string
  description: string
  icon: LucideIcon
  statuses: TicketStatus[]
}> = [
  {
    id: 'open',
    label: 'Open',
    description: 'Newly created tickets awaiting triage.',
    icon: LifeBuoy,
    statuses: ['open'],
  },
  {
    id: 'pending_support',
    label: 'Waiting on support',
    description: 'Our team is reviewing these tickets.',
    icon: Inbox,
    statuses: ['pending_support'],
  },
  {
    id: 'pending_customer',
    label: 'Waiting on you',
    description: 'We need your reply to move forward.',
    icon: Clock,
    statuses: ['pending_customer'],
  },
  {
    id: 'resolved',
    label: 'Resolved',
    description: 'Marked as solved but not yet archived.',
    icon: CheckCircle2,
    statuses: ['resolved'],
  },
  {
    id: 'closed',
    label: 'Closed',
    description: 'Fully closed tickets for historical reference.',
    icon: Archive,
    statuses: ['closed'],
  },
]

export default async function SupportDashboardPage() {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  if (session.user.accountType && session.user.accountType !== 'customer') {
    redirect('/admin')
  }

  const userId = session.user.id

  const [tickets, groupedCounts] = await Promise.all([
    (prisma as any).supportTicket.findMany({
      where: { requesterId: userId },
      include: {
        assignee: {
          select: {
            name: true,
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
    }),
    (prisma as any).supportTicket.groupBy({
      by: ['status'],
      where: { requesterId: userId },
      _count: {
        _all: true,
      },
    }),
  ])

  const countByStatus = new Map<TicketStatus, number>(groupedCounts.map((item: any) => [item.status, item._count._all]))

  const summaryCards = STATUS_SUMMARY.map((card) => ({
    ...card,
    value: card.statuses.reduce((total, status) => total + (countByStatus.get(status) ?? 0), 0),
  }))

  const ticketRows = tickets.map((ticket: any) => ({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messageCount: ticket._count.messages,
    lastMessageAt: ticket.messages[0]?.createdAt ?? null,
    lastMessageAuthorId: ticket.messages[0]?.authorId ?? null,
    assigneeName: ticket.assignee?.name ?? null,
  }))

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Support center</h1>
        <p className="text-muted-foreground">
          Create new requests, review existing tickets, and collaborate with the Singr support team.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.id} className="border border-dashed">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                  <CardDescription className="text-xs">{card.description}</CardDescription>
                </div>
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.55fr_0.45fr]">
        <Card className="order-last border border-border/70 lg:order-first">
          <CardHeader>
            <CardTitle>Submit a support request</CardTitle>
            <CardDescription>
              Provide as much detail as possible—attachments and clear descriptions help us respond quickly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SupportTicketCreateForm />
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-muted/20">
          <CardHeader>
            <CardTitle>Need immediate help?</CardTitle>
            <CardDescription>
              Search our knowledge base or call the Singr support line for urgent production incidents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              • Visit the <a href="https://support.singr.io" className="font-medium text-primary hover:underline">support
              documentation</a> for setup guides, FAQs, and troubleshooting steps.
            </p>
            <p>• Call our emergency hotline at <span className="font-medium text-foreground">(800) 555-0199</span>.</p>
            <p>• Email <span className="font-medium text-foreground">support@singr.io</span> for billing or account changes.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Your tickets</h2>
          <p className="text-sm text-muted-foreground">
            Track the progress of open issues, follow up on pending conversations, and review past resolutions.
          </p>
        </div>
        <SupportTicketList tickets={ticketRows} currentUserId={userId} />
      </section>
    </div>
  )
}
