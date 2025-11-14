import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const updateAssigneeSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const session = await requireAdminSession()
  const paramsResolved = await params
  const { ticketId } = paramsResolved

  const body = await request.json()
  const parsed = updateAssigneeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid assignee ID' }, { status: 400 })
  }

  try {
    const ticket = await (prisma as any).supportTicket.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (parsed.data.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: parsed.data.assigneeId },
      })

      if (!assignee || (assignee.accountType !== 'admin' && assignee.accountType !== 'support')) {
        return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 })
      }
    }

    await (prisma as any).supportTicket.update({
      where: { id: ticketId },
      data: { assigneeId: parsed.data.assigneeId },
    })

    await (prisma as any).supportTicketAudit.create({
      data: {
        ticketId,
        actorId: session.user!.id,
        action: 'assignee_changed',
        oldValues: { assigneeId: ticket.assigneeId },
        newValues: { assigneeId: parsed.data.assigneeId },
      },
    })

    logger.info('Ticket assignee updated', {
      ticketId,
      adminId: session.user!.id,
      oldAssigneeId: ticket.assigneeId,
      newAssigneeId: parsed.data.assigneeId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to update ticket assignee', {
      ticketId,
      error,
    })

    return NextResponse.json({ error: 'Failed to update assignee' }, { status: 500 })
  }
}
