// src/app/api/billing/cancel-subscription/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const runtime = 'nodejs'

const cancelSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  cancelAtPeriodEnd: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subscriptionId, cancelAtPeriodEnd } = cancelSchema.parse(body)

    // Verify subscription belongs to user
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: session.user.id },
    })
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Update on Stripe (Stripe uses snake_case)
    const updated = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
      ...(cancelAtPeriodEnd ? {} : { proration_behavior: 'create_prorations' }),
    })

    // Persist in DB (Prisma uses camelCase)
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        cancelAt: updated.cancel_at ? new Date(updated.cancel_at * 1000) : null,
        // If you have a Prisma enum for status, cast accordingly:
        // status: updated.status as any
        status: updated.status as any,
      },
    })

    logger.info(
      `Subscription ${subscriptionId} cancel settings updated for user ${session.user.id}`
    )

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      cancelAt: updated.cancel_at,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Validation error' }, { status: 400 })
    }
    logger.error(
      `Error canceling subscription: ${
        error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      }`
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
