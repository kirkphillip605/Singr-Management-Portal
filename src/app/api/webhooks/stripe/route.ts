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
  
  try {
    const date = new Date(timestamp * 1000)
    if (isNaN(date.getTime())) return null
    return date
  } catch {
    return null
  }
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
    const signature = request.headers.get('stripe-signature')

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
      logger.warn('Failed to log webhook event:', error)
    }

    try {
      switch (event.type) {
        // Customer events
        case 'customer.created':
        case 'customer.updated': {
          const customer = event.data.object as Stripe.Customer
          
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

        // Subscription events - SIMPLIFIED VERSION
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription
          
          const customer = await prisma.customer.findUnique({
            where: { stripeCustomerId: subscription.customer as string },
          })

          if (!customer) {
            logger.error(`Customer not found for subscription: ${subscription.id}`)
            break
          }

          // Extract price ID from subscription items
          const priceId = subscription.items.data[0]?.price.id

          // Use only essential fields to avoid schema conflicts
          await prisma.subscription.upsert({
            where: { id: subscription.id },
            update: {
              status: subscription.status,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodEnd: safeTimestampToDate(subscription.current_period_end) || new Date(),
              currentPeriodStart: safeTimestampToDate(subscription.current_period_start) || new Date(),
            },
            create: {
              id: subscription.id,
              userId: customer.id,
              status: subscription.status,
              currency: subscription.currency,
              customer: subscription.customer as string,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodEnd: safeTimestampToDate(subscription.current_period_end) || new Date(),
              currentPeriodStart: safeTimestampToDate(subscription.current_period_start) || new Date(),
              created: safeTimestampToDate(subscription.created) || new Date(),
            },
          })
          
          logger.info(`Subscription ${event.type}: ${subscription.id}`)
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription
          
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

        // Invoice events - SIMPLIFIED VERSION
        case 'invoice.created':
        case 'invoice.paid':
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice
          
          const customer = await prisma.customer.findUnique({
            where: { stripeCustomerId: invoice.customer as string },
          })

          if (!customer) {
            logger.error(`Customer not found for invoice: ${invoice.id}`)
            break
          }

          // Use only essential fields
          await prisma.invoice.upsert({
            where: { id: invoice.id },
            update: {
              status: invoice.status,
              amountDue: safeBigInt(invoice.amount_due) || BigInt(0),
              amountPaid: safeBigInt(invoice.amount_paid) || BigInt(0),
              amountRemaining: safeBigInt(invoice.amount_remaining) || BigInt(0),
              total: safeBigInt(invoice.total) || BigInt(0),
              subtotal: safeBigInt(invoice.subtotal) || BigInt(0),
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              invoicePdf: invoice.invoice_pdf,
            },
            create: {
              id: invoice.id,
              customerId: customer.id,
              status: invoice.status,
              currency: invoice.currency,
              customer: invoice.customer as string,
              collectionMethod: invoice.collection_method || 'charge_automatically',
              amountDue: safeBigInt(invoice.amount_due) || BigInt(0),
              amountPaid: safeBigInt(invoice.amount_paid) || BigInt(0),
              amountRemaining: safeBigInt(invoice.amount_remaining) || BigInt(0),
              total: safeBigInt(invoice.total) || BigInt(0),
              subtotal: safeBigInt(invoice.subtotal) || BigInt(0),
              periodEnd: safeTimestampToDate(invoice.period_end) || new Date(),
              periodStart: safeTimestampToDate(invoice.period_start) || new Date(),
              created: safeTimestampToDate(invoice.created) || new Date(),
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              invoicePdf: invoice.invoice_pdf,
            },
          })
          logger.info(`Invoice ${event.type}: ${invoice.id}`)
          break
        }

        // Skip complex payment method events for now to avoid schema issues
        case 'payment_method.attached':
        case 'payment_method.automatically_updated':
        case 'payment_method.updated':
        case 'payment_method.detached': {
          logger.info(`Payment method event skipped: ${event.type}`)
          break
        }

        // Skip payment intent events for now
        case 'payment_intent.created':
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed': {
          logger.info(`Payment intent event skipped: ${event.type}`)
          break
        }

        // Skip checkout session events for now
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
        case 'checkout.session.async_payment_failed':
        case 'checkout.session.expired': {
          logger.info(`Checkout session event skipped: ${event.type}`)
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