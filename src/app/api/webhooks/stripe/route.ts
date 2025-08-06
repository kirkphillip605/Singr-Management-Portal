import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import Stripe from 'stripe'

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

// Helper to extract customer ID from Stripe customer string or object
function extractCustomerId(customer: string | Stripe.Customer | null): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

async function updateApiKeysAndVenues(customerId: string, suspend: boolean) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { stripeCustomerId: customerId },
      include: {
        user: {
          include: {
            venues: true,
          }
        },
        apiKeys: true,
      },
    })

    if (!customer) {
      logger.warn(`Customer not found for Stripe ID: ${customerId}`)
      return
    }

    // Update API keys status
    await prisma.apiKey.updateMany({
      where: { 
        customerId: customer.id,
        status: suspend ? 'active' : 'suspended'
      },
      data: { 
        status: suspend ? 'suspended' : 'active',
        updatedAt: new Date(),
      },
    })

    if (suspend) {
      // Set all venues to not accepting requests when subscription lapses
      await prisma.venue.updateMany({
        where: { userId: customer.user.id },
        data: { 
          acceptingRequests: false,
          updatedAt: new Date(),
        },
      })

      // Update venue states
      await prisma.state.updateMany({
        where: {
          venue: {
            userId: customer.user.id,
          }
        },
        data: {
          accepting: false,
          serial: { increment: 1 },
          updatedAt: new Date(),
        },
      })
    }
    
    logger.info(`${suspend ? 'Suspended' : 'Reactivated'} access for customer ${customerId}`)
  } catch (error) {
    logger.error(`Error updating access for customer ${customerId}:`, error)
  }
}

export async function POST(request: NextRequest) {
  try {
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

    logger.info(`Stripe webhook received: ${event.type}`, { eventId: event.id })

    // Store webhook event for audit trail
    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          apiVersion: event.api_version,
          requestId: event.request?.id || null,
          endpointSecret: process.env.STRIPE_WEBHOOK_SECRET,
          payload: event as any,
          receivedAt: new Date(),
          processed: false,
        },
      })
    } catch (error) {
      logger.warn('Failed to log webhook event (continuing processing):', error)
    }

    try {
      switch (event.type) {
        // Product events - essential for plan selection
        case 'product.created':
        case 'product.updated': {
          const product = event.data.object as Stripe.Product
          
          await prisma.stripeProduct.upsert({
            where: { id: product.id },
            update: {
              active: product.active,
              name: product.name,
              description: product.description,
              images: product.images || [],
              metadata: product.metadata as any,
              packageDimensions: product.package_dimensions as any,
              shippable: product.shippable,
              statementDescriptor: product.statement_descriptor,
              taxCode: product.tax_code,
              unitLabel: product.unit_label,
              url: product.url,
              livemode: product.livemode,
              data: product as any,
              updated: new Date(),
            },
            create: {
              id: product.id,
              object: product.object,
              active: product.active,
              name: product.name,
              description: product.description,
              images: product.images || [],
              metadata: product.metadata as any,
              packageDimensions: product.package_dimensions as any,
              shippable: product.shippable,
              statementDescriptor: product.statement_descriptor,
              taxCode: product.tax_code,
              unitLabel: product.unit_label,
              url: product.url,
              livemode: product.livemode,
              data: product as any,
              created: safeTimestampToDate(product.created) || new Date(),
              updated: new Date(),
            },
          })
          
          logger.info(`Product ${event.type}: ${product.name} (${product.id})`)
          break
        }

        case 'product.deleted': {
          const product = event.data.object as Stripe.Product
          
          await prisma.stripeProduct.updateMany({
            where: { id: product.id },
            data: {
              active: false,
              data: product as any,
              updated: new Date(),
            },
          })
          
          logger.info(`Product deleted: ${product.id}`)
          break
        }

        // Price events - essential for plan selection
        case 'price.created':
        case 'price.updated': {
          const price = event.data.object as Stripe.Price
          
          await prisma.stripePrice.upsert({
            where: { id: price.id },
            update: {
              active: price.active,
              billingScheme: price.billing_scheme,
              currency: price.currency,
              customUnitAmount: price.custom_unit_amount as any,
              lookupKey: price.lookup_key,
              nickname: price.nickname,
              recurring: price.recurring as any,
              taxBehavior: price.tax_behavior,
              tiersMode: price.tiers_mode,
              transformQuantity: price.transform_quantity as any,
              type: price.type,
              unitAmount: safeBigInt(price.unit_amount),
              unitAmountDecimal: price.unit_amount_decimal,
              metadata: price.metadata as any,
              livemode: price.livemode,
              data: price as any,
              updated: new Date(),
            },
            create: {
              id: price.id,
              object: price.object,
              active: price.active,
              billingScheme: price.billing_scheme,
              currency: price.currency,
              customUnitAmount: price.custom_unit_amount as any,
              livemode: price.livemode,
              lookupKey: price.lookup_key,
              metadata: price.metadata as any,
              nickname: price.nickname,
              product: extractCustomerId(price.product) || '',
              recurring: price.recurring as any,
              taxBehavior: price.tax_behavior,
              tiersMode: price.tiers_mode,
              transformQuantity: price.transform_quantity as any,
              type: price.type,
              unitAmount: safeBigInt(price.unit_amount),
              unitAmountDecimal: price.unit_amount_decimal,
              data: price as any,
              created: safeTimestampToDate(price.created) || new Date(),
              updated: new Date(),
            },
          })
          
          logger.info(`Price ${event.type}: ${price.nickname || price.id}`)
          break
        }

        case 'price.deleted': {
          const price = event.data.object as Stripe.Price
          
          await prisma.stripePrice.updateMany({
            where: { id: price.id },
            data: {
              active: false,
              data: price as any,
              updated: new Date(),
            },
          })
          
          logger.info(`Price deleted: ${price.id}`)
          break
        }

        // Customer events - essential for linking to our users
        case 'customer.created':
        case 'customer.updated': {
          const customer = event.data.object as Stripe.Customer
          
          await prisma.customer.upsert({
            where: { stripeCustomerId: customer.id },
            update: {
              email: customer.email,
              name: customer.name,
              phone: customer.phone,
              description: customer.description,
              metadata: customer.metadata as any,
              invoice_settings: customer.invoice_settings as any,
              shipping: customer.shipping as any,
              tax_exempt: customer.tax_exempt,
              tax_ids: customer.tax_ids as any,
              livemode: customer.livemode,
              data: customer as any,
              updatedAt: new Date(),
            },
            create: {
              id: crypto.randomUUID(), // We need a UUID for our user relationship
              stripeCustomerId: customer.id,
              email: customer.email,
              name: customer.name,
              phone: customer.phone,
              description: customer.description,
              metadata: customer.metadata as any,
              invoice_settings: customer.invoice_settings as any,
              shipping: customer.shipping as any,
              tax_exempt: customer.tax_exempt,
              tax_ids: customer.tax_ids as any,
              livemode: customer.livemode,
              data: customer as any,
              createdAt: safeTimestampToDate(customer.created) || new Date(),
              updatedAt: new Date(),
            },
          })
          
          logger.info(`Customer ${event.type}: ${customer.id}`)
          break
        }

        case 'customer.deleted': {
          const customer = event.data.object as Stripe.Customer
          
          await prisma.customer.updateMany({
            where: { stripeCustomerId: customer.id },
            data: {
              data: customer as any,
              updatedAt: new Date(),
            },
          })
          
          logger.info(`Customer deleted: ${customer.id}`)
          break
        }

        // Subscription events - critical for access control
        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (customerId && (subscription.status === 'active' || subscription.status === 'trialing')) {
            await updateApiKeysAndVenues(customerId, false) // Reactivate
          }
          
          logger.info(`Subscription created: ${subscription.id} (${subscription.status})`)
          break
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (customerId) {
            const shouldSuspend = !['active', 'trialing'].includes(subscription.status)
            await updateApiKeysAndVenues(customerId, shouldSuspend)
          }
          
          logger.info(`Subscription updated: ${subscription.id} (${subscription.status})`)
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (customerId) {
            await updateApiKeysAndVenues(customerId, true) // Suspend
          }
          
          logger.info(`Subscription deleted: ${subscription.id}`)
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice
          const customerId = extractCustomerId(invoice.customer)
          
          if (customerId && invoice.billing_reason === 'subscription_cycle') {
            // Only suspend on subscription payment failures, not one-time payments
            await updateApiKeysAndVenues(customerId, true)
          }
          
          logger.info(`Payment failed: ${invoice.id} for customer ${customerId}`)
          break
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice
          const customerId = extractCustomerId(invoice.customer)
          
          if (customerId && invoice.billing_reason === 'subscription_cycle') {
            // Reactivate on successful subscription payment
            await updateApiKeysAndVenues(customerId, false)
          }
          
          logger.info(`Payment succeeded: ${invoice.id} for customer ${customerId}`)
          break
        }

        // All other events - just log for audit trail
        default: {
          logger.info(`Webhook event logged (no processing needed): ${event.type}`)
          break
        }
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