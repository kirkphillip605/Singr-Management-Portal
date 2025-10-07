import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, assertAdminLevel } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
export const runtime = 'nodejs'



export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsResolved = await paramsResolved

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
        customer: {
          select: {
            id: true,
          },
        },
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
      targetCustomerId: apiKey.customer.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to revoke API key as admin', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
