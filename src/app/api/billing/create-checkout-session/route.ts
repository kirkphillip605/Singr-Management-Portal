import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { z } from 'zod'
export const runtime = 'nodejs'



const checkoutSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  couponId: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { priceId, couponId, successUrl, cancelUrl } = checkoutSchema.parse(body)

    // Get or create customer
    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Check if customer already has an active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['active', 'trialing'] },
      },
    })

    // Create checkout session parameters
    const checkoutParams: any = {
      customer: customer.stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: cancelUrl || `${process.env.NEXTAUTH_URL}/dashboard/billing/plans`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      metadata: {
        userId: session.user.id,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
        },
        trial_period_days: 7, // 7-day free trial
      },
    }

    // Add coupon if provided
    if (couponId) {
      checkoutParams.discounts = [{ coupon: couponId }]
    }

    // If user has existing subscription, handle as upgrade/downgrade
    if (existingSubscription) {
      checkoutParams.subscription_data.metadata.upgrade_from = existingSubscription.id
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams)

    // Store checkout session in database
    try {
      await prisma.stripeCheckoutSession.create({
        data: {
          id: checkoutSession.id,
          customerId: session.user.id,
          paymentStatus: checkoutSession.payment_status,
          mode: checkoutSession.mode!,
          amountTotal: checkoutSession.amount_total ? BigInt(checkoutSession.amount_total) : null,
          currency: checkoutSession.currency || 'usd',
          created: new Date(checkoutSession.created * 1000),
          expiresAt: checkoutSession.expires_at ? new Date(checkoutSession.expires_at * 1000) : null,
          url: checkoutSession.url,
          metadata: (checkoutSession.metadata || {}) as any,
        },
      })
    } catch (dbError) {
      logger.warn('Failed to store checkout session in database:', dbError)
      // Continue even if database storage fails
    }

    logger.info(`Checkout session created for user ${session.user.id}: ${checkoutSession.id}`)

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }

    logger.error('Error creating checkout session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}