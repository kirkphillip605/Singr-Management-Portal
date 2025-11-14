import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const updateStatusSchema = z.object({
  status: z.enum(['open', 'pending_support', 'pending_customer', 'resolved', 'closed']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await requireAdminSession()
  const paramsResolved = await params
  const { ticketId } = paramsResolved

  const body = await request.json()
  const parsed = updateStatusSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    const ticket = await (prisma as any).supportTicket.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    await (prisma as any).supportTicket.update({
      where: { id: ticketId },
      data: { 
        status: parsed.data.status,
        closedAt: parsed.data.status === 'closed' ? new Date() : null,
      },
    })

    await (prisma as any).supportTicketAudit.create({
      data: {
        ticketId,
        actorId: session.user!.id,
        action: 'status_changed',
        oldValues: { status: ticket.status },
        newValues: { status: parsed.data.status },
      },
    })

    logger.info('Ticket status updated', {
      ticketId,
      adminId: session.user!.id,
      oldStatus: ticket.status,
      newStatus: parsed.data.status,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to update ticket status', {
      ticketId,
      error,
    })

    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
