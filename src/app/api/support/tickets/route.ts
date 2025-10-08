import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'

import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  persistSupportAttachment,
  AttachmentValidationError,
  SavedSupportAttachment,
} from '@/lib/support-attachments'

export const runtime = 'nodejs'

const createTicketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getAuthSession()

  if (!session?.user?.id || session.user.accountType !== 'customer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()

  const payload = createTicketSchema.safeParse({
    subject: formData.get('subject'),
    description: formData.get('description'),
    priority: (formData.get('priority') ?? 'normal').toString(),
    category: formData.get('category')?.toString() || undefined,
  })

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.errors[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const attachments = formData
    .getAll('attachments')
    .filter((value): value is File => value instanceof File && value.size > 0)

  try {
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const ticket = await tx.supportTicket.create({
        data: {
          requesterId: session.user!.id,
          createdById: session.user!.id,
          subject: payload.data.subject,
          description: payload.data.description,
          priority: payload.data.priority,
          category: payload.data.category || null,
        },
      })

      const message = await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: session.user!.id,
          visibility: 'public',
          body: payload.data.description,
        },
      })

      if (attachments.length) {
        const savedFiles: SavedSupportAttachment[] = []
        try {
          for (const file of attachments) {
            const saved = await persistSupportAttachment(ticket.id, file)
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

      return ticket
    })

    logger.info('Customer created support ticket', {
      ticketId: result.id,
      requesterId: session.user.id,
    })

    return NextResponse.json({ id: result.id })
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Failed to create support ticket', {
      error,
      requesterId: session.user.id,
    })

    return NextResponse.json({ error: 'Unable to create support ticket' }, { status: 500 })
  }
}
