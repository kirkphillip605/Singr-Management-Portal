import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
export const runtime = 'nodejs'



export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { id: session.user.id },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
    })

    logger.info(`Customer portal session created for user ${session.user.id}`)

    return NextResponse.json({
      url: portalSession.url,
    })
  } catch (error) {
    logger.error('Error creating customer portal session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}