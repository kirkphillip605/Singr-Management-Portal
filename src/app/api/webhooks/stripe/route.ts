import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')

  if (!signature) {
    logger.error('Missing Stripe signature')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    logger.error('Webhook signature verification failed:', error)
    return NextResponse.json({ 
      error: 'Invalid signature',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 })
  }

  // Log the webhook event for debugging
  logger.info(`Stripe webhook received: ${event.type}`, { eventId: event.id })

  // Store webhook event for audit trail
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId: event.id,
        payload: event as any,
        receivedAt: new Date(),
        processed: false,
      },
    })
  } catch (error) {
    // Don't fail webhook processing if audit logging fails
    logger.warn('Failed to log webhook event:', error)
  }

  try {
    switch (event.type) {
      // Customer events
      case 'customer.created':
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer
        
        // Only update if we can find a user by email
        if (customer.email) {
          const user = await prisma.user.findUnique({
            where: { email: customer.email },
          })

          if (user) {
            await prisma.customer.upsert({
              where: { id: user.id },
              update: {
                stripeCustomerId: customer.id,
              },
              create: {
                id: user.id,
                stripeCustomerId: customer.id,
              },
            })
            logger.info(`Customer ${event.type}: ${customer.id} linked to user ${user.id}`)
          }
        }
        break
      }

      case 'customer.deleted': {
        const customer = event.data.object as Stripe.Customer
        
        // Don't delete customer record, just log it
        logger.info(`Customer deleted in Stripe: ${customer.id}`)
        break
      }

      // Product events
      case 'product.created':
      case 'product.updated': {
        const product = event.data.object as Stripe.Product
        
        await prisma.product.upsert({
          where: { id: product.id },
          update: {
            active: product.active,
            name: product.name,
            description: product.description,
            image: product.images?.[0] || null,
            metadata: product.metadata as any,
          },
          create: {
            id: product.id,
            active: product.active,
            name: product.name,
            description: product.description,
            image: product.images?.[0] || null,
            metadata: product.metadata as any,
          },
        })
        logger.info(`Product ${event.type}: ${product.id}`)
        break
      }

      case 'product.deleted': {
        const product = event.data.object as Stripe.Product
        await prisma.product.update({
          where: { id: product.id },
          data: { active: false }
        })
        logger.info(`Product deactivated: ${product.id}`)
        break
      }

      // Price events
      case 'price.created':
      case 'price.updated': {
        const price = event.data.object as Stripe.Price
        
        await prisma.price.upsert({
          where: { id: price.id },
          update: {
            active: price.active,
            currency: price.currency,
            unitAmount: price.unit_amount ? BigInt(price.unit_amount) : null,
            type: price.type === 'recurring' ? 'recurring' : 'one_time',
            interval: price.recurring?.interval as any,
            intervalCount: price.recurring?.interval_count || null,
            trialPeriodDays: price.recurring?.trial_period_days || null,
            metadata: price.metadata as any,
          },
          create: {
            id: price.id,
            productId: typeof price.product === 'string' ? price.product : price.product.id,
            active: price.active,
            currency: price.currency,
            unitAmount: price.unit_amount ? BigInt(price.unit_amount) : null,
            type: price.type === 'recurring' ? 'recurring' : 'one_time',
            interval: price.recurring?.interval as any,
            intervalCount: price.recurring?.interval_count || null,
            trialPeriodDays: price.recurring?.trial_period_days || null,
            metadata: price.metadata as any,
          },
        })
        logger.info(`Price ${event.type}: ${price.id}`)
        break
      }

      case 'price.deleted': {
        const price = event.data.object as Stripe.Price
        await prisma.price.update({
          where: { id: price.id },
          data: { active: false }
        })
        logger.info(`Price deactivated: ${price.id}`)
        break
      }

      // Coupon events
      case 'coupon.created':
      case 'coupon.updated': {
        const coupon = event.data.object as Stripe.Coupon
        
        await prisma.coupon.upsert({
          where: { id: coupon.id },
          update: {
            name: coupon.name || null,
            amountOff: coupon.amount_off ? BigInt(coupon.amount_off) : null,
            currency: coupon.currency || null,
            duration: coupon.duration,
            durationInMonths: coupon.duration_in_months || null,
            maxRedemptions: coupon.max_redemptions || null,
            percentOff: coupon.percent_off || null,
            redeemBy: coupon.redeem_by ? new Date(coupon.redeem_by * 1000) : null,
            timesRedeemed: coupon.times_redeemed || 0,
            valid: coupon.valid,
            metadata: coupon.metadata as any,
          },
          create: {
            id: coupon.id,
            name: coupon.name || null,
            amountOff: coupon.amount_off ? BigInt(coupon.amount_off) : null,
            currency: coupon.currency || null,
            duration: coupon.duration,
            durationInMonths: coupon.duration_in_months || null,
            maxRedemptions: coupon.max_redemptions || null,
            percentOff: coupon.percent_off || null,
            redeemBy: coupon.redeem_by ? new Date(coupon.redeem_by * 1000) : null,
            timesRedeemed: coupon.times_redeemed || 0,
            valid: coupon.valid,
            metadata: coupon.metadata as any,
          },
        })
        logger.info(`Coupon ${event.type}: ${coupon.id}`)
        break
      }

      case 'coupon.deleted': {
        const coupon = event.data.object as Stripe.Coupon
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { valid: false }
        })
        logger.info(`Coupon deactivated: ${coupon.id}`)
        break
      }

      // Promotion Code events
      case 'promotion_code.created':
      case 'promotion_code.updated': {
        const promotionCode = event.data.object as Stripe.PromotionCode
        
        await prisma.promotionCode.upsert({
          where: { id: promotionCode.id },
          update: {
            code: promotionCode.code,
            active: promotionCode.active,
            maxRedemptions: promotionCode.max_redemptions || null,
            timesRedeemed: promotionCode.times_redeemed || 0,
            expiresAt: promotionCode.expires_at ? new Date(promotionCode.expires_at * 1000) : null,
            metadata: promotionCode.metadata as any,
          },
          create: {
            id: promotionCode.id,
            couponId: typeof promotionCode.coupon === 'string' ? promotionCode.coupon : promotionCode.coupon.id,
            code: promotionCode.code,
            active: promotionCode.active,
            maxRedemptions: promotionCode.max_redemptions || null,
            timesRedeemed: promotionCode.times_redeemed || 0,
            expiresAt: promotionCode.expires_at ? new Date(promotionCode.expires_at * 1000) : null,
            metadata: promotionCode.metadata as any,
          },
        })
        logger.info(`Promotion code ${event.type}: ${promotionCode.id}`)
        break
      }

      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription
        
        const customer = await prisma.customer.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        })

        if (!customer) {
          logger.error(`Customer not found for subscription: ${subscription.id}`)
          break
        }

        await prisma.subscription.upsert({
          where: { id: subscription.id },
          update: {
            status: subscription.status as any,
            priceId: subscription.items.data[0]?.price.id || null,
            quantity: subscription.items.data[0]?.quantity || 1,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
            cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            pausedAt: subscription.pause_collection?.behavior === 'keep_as_draft' ? new Date() : null,
            resumedAt: subscription.pause_collection?.behavior !== 'keep_as_draft' && event.type === 'customer.subscription.resumed' ? new Date() : null,
            metadata: subscription.metadata as any,
          },
          create: {
            id: subscription.id,
            userId: customer.id,
            status: subscription.status as any,
            priceId: subscription.items.data[0]?.price.id || null,
            quantity: subscription.items.data[0]?.quantity || 1,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            createdAt: new Date(subscription.created * 1000),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
            cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            metadata: subscription.metadata as any,
          },
        })
        logger.info(`Subscription ${event.type}: ${subscription.id}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Update subscription status instead of deleting
        await prisma.subscription.updateMany({
          where: { id: subscription.id },
          data: { 
            status: 'canceled',
            endedAt: new Date(),
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : new Date(),
          },
        })
        logger.info(`Subscription canceled: ${subscription.id}`)
        break
      }

      // Invoice events
      case 'invoice.created':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.upcoming': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (event.type === 'invoice.upcoming') {
          // Don't store upcoming invoices, just log them
          logger.info(`Upcoming invoice for customer: ${invoice.customer}`)
          break
        }
        
        const customer = await prisma.customer.findUnique({
          where: { stripeCustomerId: invoice.customer as string },
        })

        if (!customer) {
          logger.error(`Customer not found for invoice: ${invoice.id}`)
          break
        }

        await prisma.invoice.upsert({
          where: { id: invoice.id },
          update: {
            status: invoice.status || '',
            amountDue: invoice.amount_due ? BigInt(invoice.amount_due) : null,
            amountPaid: invoice.amount_paid ? BigInt(invoice.amount_paid) : null,
            amountRemaining: invoice.amount_remaining ? BigInt(invoice.amount_remaining) : null,
            hostedInvoiceUrl: invoice.hosted_invoice_url || null,
            invoicePdf: invoice.invoice_pdf || null,
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
            metadata: invoice.metadata as any,
          },
          create: {
            id: invoice.id,
            customerId: customer.id,
            stripeCustomerId: invoice.customer as string,
            subscriptionId: invoice.subscription as string || null,
            status: invoice.status || '',
            amountDue: invoice.amount_due ? BigInt(invoice.amount_due) : null,
            amountPaid: invoice.amount_paid ? BigInt(invoice.amount_paid) : null,
            amountRemaining: invoice.amount_remaining ? BigInt(invoice.amount_remaining) : null,
            currency: invoice.currency,
            hostedInvoiceUrl: invoice.hosted_invoice_url || null,
            invoicePdf: invoice.invoice_pdf || null,
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000),
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
            metadata: invoice.metadata as any,
          },
        })
        logger.info(`Invoice ${event.type}: ${invoice.id}`)
        break
      }

      // Payment Intent events
      case 'payment_intent.created':
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        if (!paymentIntent.customer) {
          logger.info(`Payment intent ${paymentIntent.id} has no customer, skipping`)
          break
        }
        
        const customer = await prisma.customer.findUnique({
          where: { stripeCustomerId: paymentIntent.customer as string },
        })

        if (!customer) {
          logger.error(`Customer not found for payment intent: ${paymentIntent.id}`)
          break
        }

        await prisma.stripePaymentIntent.upsert({
          where: { id: paymentIntent.id },
          update: {
            amount: paymentIntent.amount ? BigInt(paymentIntent.amount) : null,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            captureMethod: paymentIntent.capture_method,
            metadata: paymentIntent.metadata as any,
          },
          create: {
            id: paymentIntent.id,
            customerId: customer.id,
            amount: paymentIntent.amount ? BigInt(paymentIntent.amount) : null,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            captureMethod: paymentIntent.capture_method,
            metadata: paymentIntent.metadata as any,
          },
        })
        logger.info(`Payment intent ${event.type}: ${paymentIntent.id}`)
        break
      }

      // Payment Method events
      case 'payment_method.attached':
      case 'payment_method.automatically_updated':
      case 'payment_method.updated': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod
        
        if (!paymentMethod.customer) {
          logger.info(`Payment method ${paymentMethod.id} has no customer, skipping`)
          break
        }
        
        await prisma.paymentMethod.upsert({
          where: { id: paymentMethod.id },
          update: {
            type: paymentMethod.type,
            cardBrand: paymentMethod.card?.brand || null,
            cardLast4: paymentMethod.card?.last4 || null,
            cardExpMonth: paymentMethod.card?.exp_month || null,
            cardExpYear: paymentMethod.card?.exp_year || null,
            billingDetails: paymentMethod.billing_details as any,
            metadata: paymentMethod.metadata as any,
          },
          create: {
            id: paymentMethod.id,
            stripeCustomerId: paymentMethod.customer as string,
            type: paymentMethod.type,
            cardBrand: paymentMethod.card?.brand || null,
            cardLast4: paymentMethod.card?.last4 || null,
            cardExpMonth: paymentMethod.card?.exp_month || null,
            cardExpYear: paymentMethod.card?.exp_year || null,
            billingDetails: paymentMethod.billing_details as any,
            metadata: paymentMethod.metadata as any,
          },
        })
        logger.info(`Payment method ${event.type}: ${paymentMethod.id}`)
        break
      }

      case 'payment_method.detached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod
        
        // Remove the payment method from database
        await prisma.paymentMethod.deleteMany({
          where: { id: paymentMethod.id },
        })
        logger.info(`Payment method detached: ${paymentMethod.id}`)
        break
      }

      // Checkout events
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        
        if (!session.customer) {
          logger.info(`Checkout session ${session.id} has no customer, skipping`)
          break
        }
        
        const customer = await prisma.customer.findUnique({
          where: { stripeCustomerId: session.customer as string },
        })

        if (!customer) {
          logger.error(`Customer not found for checkout session: ${session.id}`)
          break
        }

        await prisma.stripeCheckoutSession.upsert({
          where: { id: session.id },
          update: {
            paymentStatus: session.payment_status,
            amountTotal: session.amount_total ? BigInt(session.amount_total) : null,
            url: session.url || null,
            metadata: session.metadata as any,
          },
          create: {
            id: session.id,
            customerId: customer.id,
            paymentStatus: session.payment_status,
            mode: session.mode,
            amountTotal: session.amount_total ? BigInt(session.amount_total) : null,
            currency: session.currency || 'usd',
            expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
            url: session.url || null,
            metadata: session.metadata as any,
          },
        })
        logger.info(`Checkout session ${event.type}: ${session.id}`)
        break
      }

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`)
        break
    }

    // Mark webhook as processed
    await prisma.stripeWebhookEvent.updateMany({
      where: { eventId: event.id },
      data: { 
        processed: true, 
        processedAt: new Date() 
      },
    })

    logger.info(`Successfully processed webhook: ${event.type} (${event.id})`)

  } catch (error) {
    logger.error(`Error processing webhook ${event.type}:`, error)
    
    // Mark webhook as failed
    await prisma.stripeWebhookEvent.updateMany({
      where: { eventId: event.id },
      data: { 
        processed: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      },
    })

    return NextResponse.json({ 
      error: 'Webhook processing failed',
      eventType: event.type,
      eventId: event.id,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }

  return NextResponse.json({ 
    received: true,
    eventType: event.type,
    eventId: event.id
  })
}