import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsResolved = await params

  try {
    const session = await getAuthSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.accountType !== 'customer') {
      return NextResponse.json({ error: 'Forbidden', message: 'Customer (host) accounts only.' }, { status: 403 })
    }

    // Find the venue and verify ownership
    const venue = await prisma.venue.findFirst({
      where: {
        id: paramsResolved.id,
        userId: session.user.id,
      },
    })

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    // Get requests for this venue
    const requests = await prisma.request.findMany({
      where: {
        venueId: paramsResolved.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching venue requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
