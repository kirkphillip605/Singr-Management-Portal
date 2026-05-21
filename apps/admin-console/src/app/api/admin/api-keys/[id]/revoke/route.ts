import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, assertAdminLevel } from '@singr/auth/guards/admin'
import { prisma } from '@singr/database'
import { logger } from '@singr/config/logger'
export const runtime = 'nodejs'



export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsResolved = await params

  const session = await getAdminSession()

  if (!assertAdminLevel(session, 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = paramsResolved

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        revokedAt: true,
        userId: true,
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    if (apiKey.revokedAt) {
      return NextResponse.json({ success: true })
    }

    await prisma.apiKey.update({
      where: { id },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    })

    logger.info('Admin revoked API key', {
      adminId: session?.user?.adminId,
      apiKeyId: id,
      targetUserId: apiKey.userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to revoke API key as admin', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
