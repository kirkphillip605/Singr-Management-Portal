import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSession, assertAdminLevel } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const updateSchema = z.object({
  important: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> }
) {
  const paramsResolved = await params
  const { userId, noteId } = paramsResolved

  const session = await getAdminSession()

  if (!assertAdminLevel(session, 'support')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const payload = updateSchema.parse(body)

    const note = await (prisma as any).userNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!note || note.userId !== userId) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const updated = await (prisma as any).userNote.update({
      where: { id: noteId },
      data: { important: payload.important },
    })

    logger.info('Admin toggled customer note importance', {
      adminId: session?.user?.adminId ?? session?.user?.id,
      noteId,
      targetUserId: userId,
      important: payload.important,
    })

    return NextResponse.json({
      id: updated.id,
      important: updated.important,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    logger.error('Failed to toggle customer note importance', {
      error,
      adminId: session?.user?.adminId ?? session?.user?.id,
      noteId,
      targetUserId: userId,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
