import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { format } from 'date-fns'

import { requireAdminSession } from '@/lib/admin-auth'
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
  const session = await requireAdminSession()
  const paramsResolved = await params
  const { ticketId } = paramsResolved

  const formData = await request.formData()
  const body = formData.get('body')?.toString().trim()
  const visibility = formData.get('visibility')?.toString() as 'public' | 'internal' || 'public'

  if (!body) {
    return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
  }

  if (visibility !== 'public' && visibility !== 'internal') {
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
  }

  const ticket = await (prisma as any).supportTicket.findFirst({
    where: { id: ticketId },
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

  const messageHistory = ticket.messages
    .map((message: any) => {
      const authorName =
        message.author?.id === session.user!.id
          ? 'You'
          : message.author?.name || message.author?.email || 'Customer'
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
          visibility,
          body: messageHistory && visibility === 'public' ? `${body}\n\n-----\n${messageHistory}` : body,
        },
      })

      // Update ticket status based on visibility
      if (visibility === 'public') {
        const nextStatus =
          ticket.status === 'open' || ticket.status === 'pending_support'
            ? 'pending_customer'
            : ticket.status === 'resolved'
            ? 'pending_customer'
            : ticket.status

        if (nextStatus !== ticket.status) {
          await tx.supportTicket.update({
            where: { id: ticketId },
            data: { status: nextStatus },
          })
        }
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

    logger.info('Admin replied to support ticket', {
      ticketId,
      adminId: session.user!.id,
      messageId: result.id,
      visibility,
    })

    return NextResponse.json({ id: result.id })
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Failed to send admin ticket reply', {
      ticketId,
      adminId: session.user!.id,
      error,
    })

    return NextResponse.json({ error: 'Unable to send message' }, { status: 500 })
  }
}
