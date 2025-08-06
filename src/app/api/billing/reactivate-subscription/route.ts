import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const reactivateSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subscriptionId } = reactivateSchema.parse(body)

    // Verify subscription belongs to user
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: session.user.id,
      },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Reactivate subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })

    // Update subscription in database
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancel_at_period_end: false,
        cancel_at: null,
        status: updatedSubscription.status as any,
      },
    })

    logger.info(`Subscription ${subscriptionId} reactivated for user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: false,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    logger.error('Error reactivating subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}