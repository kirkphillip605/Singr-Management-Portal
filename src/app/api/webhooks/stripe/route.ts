import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import Stripe from 'stripe'

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map()

// Helper function for rate limiting
function rateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60000 // 1 minute
  const maxRequests = 100

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  const { count, resetTime } = rateLimitMap.get(ip)

  if (now > resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (count >= maxRequests) {
    return false
  }

  rateLimitMap.set(ip, { count: count + 1, resetTime })
  return true
}

// Helper to safely convert Unix timestamp to Date
function safeTimestampToDate(timestamp: number | null | undefined): Date | null {
  if (!timestamp || timestamp === 0) return null
  
  // Stripe timestamps are in seconds, JavaScript dates need milliseconds
  // Also validate that the timestamp is reasonable (not too far in past/future)
  const currentTime = Date.now() / 1000 // Current time in seconds
  const oneYearAgo = currentTime - (365 * 24 * 60 * 60) // One year ago in seconds
  const tenYearsFromNow = currentTime + (10 * 365 * 24 * 60 * 60) // Ten years from now in seconds
  
  // Validate timestamp is within reasonable bounds
  if (timestamp < oneYearAgo || timestamp > tenYearsFromNow) {
    console.error(`Invalid timestamp: ${timestamp}, current: ${currentTime}`)
    return null
  }
  
  // Unix timestamps are in seconds, JavaScript dates need milliseconds
  const date = new Date(timestamp * 1000)
  
  // Validate the resulting date is valid
  if (isNaN(date.getTime())) {
    console.error(`Invalid date created from timestamp: ${timestamp}`)
    return null
  }
  
  return date
}

// Helper to safely convert BigInt
function safeBigInt(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined) return null
  return BigInt(value)
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { error: true, errorString: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Get request body and signature
    const body = await request.text()
    const signature = (await request.headers).get('stripe-signature')

    if (!signature) {
      logger.error('Missing Stripe signature')
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      logger.error('Missing STRIPE_WEBHOOK_SECRET environment variable')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
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
          eventType: event.type,
          livemode: event.livemode,
          apiVersion: event.api_version,
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
              unitAmount: safeBigInt(price.unit_amount),
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
              unitAmount: safeBigInt(price.unit_amount),
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
              amountOff: safeBigInt(coupon.amount_off),
              currency: coupon.currency || null,
              duration: coupon.duration,
              durationInMonths: coupon.duration_in_months || null,
              maxRedemptions: coupon.max_redemptions || null,
              percentOff: coupon.percent_off || null,
              redeemBy: safeTimestampToDate(coupon.redeem_by),
              timesRedeemed: coupon.times_redeemed || 0,
              valid: coupon.valid,
              metadata: coupon.metadata as any,
            },
            create: {
              id: coupon.id,
              name: coupon.name || null,
              amountOff: safeBigInt(coupon.amount_off),
              currency: coupon.currency || null,
              duration: coupon.duration,
              durationInMonths: coupon.duration_in_months || null,
              maxRedemptions: coupon.max_redemptions || null,
              percentOff: coupon.percent_off || null,
              redeemBy: safeTimestampToDate(coupon.redeem_by),
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
              expiresAt: safeTimestampToDate(promotionCode.expires_at),
              metadata: promotionCode.metadata as any,
            },
            create: {
              id: promotionCode.id,
              couponId: typeof promotionCode.coupon === 'string' ? promotionCode.coupon : promotionCode.coupon.id,
              code: promotionCode.code,
              active: promotionCode.active,
              maxRedemptions: promotionCode.max_redemptions || null,
              timesRedeemed: promotionCode.times_redeemed || 0,
              expiresAt: safeTimestampToDate(promotionCode.expires_at),
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

          const currentPeriodStart = safeTimestampToDate(subscription.current_period_start)
          const currentPeriodEnd = safeTimestampToDate(subscription.current_period_end)

          // For incomplete subscriptions, periods might not be set yet
          if (!currentPeriodStart || !currentPeriodEnd) {
            if (subscription.status === 'incomplete') {
              // For incomplete subscriptions, use created timestamp as fallback
              const fallbackDate = safeTimestampToDate(subscription.created) || new Date()
              logger.warn(`Using fallback dates for incomplete subscription ${subscription.id}`)
              
              await prisma.subscription.upsert({
                where: { id: subscription.id },
                update: {
                  status: subscription.status as any,
                  priceId: subscription.items.data[0]?.price.id || '',
                  quantity: subscription.items.data[0]?.quantity || 1,
                  cancelAtPeriodEnd: subscription.cancel_at_period_end,
                  endedAt: safeTimestampToDate(subscription.ended_at),
                  cancelAt: safeTimestampToDate(subscription.cancel_at),
                  canceledAt: safeTimestampToDate(subscription.canceled_at),
                  trialStart: safeTimestampToDate(subscription.trial_start),
                  trialEnd: safeTimestampToDate(subscription.trial_end),
                  pausedAt: subscription.pause_collection?.behavior === 'keep_as_draft' ? new Date() : null,
                  resumedAt: subscription.pause_collection?.behavior !== 'keep_as_draft' && event.type === 'customer.subscription.resumed' ? new Date() : null,
                  metadata: subscription.metadata as any,
                },
                create: {
                  id: subscription.id,
                  userId: customer.id,
                  status: subscription.status as any,
                  priceId: subscription.items.data[0]?.price.id || '',
                  quantity: subscription.items.data[0]?.quantity || 1,
                  cancelAtPeriodEnd: subscription.cancel_at_period_end,
                  createdAt: fallbackDate,
                  currentPeriodStart: fallbackDate,
                  currentPeriodEnd: new Date(fallbackDate.getTime() + (30 * 24 * 60 * 60 * 1000)), // 30 days from now
                  endedAt: safeTimestampToDate(subscription.ended_at),
                  cancelAt: safeTimestampToDate(subscription.cancel_at),
                  canceledAt: safeTimestampToDate(subscription.canceled_at),
                  trialStart: safeTimestampToDate(subscription.trial_start),
                  trialEnd: safeTimestampToDate(subscription.trial_end),
                  metadata: subscription.metadata as any,
                },
              })
              break
            } else {
              logger.error(`Invalid subscription periods for ${subscription.id}: start=${subscription.current_period_start}, end=${subscription.current_period_end}`)
              break
            }
          }

          await prisma.subscription.upsert({
            where: { id: subscription.id },
            update: {
              status: subscription.status as any,
              priceId: subscription.items.data[0]?.price.id || '',
              quantity: subscription.items.data[0]?.quantity || 1,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodStart,
              currentPeriodEnd,
              endedAt: safeTimestampToDate(subscription.ended_at),
              cancelAt: safeTimestampToDate(subscription.cancel_at),
              canceledAt: safeTimestampToDate(subscription.canceled_at),
              trialStart: safeTimestampToDate(subscription.trial_start),
              trialEnd: safeTimestampToDate(subscription.trial_end),
              pausedAt: subscription.pause_collection?.behavior === 'keep_as_draft' ? new Date() : null,
              resumedAt: subscription.pause_collection?.behavior !== 'keep_as_draft' && event.type === 'customer.subscription.resumed' ? new Date() : null,
              metadata: subscription.metadata as any,
            },
            create: {
              id: subscription.id,
              userId: customer.id,
              status: subscription.status as any,
              priceId: subscription.items.data[0]?.price.id || '',
              quantity: subscription.items.data[0]?.quantity || 1,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              createdAt: safeTimestampToDate(subscription.created) || new Date(),
              currentPeriodStart,
              currentPeriodEnd,
              endedAt: safeTimestampToDate(subscription.ended_at),
              cancelAt: safeTimestampToDate(subscription.cancel_at),
              canceledAt: safeTimestampToDate(subscription.canceled_at),
              trialStart: safeTimestampToDate(subscription.trial_start),
              trialEnd: safeTimestampToDate(subscription.trial_end),
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
              canceledAt: safeTimestampToDate(subscription.canceled_at) || new Date(),
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

          const periodStart = safeTimestampToDate(invoice.period_start)
          const periodEnd = safeTimestampToDate(invoice.period_end)

          if (!periodStart || !periodEnd) {
            logger.error(`Invalid invoice periods for ${invoice.id}`)
            break
          }

          await prisma.invoice.upsert({
            where: { id: invoice.id },
            update: {
              status: invoice.status || '',
              amountDue: safeBigInt(invoice.amount_due),
              amountPaid: safeBigInt(invoice.amount_paid),
              amountRemaining: safeBigInt(invoice.amount_remaining),
              hostedInvoiceUrl: invoice.hosted_invoice_url || null,
              invoicePdf: invoice.invoice_pdf || null,
              dueDate: safeTimestampToDate(invoice.due_date),
              metadata: invoice.metadata as any,
            },
            create: {
              id: invoice.id,
              customerId: customer.id,
              stripeCustomerId: invoice.customer as string,
              subscriptionId: invoice.subscription as string || null,
              status: invoice.status || '',
              amountDue: safeBigInt(invoice.amount_due),
              amountPaid: safeBigInt(invoice.amount_paid),
              amountRemaining: safeBigInt(invoice.amount_remaining),
              currency: invoice.currency,
              collectionMethod: invoice.collection_method || 'charge_automatically',
              hostedInvoiceUrl: invoice.hosted_invoice_url || null,
              invoicePdf: invoice.invoice_pdf || null,
              periodStart,
              periodEnd,
              dueDate: safeTimestampToDate(invoice.due_date),
              created: safeTimestampToDate(invoice.created) || new Date(),
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

          // Use correct table and column names
          const paymentIntentData = {
            id: paymentIntent.id,
            customerId: customer.id,
            amount: safeBigInt(paymentIntent.amount),
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            captureMethod: paymentIntent.capture_method,
            created: safeTimestampToDate(paymentIntent.created) || new Date(),
            metadata: paymentIntent.metadata as any,
          }

          await prisma.stripePaymentIntent.upsert({
            where: { id: paymentIntentData.id },
            update: {
              amount: paymentIntentData.amount,
              currency: paymentIntentData.currency,
              status: paymentIntentData.status,
              captureMethod: paymentIntentData.captureMethod,
              metadata: paymentIntentData.metadata,
            },
            create: paymentIntentData,
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
              created: safeTimestampToDate(paymentMethod.created) || new Date(),
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

          // Use the correct table and column names
          const sessionData = {
            id: session.id,
            customerId: customer.id,
            paymentStatus: session.payment_status,
            mode: session.mode,
            amountTotal: safeBigInt(session.amount_total),
            currency: session.currency || 'usd',
            created: safeTimestampToDate(session.created) || new Date(),
            expiresAt: safeTimestampToDate(session.expires_at),
            url: session.url || null,
            metadata: session.metadata as any,
          }

          await prisma.stripeCheckoutSession.upsert({
            where: { id: sessionData.id },
            update: {
              paymentStatus: sessionData.paymentStatus,
              amountTotal: sessionData.amountTotal,
              url: sessionData.url,
              metadata: sessionData.metadata,
            },
            create: sessionData,
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

  } catch (error) {
    logger.error('Critical webhook error:', error)
    return NextResponse.json({ 
      error: 'Critical webhook error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}