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

// Helper to safely extract subscription periods from Stripe subscription object
function extractSubscriptionPeriods(subscription: Stripe.Subscription) {
  // For trial subscriptions, current_period_start/end might not be set
  // Use trial dates or creation date as fallbacks
  const currentPeriodStart = safeTimestampToDate(subscription.current_period_start) || 
                            safeTimestampToDate(subscription.trial_start) ||
                            safeTimestampToDate(subscription.created) ||
                            new Date()
                            
  const currentPeriodEnd = safeTimestampToDate(subscription.current_period_end) || 
                          safeTimestampToDate(subscription.trial_end) ||
                          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now as fallback

  return {
    currentPeriodStart,
    currentPeriodEnd,
    trialStart: safeTimestampToDate(subscription.trial_start),
    trialEnd: safeTimestampToDate(subscription.trial_end),
    created: safeTimestampToDate(subscription.created),
    cancelAt: safeTimestampToDate(subscription.cancel_at),
    canceledAt: safeTimestampToDate(subscription.canceled_at),
  }
}
// Helper to update API keys and venues based on subscription status
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
        // Product events
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

        // Price events
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
              product: typeof price.product === 'string' ? price.product : price.product.id,
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

        // Customer events
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
              id: crypto.randomUUID(),
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

        // Checkout session events
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session
          const customerId = extractCustomerId(session.customer)

          if (customerId) {
            try {
              const customer = await prisma.customer.findUnique({
                where: { stripeCustomerId: customerId },
              })

              if (customer) {
                await prisma.stripeCheckoutSession.upsert({
                  where: { id: session.id },
                  update: {
                    paymentStatus: session.payment_status,
                    completedAt: new Date(),
                    metadata: session.metadata as any,
                  },
                  create: {
                    id: session.id,
                    customerId: customer.id,
                    paymentStatus: session.payment_status,
                    mode: session.mode!,
                    amountTotal: session.amount_total ? BigInt(session.amount_total) : null,
                    currency: session.currency || 'usd',
                    created: new Date(session.created * 1000),
                    expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
                    url: session.url,
                    metadata: session.metadata as any,
                    completedAt: new Date(),
                  },
                })

                // If checkout was successful and it's a subscription, reactivate access
                if (session.payment_status === 'paid' && session.mode === 'subscription') {
                  await updateApiKeysAndVenues(customerId, false)
                }
              }
            } catch (error) {
              logger.error('Error processing completed checkout session:', error)
            }
          }

          logger.info(`Checkout session completed: ${session.id}`)
          break
        }

        case 'checkout.session.expired': {
          const session = event.data.object as Stripe.Checkout.Session
          const customerId = extractCustomerId(session.customer)

          if (customerId) {
            try {
              const customer = await prisma.customer.findUnique({
                where: { stripeCustomerId: customerId },
              })

              if (customer) {
                await prisma.stripeCheckoutSession.updateMany({
                  where: { id: session.id },
                  data: {
                    paymentStatus: 'expired',
                    metadata: session.metadata as any,
                  },
                })
              }
            } catch (error) {
              logger.error('Error processing expired checkout session:', error)
            }
          }

          logger.info(`Checkout session expired: ${session.id}`)
          break
        }

        case 'checkout.session.async_payment_succeeded': {
          const session = event.data.object as Stripe.Checkout.Session
          const customerId = extractCustomerId(session.customer)

          if (customerId) {
            try {
              const customer = await prisma.customer.findUnique({
                where: { stripeCustomerId: customerId },
              })

              if (customer) {
                await prisma.stripeCheckoutSession.updateMany({
                  where: { id: session.id },
                  data: {
                    paymentStatus: session.payment_status,
                    completedAt: new Date(),
                    metadata: session.metadata as any,
                  },
                })

                // Reactivate access on successful payment
                await updateApiKeysAndVenues(customerId, false)
              }
            } catch (error) {
              logger.error('Error processing async payment succeeded:', error)
            }
          }

          logger.info(`Checkout session async payment succeeded: ${session.id}`)
          break
        }

        case 'checkout.session.async_payment_failed': {
          const session = event.data.object as Stripe.Checkout.Session
          const customerId = extractCustomerId(session.customer)

          if (customerId) {
            try {
              const customer = await prisma.customer.findUnique({
                where: { stripeCustomerId: customerId },
              })

              if (customer) {
                await prisma.stripeCheckoutSession.updateMany({
                  where: { id: session.id },
                  data: {
                    paymentStatus: session.payment_status,
                    metadata: session.metadata as any,
                  },
                })

                // Suspend access on failed payment
                await updateApiKeysAndVenues(customerId, true)
              }
            } catch (error) {
              logger.error('Error processing async payment failed:', error)
            }
          }

          logger.info(`Checkout session async payment failed: ${session.id}`)
          break
        }

        // Subscription events
        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (customerId) {
            try {
              const customer = await prisma.customer.findUnique({
                where: { stripeCustomerId: customerId },
              })
              
              if (customer) {
                const periods = extractSubscriptionPeriods(subscription)
                
                await prisma.subscription.upsert({
                  where: { id: subscription.id },
                  update: {
                    status: subscription.status,
                    currentPeriodStart: periods.currentPeriodStart,
                    currentPeriodEnd: periods.currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    cancelAt: periods.cancelAt,
                    canceledAt: periods.canceledAt,
                    trialStart: periods.trialStart,
                    trialEnd: periods.trialEnd,
                    metadata: subscription.metadata as any,
                    data: subscription as any,
                    updated: new Date(),
                  },
                  create: {
                    id: subscription.id,
                    object: subscription.object,
                    status: subscription.status,
                    currentPeriodStart: periods.currentPeriodStart,
                    currentPeriodEnd: periods.currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    cancelAt: periods.cancelAt,
                    canceledAt: periods.canceledAt,
                    trialStart: periods.trialStart,
                    trialEnd: periods.trialEnd,
                    metadata: subscription.metadata as any,
                    created: periods.created || new Date(),
                    data: subscription as any,
                    livemode: subscription.livemode,
                    user: {
                      connect: {
                        id: customer.id
                      }
                    }
                  },
                })

                // Activate access for active/trialing subscriptions
                if (['active', 'trialing'].includes(subscription.status)) {
                  await updateApiKeysAndVenues(customerId, false)
                }
              }
            } catch (error) {
              logger.error('Error storing subscription:', error)
            }
          }
          
          logger.info(`Subscription created: ${subscription.id} (${subscription.status})`)
          break
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (customerId) {
            try {
              const customer = await prisma.customer.findUnique({
                where: { stripeCustomerId: customerId },
              })
              
              if (customer) {
                const periods = extractSubscriptionPeriods(subscription)
                
                await prisma.subscription.upsert({
                  where: { id: subscription.id },
                  update: {
                    status: subscription.status,
                    currentPeriodStart: periods.currentPeriodStart,
                    currentPeriodEnd: periods.currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    cancelAt: periods.cancelAt,
                    canceledAt: periods.canceledAt,
                    trialStart: periods.trialStart,
                    trialEnd: periods.trialEnd,
                    metadata: subscription.metadata as any,
                    data: subscription as any,
                    updated: new Date(),
                  },
                  create: {
                    id: subscription.id,
                    object: subscription.object,
                    status: subscription.status,
                    currentPeriodStart: periods.currentPeriodStart,
                    currentPeriodEnd: periods.currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    cancelAt: periods.cancelAt,
                    canceledAt: periods.canceledAt,
                    trialStart: periods.trialStart,
                    trialEnd: periods.trialEnd,
                    metadata: subscription.metadata as any,
                    created: periods.created || new Date(),
                    data: subscription as any,
                    livemode: subscription.livemode,
                    user: {
                      connect: {
                        id: customer.id
                      }
                    }
                  },
                })

                // Update access based on subscription status
                const shouldSuspend = !['active', 'trialing'].includes(subscription.status)
                await updateApiKeysAndVenues(customerId, shouldSuspend)
              }
            } catch (error) {
              logger.error('Error updating subscription:', error)
            }
          }
          
          logger.info(`Subscription updated: ${subscription.id} (${subscription.status})`)
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (customerId) {
            try {
              await prisma.subscription.updateMany({
                where: { id: subscription.id },
                data: {
                  status: 'canceled',
                  canceledAt: new Date(),
                  data: subscription as any,
                  updated: new Date(),
                },
              })

              // Suspend access when subscription is deleted
              await updateApiKeysAndVenues(customerId, true)
            } catch (error) {
              logger.error('Error marking subscription as deleted:', error)
            }
          }
          
          logger.info(`Subscription deleted: ${subscription.id}`)
          break
        }

        case 'customer.subscription.paused': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (customerId) {
            try {
              await prisma.subscription.updateMany({
                where: { id: subscription.id },
                data: {
                  status: 'paused',
                  data: subscription as any,
                  updated: new Date(),
                },
              })

              // Suspend access when subscription is paused
              await updateApiKeysAndVenues(customerId, true)
            } catch (error) {
              logger.error('Error updating paused subscription:', error)
            }
          }
          
          logger.info(`Subscription paused: ${subscription.id}`)
          break
        }

        case 'customer.subscription.resumed': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (customerId) {
            try {
              await prisma.subscription.updateMany({
                where: { id: subscription.id },
                data: {
                  status: subscription.status,
                  data: subscription as any,
                  updated: new Date(),
                },
              })

              // Reactivate access when subscription is resumed
              if (['active', 'trialing'].includes(subscription.status)) {
                await updateApiKeysAndVenues(customerId, false)
              }
            } catch (error) {
              logger.error('Error updating resumed subscription:', error)
            }
          }
          
          logger.info(`Subscription resumed: ${subscription.id} (${subscription.status})`)
          break
        }

        // Invoice events
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice
          const customerId = extractCustomerId(invoice.customer)
          
          if (customerId && invoice.billing_reason === 'subscription_cycle') {
            // Only suspend on subscription payment failures, not one-time payments
            await updateApiKeysAndVenues(customerId, true)
          }
          
          logger.info(`Invoice payment failed: ${invoice.id} for customer ${customerId}`)
          break
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice
          const customerId = extractCustomerId(invoice.customer)
          
          if (customerId && invoice.billing_reason === 'subscription_cycle') {
            // Reactivate on successful subscription payment
            await updateApiKeysAndVenues(customerId, false)
          }
          
          logger.info(`Invoice payment succeeded: ${invoice.id} for customer ${customerId}`)
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