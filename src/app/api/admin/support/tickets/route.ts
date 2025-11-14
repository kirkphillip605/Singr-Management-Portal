import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'

import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  persistSupportAttachment,
  AttachmentValidationError,
  SavedSupportAttachment,
} from '@/lib/support-attachments'

export const runtime = 'nodejs'

const createTicketSchema = z.object({
  customerId: z.string().uuid(),
  subject: z.string().min(5, 'Subject must be at least 5 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const session = await requireAdminSession()

  const formData = await request.formData()

  const payload = createTicketSchema.safeParse({
    customerId: formData.get('customerId'),
    subject: formData.get('subject'),
    description: formData.get('description'),
    priority: (formData.get('priority') ?? 'normal').toString(),
    category: formData.get('category')?.toString() || undefined,
  })

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.errors[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  // Verify customer exists and is a customer
  const customer = await prisma.user.findUnique({
    where: { id: payload.data.customerId },
  })

  if (!customer || customer.accountType !== 'customer') {
    return NextResponse.json({ error: 'Invalid customer' }, { status: 400 })
  }

  const attachments = formData
    .getAll('attachments')
    .filter((value): value is File => value instanceof File && value.size > 0)

  try {
    const result = await (prisma as any).$transaction(async (tx: any) => {
      // Get customer details for message body
      const user = await tx.user.findUnique({
        where: { id: payload.data.customerId },
        select: { name: true, businessName: true },
      })

      const ticket = await tx.supportTicket.create({
        data: {
          requesterId: payload.data.customerId,
          createdById: session.user!.id,
          assigneeId: session.user!.id,
          subject: payload.data.subject,
          description: payload.data.description,
          priority: payload.data.priority,
          category: payload.data.category || null,
        },
      })

      // Save attachments first to determine if any exist
      const savedFiles: SavedSupportAttachment[] = []
      if (attachments.length) {
        try {
          for (const file of attachments) {
            const saved = await persistSupportAttachment(ticket.id, file)
            savedFiles.push(saved)
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

      // Format the initial message body
      const userName = user?.name || 'Unknown User'
      const userBusiness = user?.businessName ? ` (${user.businessName})` : ''
      const attachmentList = savedFiles.length > 0
        ? savedFiles.map(f => f.fileName).join(', ')
        : 'NONE'

      const messageBody = `--A new support request has been created--

Customer: ${userName}${userBusiness}
Priority: ${payload.data.priority}
Category: ${payload.data.category || 'None'}
Subject: ${payload.data.subject}
Description: ${payload.data.description}

Attachment: ${attachmentList}`

      const message = await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: payload.data.customerId,
          visibility: 'public',
          body: messageBody,
        },
      })

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

      // Create audit trail for ticket creation
      await tx.supportTicketAudit.create({
        data: {
          ticketId: ticket.id,
          actorId: session.user!.id,
          action: 'created',
          oldValues: null,
          newValues: {
            subject: ticket.subject,
            description: ticket.description,
            priority: ticket.priority,
            category: ticket.category,
            status: 'open',
            requesterId: ticket.requesterId,
            createdBy: 'admin',
          },
        },
      })

      return ticket
    })

    logger.info('Admin created support ticket on behalf of customer', {
      ticketId: result.id,
      adminId: session.user!.id,
      customerId: payload.data.customerId,
    })

    return NextResponse.json({ id: result.id })
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.error('Failed to create support ticket', {
      error,
      adminId: session.user!.id,
    })

    return NextResponse.json({ error: 'Unable to create support ticket' }, { status: 500 })
  }
}
