import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const updatePrioritySchema = z.object({
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await requireAdminSession()
  const paramsResolved = await params
  const { ticketId } = paramsResolved

  const body = await request.json()
  const parsed = updatePrioritySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
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
      data: { priority: parsed.data.priority },
    })

    await (prisma as any).supportTicketAudit.create({
      data: {
        ticketId,
        actorId: session.user!.id,
        action: 'priority_changed',
        oldValues: { priority: ticket.priority },
        newValues: { priority: parsed.data.priority },
      },
    })

    logger.info('Ticket priority updated', {
      ticketId,
      adminId: session.user!.id,
      oldPriority: ticket.priority,
      newPriority: parsed.data.priority,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to update ticket priority', {
      ticketId,
      error,
    })

    return NextResponse.json({ error: 'Failed to update priority' }, { status: 500 })
  }
}
