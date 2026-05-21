// src/app/api/api-keys/[id]/revoke/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@singr/auth/session'
import { prisma } from '@singr/database'
import { logger } from '@singr/config/logger'

export const runtime = 'nodejs'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!session.user.roles?.includes('host')) {
      return NextResponse.json({ error: 'Forbidden', message: 'Host accounts only.' }, { status: 403 })
    }

    const { id } = params

    // Verify ownership via relation, not FK scalar
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Idempotent revoke
    if (!apiKey.revokedAt) {
      await prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      })
    }

    // ✅ String-only logging
    logger.info(
      `API key revoked: apiKeyId=${id} userId=${session.user.id}`
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    // ✅ String-only logging with safe error formatting
    const msg =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : typeof err === 'string'
        ? err
        : JSON.stringify(err)

    logger.error(`Failed to revoke API key: ${msg}`)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
