import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import Stripe from 'stripe'

// Rate limiting map (in production, use Redis or similar)
const rateLimitMap = new Map()

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

// Helper to extract customer ID from Stripe customer string or object
function extractCustomerId(customer: string | Stripe.Customer | null): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
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

    // Store webhook event for audit trail - use exact schema field names
    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          eventId: event.id, // Use camelCase as per schema
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
        // Customer events
        case 'customer.created':
        case 'customer.updated': {
          const customer = event.data.object as Stripe.Customer
          
          await prisma.customer.upsert({
            where: { stripeCustomerId: customer.id }, // Use camelCase
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
              stripeCustomerId: customer.id, // Use camelCase
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
            where: { stripeCustomerId: customer.id }, // Use camelCase
            data: {
              data: customer as any,
              updatedAt: new Date(),
            },
          })
          
          logger.info(`Customer deleted: ${customer.id}`)
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
          
          await prisma.product.updateMany({
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

        // Price events
        case 'price.created':
        case 'price.updated': {
          const price = event.data.object as Stripe.Price
          
          await prisma.price.upsert({
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
          
          await prisma.price.updateMany({
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

        // Subscription events
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.paused':
        case 'customer.subscription.resumed': {
          const subscription = event.data.object as Stripe.Subscription
          const customerId = extractCustomerId(subscription.customer)
          
          if (!customerId) {
            logger.error(`No customer ID found for subscription: ${subscription.id}`)
            break
          }

          // Find our customer record using correct field name
          const customer = await prisma.customer.findUnique({
            where: { stripeCustomerId: customerId }, // Use camelCase
          })

          if (!customer) {
            logger.error(`Customer not found for subscription: ${subscription.id}`)
            break
          }

          // Extract price ID from subscription items
          const priceId = subscription.items.data[0]?.price.id || null

          await prisma.subscription.upsert({
            where: { id: subscription.id },
            update: {
              status: subscription.status,
              cancel_at_period_end: subscription.cancel_at_period_end,
              current_period_end: safeTimestampToDate(subscription.current_period_end) || new Date(),
              current_period_start: safeTimestampToDate(subscription.current_period_start) || new Date(),
              cancel_at: safeTimestampToDate(subscription.cancel_at),
              canceled_at: safeTimestampToDate(subscription.canceled_at),
              ended_at: safeTimestampToDate(subscription.ended_at),
              trial_start: safeTimestampToDate(subscription.trial_start),
              trial_end: safeTimestampToDate(subscription.trial_end),
              priceId: priceId,
              metadata: subscription.metadata as any,
              object: subscription.object,
              application_fee_percent: subscription.application_fee_percent,
              automatic_tax: subscription.automatic_tax as any,
              billing_cycle_anchor: safeTimestampToDate(subscription.billing_cycle_anchor),
              billing_thresholds: subscription.billing_thresholds as any,
              collection_method: subscription.collection_method,
              currency: subscription.currency,
              customer: customerId,
              days_until_due: subscription.days_until_due,
              default_payment_method: subscription.default_payment_method,
              default_source: subscription.default_source,
              default_tax_rates: subscription.default_tax_rates as any,
              description: subscription.description,
              discount: subscription.discount as any,
              items: subscription.items as any,
              latest_invoice: subscription.latest_invoice,
              livemode: subscription.livemode,
              next_pending_invoice_item_invoice: safeTimestampToDate(subscription.next_pending_invoice_item_invoice),
              pause_collection: subscription.pause_collection as any,
              payment_settings: subscription.payment_settings as any,
              pending_invoice_item_interval: subscription.pending_invoice_item_interval as any,
              pending_setup_intent: subscription.pending_setup_intent,
              pending_update: subscription.pending_update as any,
              schedule: subscription.schedule,
              start_date: safeTimestampToDate(subscription.start_date) || new Date(),
              test_clock: subscription.test_clock,
              transfer_data: subscription.transfer_data as any,
              data: subscription as any,
              updated: new Date(),
            },
            create: {
              id: subscription.id,
              userId: customer.id,
              currency: subscription.currency,
              customer: customerId,
              status: subscription.status,
              cancel_at_period_end: subscription.cancel_at_period_end,
              current_period_end: safeTimestampToDate(subscription.current_period_end) || new Date(),
              current_period_start: safeTimestampToDate(subscription.current_period_start) || new Date(),
              start_date: safeTimestampToDate(subscription.start_date) || new Date(),
              created: safeTimestampToDate(subscription.created) || new Date(),
              cancel_at: safeTimestampToDate(subscription.cancel_at),
              canceled_at: safeTimestampToDate(subscription.canceled_at),
              ended_at: safeTimestampToDate(subscription.ended_at),
              trial_start: safeTimestampToDate(subscription.trial_start),
              trial_end: safeTimestampToDate(subscription.trial_end),
              priceId: priceId,
              metadata: subscription.metadata as any,
              object: subscription.object,
              application_fee_percent: subscription.application_fee_percent,
              automatic_tax: subscription.automatic_tax as any,
              billing_cycle_anchor: safeTimestampToDate(subscription.billing_cycle_anchor),
              billing_thresholds: subscription.billing_thresholds as any,
              collection_method: subscription.collection_method,
              days_until_due: subscription.days_until_due,
              default_payment_method: subscription.default_payment_method,
              default_source: subscription.default_source,
              default_tax_rates: subscription.default_tax_rates as any,
              description: subscription.description,
              discount: subscription.discount as any,
              items: subscription.items as any,
              latest_invoice: subscription.latest_invoice,
              livemode: subscription.livemode,
              next_pending_invoice_item_invoice: safeTimestampToDate(subscription.next_pending_invoice_item_invoice),
              pause_collection: subscription.pause_collection as any,
              payment_settings: subscription.payment_settings as any,
              pending_invoice_item_interval: subscription.pending_invoice_item_interval as any,
              pending_setup_intent: subscription.pending_setup_intent,
              pending_update: subscription.pending_update as any,
              schedule: subscription.schedule,
              test_clock: subscription.test_clock,
              transfer_data: subscription.transfer_data as any,
              data: subscription as any,
              updated: new Date(),
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
              ended_at: safeTimestampToDate(subscription.ended_at) || new Date(),
              canceled_at: safeTimestampToDate(subscription.canceled_at) || new Date(),
              data: subscription as any,
              updated: new Date(),
            },
          })
          
          logger.info(`Subscription deleted: ${subscription.id}`)
          break
        }

        // Invoice events
        case 'invoice.created':
        case 'invoice.paid':
        case 'invoice.payment_failed':
        case 'invoice.upcoming': {
          const invoice = event.data.object as Stripe.Invoice
          const customerId = extractCustomerId(invoice.customer)
          
          if (!customerId) {
            logger.error(`No customer ID found for invoice: ${invoice.id}`)
            break
          }

          const customer = await prisma.customer.findUnique({
            where: { stripeCustomerId: customerId }, // Use camelCase
          })

          if (!customer) {
            logger.error(`Customer not found for invoice: ${invoice.id}`)
            break
          }

          // Extract finalized_at from status_transitions
          const finalizedAt = invoice.status_transitions?.finalized_at 
            ? safeTimestampToDate(invoice.status_transitions.finalized_at)
            : null

          await prisma.invoice.upsert({
            where: { id: invoice.id },
            update: {
              status: invoice.status || 'draft',
              amount_due: safeBigInt(invoice.amount_due) || BigInt(0),
              amount_paid: safeBigInt(invoice.amount_paid) || BigInt(0),
              amount_remaining: safeBigInt(invoice.amount_remaining) || BigInt(0),
              total: safeBigInt(invoice.total) || BigInt(0),
              subtotal: safeBigInt(invoice.subtotal) || BigInt(0),
              tax: safeBigInt(invoice.tax),
              hosted_invoice_url: invoice.hosted_invoice_url,
              invoice_pdf: invoice.invoice_pdf,
              paid: invoice.paid,
              number: invoice.number,
              finalized_at: finalizedAt, // Use the new field
              due_date: safeTimestampToDate(invoice.due_date),
              subscription: extractCustomerId(invoice.subscription),
              data: invoice as any,
              updated: new Date(),
            },
            create: {
              id: invoice.id,
              customerId: customer.id,
              status: invoice.status || 'draft',
              currency: invoice.currency,
              customer: customerId,
              collection_method: invoice.collection_method,
              amount_due: safeBigInt(invoice.amount_due) || BigInt(0),
              amount_paid: safeBigInt(invoice.amount_paid) || BigInt(0),
              amount_remaining: safeBigInt(invoice.amount_remaining) || BigInt(0),
              total: safeBigInt(invoice.total) || BigInt(0),
              subtotal: safeBigInt(invoice.subtotal) || BigInt(0),
              tax: safeBigInt(invoice.tax),
              period_end: safeTimestampToDate(invoice.period_end) || new Date(),
              period_start: safeTimestampToDate(invoice.period_start) || new Date(),
              created: safeTimestampToDate(invoice.created) || new Date(),
              hosted_invoice_url: invoice.hosted_invoice_url,
              invoice_pdf: invoice.invoice_pdf,
              paid: invoice.paid,
              number: invoice.number,
              finalized_at: finalizedAt, // Use the new field
              due_date: safeTimestampToDate(invoice.due_date),
              subscription: extractCustomerId(invoice.subscription),
              metadata: invoice.metadata as any,
              account_country: invoice.account_country,
              account_name: invoice.account_name,
              account_tax_ids: invoice.account_tax_ids as any,
              amount_shipping: safeBigInt(invoice.amount_shipping) || BigInt(0),
              application: invoice.application,
              application_fee_amount: safeBigInt(invoice.application_fee_amount),
              attempt_count: invoice.attempt_count || 0,
              attempted: invoice.attempted || false,
              auto_advance: invoice.auto_advance !== false,
              automatic_tax: invoice.automatic_tax as any || {},
              billing_reason: invoice.billing_reason,
              charge: invoice.charge,
              custom_fields: invoice.custom_fields as any,
              customer_address: invoice.customer_address as any,
              customer_email: invoice.customer_email,
              customer_name: invoice.customer_name,
              customer_phone: invoice.customer_phone,
              customer_shipping: invoice.customer_shipping as any,
              customer_tax_exempt: invoice.customer_tax_exempt,
              customer_tax_ids: invoice.customer_tax_ids as any,
              default_payment_method: invoice.default_payment_method,
              default_source: invoice.default_source,
              default_tax_rates: invoice.default_tax_rates as any || [],
              description: invoice.description,
              discount: invoice.discount as any,
              discounts: invoice.discounts as any || [],
              effective_at: safeTimestampToDate(invoice.effective_at),
              ending_balance: safeBigInt(invoice.ending_balance),
              footer: invoice.footer,
              from_invoice: invoice.from_invoice as any,
              last_finalization_error: invoice.last_finalization_error as any,
              latest_revision: invoice.latest_revision,
              lines: invoice.lines as any || {},
              livemode: invoice.livemode,
              next_payment_attempt: safeTimestampToDate(invoice.next_payment_attempt),
              object: invoice.object,
              on_behalf_of: invoice.on_behalf_of,
              paid_out_of_band: invoice.paid_out_of_band || false,
              payment_intent: invoice.payment_intent,
              payment_settings: invoice.payment_settings as any || {},
              post_payment_credit_notes_amount: safeBigInt(invoice.post_payment_credit_notes_amount) || BigInt(0),
              pre_payment_credit_notes_amount: safeBigInt(invoice.pre_payment_credit_notes_amount) || BigInt(0),
              quote: invoice.quote,
              receipt_number: invoice.receipt_number,
              rendering_options: invoice.rendering_options as any,
              shipping_cost: invoice.shipping_cost as any,
              shipping_details: invoice.shipping_details as any,
              starting_balance: safeBigInt(invoice.starting_balance) || BigInt(0),
              statement_descriptor: invoice.statement_descriptor,
              status_transitions: invoice.status_transitions as any || {},
              subscription_details: invoice.subscription_details as any,
              subtotal_excluding_tax: safeBigInt(invoice.subtotal_excluding_tax),
              test_clock: invoice.test_clock,
              total_discount_amounts: invoice.total_discount_amounts as any || [],
              total_excluding_tax: safeBigInt(invoice.total_excluding_tax),
              total_tax_amounts: invoice.total_tax_amounts as any || [],
              transfer_data: invoice.transfer_data as any,
              webhooks_delivered_at: safeTimestampToDate(invoice.webhooks_delivered_at),
              data: invoice as any,
            },
          })
          
          logger.info(`Invoice ${event.type}: ${invoice.id} (${invoice.status})`)
          break
        }

        case 'invoice.deleted': {
          const invoice = event.data.object as Stripe.Invoice
          
          await prisma.invoice.updateMany({
            where: { id: invoice.id },
            data: {
              data: invoice as any,
              updated: new Date(),
            },
          })
          
          logger.info(`Invoice deleted: ${invoice.id}`)
          break
        }

        // Payment Method events - store only essential data
        case 'payment_method.attached':
        case 'payment_method.automatically_updated':
        case 'payment_method.updated': {
          const paymentMethod = event.data.object as Stripe.PaymentMethod
          const customerId = extractCustomerId(paymentMethod.customer)
          
          if (customerId) {
            await prisma.paymentMethod.upsert({
              where: { id: paymentMethod.id },
              update: {
                type: paymentMethod.type,
                billing_details: paymentMethod.billing_details as any,
                card: paymentMethod.card as any,
                metadata: paymentMethod.metadata as any,
                data: paymentMethod as any,
                updated: new Date(),
              },
              create: {
                id: paymentMethod.id,
                type: paymentMethod.type,
                customer: customerId,
                billing_details: paymentMethod.billing_details as any,
                card: paymentMethod.card as any,
                metadata: paymentMethod.metadata as any,
                livemode: paymentMethod.livemode,
                object: paymentMethod.object,
                data: paymentMethod as any,
                created: safeTimestampToDate(paymentMethod.created) || new Date(),
                updated: new Date(),
              },
            })
          }
          
          logger.info(`Payment method ${event.type}: ${paymentMethod.id}`)
          break
        }

        case 'payment_method.detached': {
          const paymentMethod = event.data.object as Stripe.PaymentMethod
          
          await prisma.paymentMethod.updateMany({
            where: { id: paymentMethod.id },
            data: {
              customer: null, // Detached from customer
              data: paymentMethod as any,
              updated: new Date(),
            },
          })
          
          logger.info(`Payment method detached: ${paymentMethod.id}`)
          break
        }

        // Payment Intent events
        case 'payment_intent.created':
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed':
        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent
          const customerId = extractCustomerId(paymentIntent.customer)
          
          if (customerId) {
            const customer = await prisma.customer.findUnique({
              where: { stripeCustomerId: customerId }, // Use camelCase
            })

            if (customer) {
              await prisma.stripePaymentIntent.upsert({
                where: { id: paymentIntent.id },
                update: {
                  amount: safeBigInt(paymentIntent.amount) || BigInt(0),
                  currency: paymentIntent.currency,
                  status: paymentIntent.status,
                  capture_method: paymentIntent.capture_method,
                  confirmation_method: paymentIntent.confirmation_method,
                  amount_received: safeBigInt(paymentIntent.amount_received) || BigInt(0),
                  canceled_at: safeTimestampToDate(paymentIntent.canceled_at),
                  customer: customerId,
                  data: paymentIntent as any,
                  updated: new Date(),
                },
                create: {
                  id: paymentIntent.id,
                  customerId: customer.id,
                  amount: safeBigInt(paymentIntent.amount) || BigInt(0),
                  currency: paymentIntent.currency,
                  status: paymentIntent.status,
                  capture_method: paymentIntent.capture_method,
                  confirmation_method: paymentIntent.confirmation_method,
                  customer: customerId,
                  amount_received: safeBigInt(paymentIntent.amount_received) || BigInt(0),
                  canceled_at: safeTimestampToDate(paymentIntent.canceled_at),
                  metadata: paymentIntent.metadata as any,
                  amount_capturable: safeBigInt(paymentIntent.amount_capturable) || BigInt(0),
                  amount_details: paymentIntent.amount_details as any,
                  application: paymentIntent.application,
                  application_fee_amount: safeBigInt(paymentIntent.application_fee_amount),
                  automatic_payment_methods: paymentIntent.automatic_payment_methods as any,
                  cancellation_reason: paymentIntent.cancellation_reason,
                  charges: paymentIntent.charges as any || {},
                  client_secret: paymentIntent.client_secret,
                  description: paymentIntent.description,
                  invoice: paymentIntent.invoice,
                  last_payment_error: paymentIntent.last_payment_error as any,
                  latest_charge: paymentIntent.latest_charge,
                  livemode: paymentIntent.livemode,
                  next_action: paymentIntent.next_action as any,
                  object: paymentIntent.object,
                  on_behalf_of: paymentIntent.on_behalf_of,
                  payment_method: paymentIntent.payment_method,
                  payment_method_configuration_details: paymentIntent.payment_method_configuration_details as any,
                  payment_method_options: paymentIntent.payment_method_options as any || {},
                  payment_method_types: paymentIntent.payment_method_types as any || [],
                  processing: paymentIntent.processing as any,
                  receipt_email: paymentIntent.receipt_email,
                  review: paymentIntent.review,
                  setup_future_usage: paymentIntent.setup_future_usage,
                  shipping: paymentIntent.shipping as any,
                  statement_descriptor: paymentIntent.statement_descriptor,
                  statement_descriptor_suffix: paymentIntent.statement_descriptor_suffix,
                  transfer_data: paymentIntent.transfer_data as any,
                  transfer_group: paymentIntent.transfer_group,
                  data: paymentIntent as any,
                  created: safeTimestampToDate(paymentIntent.created) || new Date(),
                  updated: new Date(),
                },
              })
            }
          }
          
          logger.info(`Payment intent ${event.type}: ${paymentIntent.id}`)
          break
        }

        // Checkout Session events
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
        case 'checkout.session.async_payment_failed':
        case 'checkout.session.expired': {
          const session = event.data.object as Stripe.Checkout.Session
          const customerId = extractCustomerId(session.customer)
          
          if (customerId) {
            const customer = await prisma.customer.findUnique({
              where: { stripeCustomerId: customerId }, // Use camelCase
            })

            if (customer) {
              await prisma.stripeCheckoutSession.upsert({
                where: { id: session.id },
                update: {
                  payment_status: session.payment_status,
                  status: session.status,
                  amount_total: safeBigInt(session.amount_total),
                  currency: session.currency,
                  customer: customerId,
                  payment_intent: session.payment_intent as string,
                  subscription: session.subscription as string,
                  data: session as any,
                  updated: new Date(),
                },
                create: {
                  id: session.id,
                  customerId: customer.id,
                  payment_status: session.payment_status,
                  mode: session.mode,
                  amount_total: safeBigInt(session.amount_total),
                  currency: session.currency,
                  expires_at: safeTimestampToDate(session.expires_at),
                  url: session.url,
                  customer: customerId,
                  payment_intent: session.payment_intent as string,
                  subscription: session.subscription as string,
                  metadata: session.metadata as any,
                  after_expiration: session.after_expiration as any,
                  allow_promotion_codes: session.allow_promotion_codes,
                  amount_subtotal: safeBigInt(session.amount_subtotal),
                  automatic_tax: session.automatic_tax as any || {},
                  billing_address_collection: session.billing_address_collection,
                  cancel_url: session.cancel_url,
                  client_reference_id: session.client_reference_id,
                  consent: session.consent as any,
                  consent_collection: session.consent_collection as any,
                  currency_conversion: session.currency_conversion as any,
                  custom_fields: session.custom_fields as any || [],
                  custom_text: session.custom_text as any || {},
                  customer_creation: session.customer_creation,
                  customer_details: session.customer_details as any,
                  customer_email: session.customer_email,
                  invoice: session.invoice,
                  invoice_creation: session.invoice_creation as any,
                  livemode: session.livemode,
                  locale: session.locale,
                  object: session.object,
                  payment_link: session.payment_link,
                  payment_method_collection: session.payment_method_collection,
                  payment_method_configuration_details: session.payment_method_configuration_details as any,
                  payment_method_options: session.payment_method_options as any || {},
                  payment_method_types: session.payment_method_types as any || [],
                  phone_number_collection: session.phone_number_collection as any,
                  recovered_from: session.recovered_from,
                  setup_intent: session.setup_intent,
                  shipping_address_collection: session.shipping_address_collection as any,
                  shipping_cost: session.shipping_cost as any,
                  shipping_details: session.shipping_details as any,
                  shipping_options: session.shipping_options as any || [],
                  submit_type: session.submit_type,
                  success_url: session.success_url,
                  total_details: session.total_details as any,
                  ui_mode: session.ui_mode,
                  data: session as any,
                  created: safeTimestampToDate(session.created) || new Date(),
                  updated: new Date(),
                },
              })
            }
          }
          
          logger.info(`Checkout session ${event.type}: ${session.id}`)
          break
        }

        // Coupon events
        case 'coupon.created':
        case 'coupon.updated': {
          const coupon = event.data.object as Stripe.Coupon
          
          await prisma.coupon.upsert({
            where: { id: coupon.id },
            update: {
              name: coupon.name,
              amountOff: safeBigInt(coupon.amount_off),
              appliesTo: coupon.applies_to as any,
              currency: coupon.currency,
              duration: coupon.duration,
              durationInMonths: coupon.duration_in_months,
              livemode: coupon.livemode,
              maxRedemptions: coupon.max_redemptions,
              metadata: coupon.metadata as any,
              percentOff: coupon.percent_off,
              redeemBy: safeTimestampToDate(coupon.redeem_by),
              timesRedeemed: coupon.times_redeemed,
              valid: coupon.valid,
              data: coupon as any,
              updated: new Date(),
            },
            create: {
              id: coupon.id,
              object: coupon.object,
              amountOff: safeBigInt(coupon.amount_off),
              appliesTo: coupon.applies_to as any,
              currency: coupon.currency,
              duration: coupon.duration,
              durationInMonths: coupon.duration_in_months,
              livemode: coupon.livemode,
              maxRedemptions: coupon.max_redemptions,
              metadata: coupon.metadata as any,
              name: coupon.name,
              percentOff: coupon.percent_off,
              redeemBy: safeTimestampToDate(coupon.redeem_by),
              timesRedeemed: coupon.times_redeemed,
              valid: coupon.valid,
              data: coupon as any,
              created: safeTimestampToDate(coupon.created) || new Date(),
              updated: new Date(),
            },
          })
          
          logger.info(`Coupon ${event.type}: ${coupon.name || coupon.id}`)
          break
        }

        case 'coupon.deleted': {
          const coupon = event.data.object as Stripe.Coupon
          
          await prisma.coupon.updateMany({
            where: { id: coupon.id },
            data: {
              valid: false,
              data: coupon as any,
              updated: new Date(),
            },
          })
          
          logger.info(`Coupon deleted: ${coupon.id}`)
          break
        }

        // Promotion code events
        case 'promotion_code.created':
        case 'promotion_code.updated': {
          const promoCode = event.data.object as Stripe.PromotionCode
          const couponId = extractCustomerId(promoCode.coupon) || ''
          
          await prisma.promotionCode.upsert({
            where: { id: promoCode.id },
            update: {
              code: promoCode.code,
              active: promoCode.active,
              customer: promoCode.customer,
              expiresAt: safeTimestampToDate(promoCode.expires_at),
              firstTimeTransaction: promoCode.first_time_transaction,
              livemode: promoCode.livemode,
              maxRedemptions: promoCode.max_redemptions,
              metadata: promoCode.metadata as any,
              restrictions: promoCode.restrictions as any,
              timesRedeemed: promoCode.times_redeemed,
              data: promoCode as any,
              updated: new Date(),
            },
            create: {
              id: promoCode.id,
              object: promoCode.object,
              active: promoCode.active,
              code: promoCode.code,
              coupon: couponId,
              customer: promoCode.customer,
              expiresAt: safeTimestampToDate(promoCode.expires_at),
              firstTimeTransaction: promoCode.first_time_transaction,
              livemode: promoCode.livemode,
              maxRedemptions: promoCode.max_redemptions,
              metadata: promoCode.metadata as any,
              restrictions: promoCode.restrictions as any,
              timesRedeemed: promoCode.times_redeemed,
              data: promoCode as any,
              created: safeTimestampToDate(promoCode.created) || new Date(),
              updated: new Date(),
            },
          })
          
          logger.info(`Promotion code ${event.type}: ${promoCode.code}`)
          break
        }

        default: {
          logger.info(`Unhandled webhook event type: ${event.type}`)
          break
        }
      }

      // Mark webhook as processed - use exact field names
      await prisma.stripeWebhookEvent.updateMany({
        where: { eventId: event.id }, // Use camelCase
        data: { 
          processed: true, 
          processedAt: new Date() // Use camelCase
        },
      })

      logger.info(`Successfully processed webhook: ${event.type} (${event.id})`)

    } catch (error) {
      logger.error(`Error processing webhook ${event.type}:`, error)
      
      // Mark webhook as failed - use exact field names
      await prisma.stripeWebhookEvent.updateMany({
        where: { eventId: event.id }, // Use camelCase
        data: { 
          processed: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error' // Use camelCase
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