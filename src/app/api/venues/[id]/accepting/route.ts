import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth-server'
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
  const paramsResolved = await params

  try {
    const session = await getAuthSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.accountType !== 'customer') {
      return NextResponse.json({ error: 'Forbidden', message: 'Customer (host) accounts only.' }, { status: 403 })
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
            customers: true,
          },
        },
      },
    })

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    const venueCustomer = venue.user.customers[0]

    // If trying to enable accepting, check subscription status
    if (accepting && venueCustomer?.stripeCustomerId) {
      const hasSubscription = await hasActiveSubscription(venueCustomer.stripeCustomerId)
      if (!hasSubscription) {
        return NextResponse.json(
          { error: 'You must have an active subscription to accept requests.' },
          { status: 403 }
        )
      }
    }

    // Update venue accepting status
    await prisma.venue.update({
      where: { id: paramsResolved.id },
      data: { acceptingRequests: accepting, accepting },
    })

    await prisma.state.upsert({
      where: { userId: session.user.id },
      update: { serial: { increment: BigInt(1) } },
      create: { userId: session.user.id, serial: BigInt(1) },
    })

    return NextResponse.json({ success: true, accepting })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }

    console.error('Error updating venue accepting status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}