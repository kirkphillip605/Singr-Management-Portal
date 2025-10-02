
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * POST /api/api-keys/[id]/revoke
 * Revokes an active API key owned by the authenticated user.
 *
 * Notes:
 * - First argument must be the standard Web Request, not NextRequest.
 * - Second argument is the route context: { params: { id: string } }
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Basic guard to avoid empty/invalid ids reaching DB
    const id = params.id?.trim()
    if (!id) {
      return NextResponse.json({ error: 'Invalid API key id' }, { status: 400 })
    }

    // Verify ownership and current status
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        customer: { id: session.user.id },
      },
      select: { id: true, status: true },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    if (apiKey.status !== 'active') {
      return NextResponse.json(
        { error: 'API key is already revoked' },
        { status: 400 }
      )
    }

    // Revoke
    await prisma.apiKey.update({
      where: { id },
      data: { status: 'revoked', revokedAt: new Date() },
    })

    logger.info(`API key ${id} revoked by user ${session.user.id}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error revoking API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
