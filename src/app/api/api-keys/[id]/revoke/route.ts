// src/app/api/api-keys/[id]/revoke/route.ts

// File: src/app/api/api-keys/[id]/revoke/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Verify ownership via relation, not FK scalar
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        // Option A (most explicit): check via the user relation on customer
        customer: {
          user: { id: session.user.id },
        },
        // Option B (also valid if you prefer): 
        // customer: { is: { userId: session.user.id } },
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Idempotent revoke: only set if not already revoked
    if (!apiKey.revokedAt) {
      await prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      })
    }

    logger.info({ apiKeyId: id, userId: session.user.id }, 'API key revoked')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ err }, 'Failed to revoke API key')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
