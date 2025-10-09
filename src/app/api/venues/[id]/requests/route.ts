import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsResolved = await params

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        requestTime: 'desc',
      },
      take: 100,
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching venue requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
