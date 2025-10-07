// src/app/api/api-keys/[id]/revoke/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Ensure Node runtime for Prisma/Sentry
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsResolved = await paramsResolved

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await paramsResolved

    // Verify ownership (adjust where clause to your schema)
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        customer: { userId: session.user.id },
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    logger.info({ id, userId: session.user.id }, 'API key revoked')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'Failed to revoke API key')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
