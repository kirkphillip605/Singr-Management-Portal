import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
export const runtime = 'nodejs'



const updateAcceptingSchema = z.object({
  accepting: z.boolean(),
})

async function hasActiveSubscription(stripeCustomerId: string): Promise<boolean> {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length > 0) return true

    // Also check for trialing subscriptions
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'trialing',
      limit: 1,
    })

    return trialingSubscriptions.data.length > 0
  } catch (error) {
    console.error('Error checking subscription status:', error)
    return false
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsResolved = await paramsResolved

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { accepting } = updateAcceptingSchema.parse(body)

    // Find the venue and verify ownership
    const venue = await prisma.venue.findFirst({
      where: {
        id: paramsResolved.id,
        userId: session.user.id,
      },
      include: {
        user: {
          include: {
            customer: true,
          },
        },
      },
    })

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    // If trying to enable accepting, check subscription status
    if (accepting && venue.user.customer?.stripeCustomerId) {
      const hasSubscription = await hasActiveSubscription(venue.user.customer.stripeCustomerId)
      if (!hasSubscription) {
        return NextResponse.json(
          { error: 'Active subscription required to accept requests' },
          { status: 403 }
        )
      }
    }

    // Update venue accepting status
    await prisma.venue.update({
      where: { id: paramsResolved.id },
      data: { acceptingRequests: accepting },
    })

    // Update venue state
    await prisma.state.updateMany({
      where: {
        venueId: paramsResolved.id,
      },
      data: {
        accepting,
        serial: { increment: 1 },
      },
    })

    return NextResponse.json({ success: true, accepting })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Error updating venue accepting status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}