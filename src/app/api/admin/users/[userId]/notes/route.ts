import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession, assertAdminLevel } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const createNoteSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject is too long'),
  note: z.string().min(1, 'Note body is required'),
  important: z.boolean().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const paramsResolved = await params

  const session = await getAdminSession()

  if (!assertAdminLevel(session, 'support')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = paramsResolved

  try {
    const body = await request.json()
    const payload = createNoteSchema.parse(body)

    const customer = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const note = await (prisma as any).userNote.create({
      data: {
        userId,
        createdBy: session!.user!.id,
        important: payload.important ?? false,
        subject: payload.subject,
        note: payload.note,
      },
    })

    logger.info('Admin saved customer note', {
      adminId: session?.user?.adminId ?? session?.user?.id,
      noteId: note.id,
      targetUserId: userId,
      important: note.important,
    })

    return NextResponse.json({
      id: note.id,
      important: note.important,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    logger.error('Failed to create customer note', {
      error,
      adminId: session?.user?.adminId ?? session?.user?.id,
      targetUserId: userId,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
