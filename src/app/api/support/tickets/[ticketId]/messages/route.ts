import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { format } from 'date-fns'

import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  persistSupportAttachment,
  AttachmentValidationError,
  SavedSupportAttachment,
} from '@/lib/support-attachments'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const paramsResolved = await params
  const { ticketId } = paramsResolved

  const session = await getAuthSession()

  if (!session?.user?.id || session.user.accountType !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const body = formData.get('body')?.toString().trim()

  if (!body) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  const ticket = await (prisma as any).supportTicket.findFirst({
    where: {
      id: ticketId,
      requesterId: session.user.id,
    },
    include: {
      messages: {
        where: { visibility: 'public' },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  if (ticket.status === 'closed') {
    return NextResponse.json({ error: 'This ticket is closed and cannot receive new messages.' }, { status: 400 })
  }

  const messageHistory = ticket.messages
    .map((message) => {
      const authorName =
        message.author?.id === session.user!.id
          ? 'You'
          : message.author?.name || message.author?.email || 'Support team'
      const timestamp = format(message.createdAt, 'MMM d, yyyy p')
      return `On ${timestamp}, ${authorName} wrote:\n${message.body}`
    })
    .join('\n\n-----\n')

  const attachments = formData
    .getAll('attachments')
    .filter((value): value is File => value instanceof File && value.size > 0)

  try {
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const message = await tx.supportTicketMessage.create({
        data: {
          ticketId,
          authorId: session.user!.id,
          visibility: 'public',
          body: messageHistory ? `${body}\n\n-----\n${messageHistory}` : body,
        },
      })

      const nextStatus =
        ticket.status === 'pending_customer' || ticket.status === 'resolved'
          ? 'pending_support'
          : ticket.status

      if (nextStatus !== ticket.status) {
        await tx.supportTicket.update({
          where: { id: ticketId },
          data: { status: nextStatus },
        })
      }

      if (attachments.length) {
        const savedFiles: SavedSupportAttachment[] = []
        try {
          for (const file of attachments) {
            const saved = await persistSupportAttachment(ticketId, file)
            savedFiles.push(saved)
          }

          if (savedFiles.length) {
            await tx.supportMessageAttachment.createMany({
              data: savedFiles.map((file) => ({
                messageId: message.id,
                fileName: file.fileName,
                mimeType: file.mimeType ?? null,
                byteSize: BigInt(file.byteSize),
                storageUrl: file.storageUrl,
              })),
            })
          }
        } catch (error) {
          await Promise.all(
            savedFiles.map(async (file) => {
              const relativePath = file.storageUrl.replace(/^[\/]+/, '')
              const absolutePath = path.join(process.cwd(), 'public', relativePath)
              try {
                await fs.unlink(absolutePath)
              } catch {}
            })
          )
          throw error
        }
      }

      return message
    })

    logger.info('Customer replied to support ticket', {
      ticketId,
      requesterId: session.user.id,
      messageId: result.id,
    })

    return NextResponse.json({ id: result.id })
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Failed to send ticket reply', {
      ticketId,
      requesterId: session.user.id,
      error,
    })

    return NextResponse.json({ error: 'Unable to send message' }, { status: 500 })
  }
}
