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

        // Product events
        case 'product.created':
        case 'product.updated': {
          const product = event.data.object as Stripe.Product
          
          await prisma.product.upsert({
            where: { id: product.id },
            update: {
              object: product.object,
              active: product.active,
              name: product.name,
              description: product.description,
              images: product.images || [],
              metadata: product.metadata || {},
              packageDimensions: product.package_dimensions || null,
              shippable: product.shippable,
              statementDescriptor: product.statement_descriptor,
              taxCode: product.tax_code,
              unitLabel: product.unit_label,
              url: product.url,
              updated: new Date(),
            },
            create: {
              id: product.id,
              object: product.object,
              active: product.active,
              name: product.name,
              description: product.description,
              images: product.images || [],
              metadata: product.metadata || {},
              packageDimensions: product.package_dimensions || null,
              shippable: product.shippable,
              statementDescriptor: product.statement_descriptor,
              taxCode: product.tax_code,
              unitLabel: product.unit_label,
              url: product.url,
              created: safeTimestampToDate(product.created) || new Date(),
              updated: new Date(),
            },
          })
          logger.info(`Product ${event.type}: ${product.id}`)
          break
        }

        // Price events
        case 'price.created':
        case 'price.updated': {
          const price = event.data.object as Stripe.Price
          
          await prisma.price.upsert({
            where: { id: price.id },
            update: {
              object: price.object,
              active: price.active,
              billingScheme: price.billing_scheme,
              currency: price.currency,
              customUnitAmount: price.custom_unit_amount || null,
              livemode: price.livemode,
              lookupKey: price.lookup_key,
              metadata: price.metadata || {},
              nickname: price.nickname,
              recurring: price.recurring || null,
              taxBehavior: price.tax_behavior,
              tiersMode: price.tiers_mode,
              transformQuantity: price.transform_quantity || null,
              type: price.type,
              unitAmount: safeBigInt(price.unit_amount),
              unitAmountDecimal: price.unit_amount_decimal,
              updated: new Date(),
            },
            create: {
              id: price.id,
              object: price.object,
              active: price.active,
              billingScheme: price.billing_scheme,
              currency: price.currency,
              customUnitAmount: price.custom_unit_amount || null,
              livemode: price.livemode,
              lookupKey: price.lookup_key,
              metadata: price.metadata || {},
              nickname: price.nickname,
              product: typeof price.product === 'string' ? price.product : price.product.id,
              recurring: price.recurring || null,
              taxBehavior: price.tax_behavior,
              tiersMode: price.tiers_mode,
              transformQuantity: price.transform_quantity || null,
              type: price.type,
              unitAmount: safeBigInt(price.unit_amount),
              unitAmountDecimal: price.unit_amount_decimal,
              created: safeTimestampToDate(price.created) || new Date(),
              updated: new Date(),
            },
          })
          logger.info(`Price ${event.type}: ${price.id}`)
          break
        }

        // Subscription events
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

          await prisma.subscription.upsert({
            where: { id: subscription.id },
            update: {
              object: subscription.object,
              applicationFeePercent: subscription.application_fee_percent,
              automaticTax: subscription.automatic_tax || {},
              billingCycleAnchor: safeTimestampToDate(subscription.billing_cycle_anchor),
              billingThresholds: subscription.billing_thresholds || null,
              cancelAt: safeTimestampToDate(subscription.cancel_at),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              canceledAt: safeTimestampToDate(subscription.canceled_at),
              collectionMethod: subscription.collection_method,
              currency: subscription.currency,
              customer: subscription.customer as string,
              daysUntilDue: subscription.days_until_due,
              defaultPaymentMethod: subscription.default_payment_method,
              defaultSource: subscription.default_source,
              defaultTaxRates: subscription.default_tax_rates || [],
              description: subscription.description,
              discount: subscription.discount || null,
              endedAt: safeTimestampToDate(subscription.ended_at),
              items: subscription.items || {},
              latestInvoice: subscription.latest_invoice,
              livemode: subscription.livemode,
              metadata: subscription.metadata || {},
              nextPendingInvoiceItemInvoice: safeTimestampToDate(subscription.next_pending_invoice_item_invoice),
              pauseCollection: subscription.pause_collection || null,
              paymentSettings: subscription.payment_settings || {},
              pendingInvoiceItemInterval: subscription.pending_invoice_item_interval || null,
              pendingSetupIntent: subscription.pending_setup_intent,
              pendingUpdate: subscription.pending_update || null,
              schedule: subscription.schedule,
              startDate: safeTimestampToDate(subscription.start_date) || new Date(),
              status: subscription.status,
              testClock: subscription.test_clock,
              transferData: subscription.transfer_data || null,
              trialEnd: safeTimestampToDate(subscription.trial_end),
              trialStart: safeTimestampToDate(subscription.trial_start),
              currentPeriodEnd: safeTimestampToDate(subscription.current_period_end) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              currentPeriodStart: safeTimestampToDate(subscription.current_period_start) || new Date(),
              updated: new Date(),
            },
            create: {
              id: subscription.id,
              object: subscription.object,
              applicationFeePercent: subscription.application_fee_percent,
              automaticTax: subscription.automatic_tax || {},
              billingCycleAnchor: safeTimestampToDate(subscription.billing_cycle_anchor),
              billingThresholds: subscription.billing_thresholds || null,
              cancelAt: safeTimestampToDate(subscription.cancel_at),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              canceledAt: safeTimestampToDate(subscription.canceled_at),
              collectionMethod: subscription.collection_method,
              currency: subscription.currency,
              customer: subscription.customer as string,
              daysUntilDue: subscription.days_until_due,
              defaultPaymentMethod: subscription.default_payment_method,
              defaultSource: subscription.default_source,
              defaultTaxRates: subscription.default_tax_rates || [],
              description: subscription.description,
              discount: subscription.discount || null,
              endedAt: safeTimestampToDate(subscription.ended_at),
              items: subscription.items || {},
              latestInvoice: subscription.latest_invoice,
              livemode: subscription.livemode,
              metadata: subscription.metadata || {},
              nextPendingInvoiceItemInvoice: safeTimestampToDate(subscription.next_pending_invoice_item_invoice),
              pauseCollection: subscription.pause_collection || null,
              paymentSettings: subscription.payment_settings || {},
              pendingInvoiceItemInterval: subscription.pending_invoice_item_interval || null,
              pendingSetupIntent: subscription.pending_setup_intent,
              pendingUpdate: subscription.pending_update || null,
              schedule: subscription.schedule,
              startDate: safeTimestampToDate(subscription.start_date) || new Date(),
              status: subscription.status,
              testClock: subscription.test_clock,
              transferData: subscription.transfer_data || null,
              trialEnd: safeTimestampToDate(subscription.trial_end),
              trialStart: safeTimestampToDate(subscription.trial_start),
              currentPeriodEnd: safeTimestampToDate(subscription.current_period_end) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              currentPeriodStart: safeTimestampToDate(subscription.current_period_start) || new Date(),
              created: safeTimestampToDate(subscription.created) || new Date(),
              updated: new Date(),
              // App-specific fields
              userId: customer.id,
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

        // Invoice events
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

          await prisma.invoice.upsert({
            where: { id: invoice.id },
            update: {
              object: invoice.object,
              accountCountry: invoice.account_country,
              accountName: invoice.account_name,
              accountTaxIds: invoice.account_tax_ids || null,
              amountDue: safeBigInt(invoice.amount_due) || BigInt(0),
              amountPaid: safeBigInt(invoice.amount_paid) || BigInt(0),
              amountRemaining: safeBigInt(invoice.amount_remaining) || BigInt(0),
              amountShipping: safeBigInt(invoice.amount_shipping) || BigInt(0),
              application: invoice.application,
              applicationFeeAmount: safeBigInt(invoice.application_fee_amount),
              attemptCount: invoice.attempt_count || 0,
              attempted: invoice.attempted || false,
              autoAdvance: invoice.auto_advance || true,
              automaticTax: invoice.automatic_tax || {},
              billingReason: invoice.billing_reason,
              charge: invoice.charge,
              customerAddress: invoice.customer_address || null,
              customerEmail: invoice.customer_email,
              customerName: invoice.customer_name,
              customerPhone: invoice.customer_phone,
              customerShipping: invoice.customer_shipping || null,
              customerTaxExempt: invoice.customer_tax_exempt,
              customerTaxIds: invoice.customer_tax_ids || null,
              defaultPaymentMethod: invoice.default_payment_method,
              defaultSource: invoice.default_source,
              defaultTaxRates: invoice.default_tax_rates || [],
              description: invoice.description,
              discount: invoice.discount || null,
              discounts: invoice.discounts || [],
              dueDate: safeTimestampToDate(invoice.due_date),
              effectiveAt: safeTimestampToDate(invoice.effective_at),
              endingBalance: safeBigInt(invoice.ending_balance),
              footer: invoice.footer,
              fromInvoice: invoice.from_invoice || null,
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              invoicePdf: invoice.invoice_pdf,
              lastFinalizationError: invoice.last_finalization_error || null,
              latestRevision: invoice.latest_revision,
              lines: invoice.lines || {},
              nextPaymentAttempt: safeTimestampToDate(invoice.next_payment_attempt),
              number: invoice.number,
              onBehalfOf: invoice.on_behalf_of,
              paid: invoice.paid || false,
              paidOutOfBand: invoice.paid_out_of_band || false,
              paymentIntent: invoice.payment_intent,
              paymentSettings: invoice.payment_settings || {},
              periodEnd: safeTimestampToDate(invoice.period_end) || new Date(),
              periodStart: safeTimestampToDate(invoice.period_start) || new Date(),
              postPaymentCreditNotesAmount: safeBigInt(invoice.post_payment_credit_notes_amount) || BigInt(0),
              prePaymentCreditNotesAmount: safeBigInt(invoice.pre_payment_credit_notes_amount) || BigInt(0),
              quote: invoice.quote,
              receiptNumber: invoice.receipt_number,
              renderingOptions: invoice.rendering_options || null,
              shippingCost: invoice.shipping_cost || null,
              shippingDetails: invoice.shipping_details || null,
              startingBalance: safeBigInt(invoice.starting_balance) || BigInt(0),
              statementDescriptor: invoice.statement_descriptor,
              status: invoice.status,
              statusTransitions: invoice.status_transitions || {},
              subscription: invoice.subscription,
              subscriptionDetails: invoice.subscription_details || null,
              subtotal: safeBigInt(invoice.subtotal) || BigInt(0),
              subtotalExcludingTax: safeBigInt(invoice.subtotal_excluding_tax),
              tax: safeBigInt(invoice.tax),
              testClock: invoice.test_clock,
              total: safeBigInt(invoice.total) || BigInt(0),
              totalDiscountAmounts: invoice.total_discount_amounts || [],
              totalExcludingTax: safeBigInt(invoice.total_excluding_tax),
              totalTaxAmounts: invoice.total_tax_amounts || [],
              transferData: invoice.transfer_data || null,
              webhooksDeliveredAt: safeTimestampToDate(invoice.webhooks_delivered_at),
              updated: new Date(),
            },
            create: {
              id: invoice.id,
              object: invoice.object,
              accountCountry: invoice.account_country,
              accountName: invoice.account_name,
              accountTaxIds: invoice.account_tax_ids || null,
              amountDue: safeBigInt(invoice.amount_due) || BigInt(0),
              amountPaid: safeBigInt(invoice.amount_paid) || BigInt(0),
              amountRemaining: safeBigInt(invoice.amount_remaining) || BigInt(0),
              amountShipping: safeBigInt(invoice.amount_shipping) || BigInt(0),
              application: invoice.application,
              applicationFeeAmount: safeBigInt(invoice.application_fee_amount),
              attemptCount: invoice.attempt_count || 0,
              attempted: invoice.attempted || false,
              autoAdvance: invoice.auto_advance || true,
              automaticTax: invoice.automatic_tax || {},
              billingReason: invoice.billing_reason,
              charge: invoice.charge,
              collectionMethod: invoice.collection_method || 'charge_automatically',
              currency: invoice.currency,
              customFields: invoice.custom_fields || null,
              customer: invoice.customer as string,
              customerAddress: invoice.customer_address || null,
              customerEmail: invoice.customer_email,
              customerName: invoice.customer_name,
              customerPhone: invoice.customer_phone,
              customerShipping: invoice.customer_shipping || null,
              customerTaxExempt: invoice.customer_tax_exempt,
              customerTaxIds: invoice.customer_tax_ids || null,
              defaultPaymentMethod: invoice.default_payment_method,
              defaultSource: invoice.default_source,
              defaultTaxRates: invoice.default_tax_rates || [],
              description: invoice.description,
              discount: invoice.discount || null,
              discounts: invoice.discounts || [],
              dueDate: safeTimestampToDate(invoice.due_date),
              effectiveAt: safeTimestampToDate(invoice.effective_at),
              endingBalance: safeBigInt(invoice.ending_balance),
              footer: invoice.footer,
              fromInvoice: invoice.from_invoice || null,
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              invoicePdf: invoice.invoice_pdf,
              lastFinalizationError: invoice.last_finalization_error || null,
              latestRevision: invoice.latest_revision,
              lines: invoice.lines || {},
              livemode: invoice.livemode || false,
              metadata: invoice.metadata || {},
              nextPaymentAttempt: safeTimestampToDate(invoice.next_payment_attempt),
              number: invoice.number,
              onBehalfOf: invoice.on_behalf_of,
              paid: invoice.paid || false,
              paidOutOfBand: invoice.paid_out_of_band || false,
              paymentIntent: invoice.payment_intent,
              paymentSettings: invoice.payment_settings || {},
              periodEnd: safeTimestampToDate(invoice.period_end) || new Date(),
              periodStart: safeTimestampToDate(invoice.period_start) || new Date(),
              postPaymentCreditNotesAmount: safeBigInt(invoice.post_payment_credit_notes_amount) || BigInt(0),
              prePaymentCreditNotesAmount: safeBigInt(invoice.pre_payment_credit_notes_amount) || BigInt(0),
              quote: invoice.quote,
              receiptNumber: invoice.receipt_number,
              renderingOptions: invoice.rendering_options || null,
              shippingCost: invoice.shipping_cost || null,
              shippingDetails: invoice.shipping_details || null,
              startingBalance: safeBigInt(invoice.starting_balance) || BigInt(0),
              statementDescriptor: invoice.statement_descriptor,
              status: invoice.status,
              statusTransitions: invoice.status_transitions || {},
              subscription: invoice.subscription,
              subscriptionDetails: invoice.subscription_details || null,
              subtotal: safeBigInt(invoice.subtotal) || BigInt(0),
              subtotalExcludingTax: safeBigInt(invoice.subtotal_excluding_tax),
              tax: safeBigInt(invoice.tax),
              testClock: invoice.test_clock,
              total: safeBigInt(invoice.total) || BigInt(0),
              totalDiscountAmounts: invoice.total_discount_amounts || [],
              totalExcludingTax: safeBigInt(invoice.total_excluding_tax),
              totalTaxAmounts: invoice.total_tax_amounts || [],
              transferData: invoice.transfer_data || null,
              webhooksDeliveredAt: safeTimestampToDate(invoice.webhooks_delivered_at),
              created: safeTimestampToDate(invoice.created) || new Date(),
              updated: new Date(),
              // App-specific field
              customerId: customer.id,
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
              object: paymentIntent.object,
              amount: safeBigInt(paymentIntent.amount) || BigInt(0),
              amountCapturable: safeBigInt(paymentIntent.amount_capturable) || BigInt(0),
              amountDetails: paymentIntent.amount_details || null,
              amountReceived: safeBigInt(paymentIntent.amount_received) || BigInt(0),
              application: paymentIntent.application,
              applicationFeeAmount: safeBigInt(paymentIntent.application_fee_amount),
              automaticPaymentMethods: paymentIntent.automatic_payment_methods || null,
              canceledAt: safeTimestampToDate(paymentIntent.canceled_at),
              cancellationReason: paymentIntent.cancellation_reason,
              captureMethod: paymentIntent.capture_method,
              charges: paymentIntent.charges || {},
              clientSecret: paymentIntent.client_secret,
              confirmationMethod: paymentIntent.confirmation_method,
              currency: paymentIntent.currency,
              customer: paymentIntent.customer as string,
              description: paymentIntent.description,
              invoice: paymentIntent.invoice,
              lastPaymentError: paymentIntent.last_payment_error || null,
              latestCharge: paymentIntent.latest_charge,
              livemode: paymentIntent.livemode,
              metadata: paymentIntent.metadata || {},
              nextAction: paymentIntent.next_action || null,
              onBehalfOf: paymentIntent.on_behalf_of,
              paymentMethod: paymentIntent.payment_method,
              paymentMethodConfigurationDetails: paymentIntent.payment_method_configuration_details || null,
              paymentMethodOptions: paymentIntent.payment_method_options || {},
              paymentMethodTypes: paymentIntent.payment_method_types || [],
              processing: paymentIntent.processing || null,
              receiptEmail: paymentIntent.receipt_email,
              review: paymentIntent.review,
              setupFutureUsage: paymentIntent.setup_future_usage,
              shipping: paymentIntent.shipping || null,
              statementDescriptor: paymentIntent.statement_descriptor,
              statementDescriptorSuffix: paymentIntent.statement_descriptor_suffix,
              status: paymentIntent.status,
              transferData: paymentIntent.transfer_data || null,
              transferGroup: paymentIntent.transfer_group,
              updated: new Date(),
            },
            create: {
              id: paymentIntent.id,
              object: paymentIntent.object,
              amount: safeBigInt(paymentIntent.amount) || BigInt(0),
              amountCapturable: safeBigInt(paymentIntent.amount_capturable) || BigInt(0),
              amountDetails: paymentIntent.amount_details || null,
              amountReceived: safeBigInt(paymentIntent.amount_received) || BigInt(0),
              application: paymentIntent.application,
              applicationFeeAmount: safeBigInt(paymentIntent.application_fee_amount),
              automaticPaymentMethods: paymentIntent.automatic_payment_methods || null,
              canceledAt: safeTimestampToDate(paymentIntent.canceled_at),
              cancellationReason: paymentIntent.cancellation_reason,
              captureMethod: paymentIntent.capture_method,
              charges: paymentIntent.charges || {},
              clientSecret: paymentIntent.client_secret,
              confirmationMethod: paymentIntent.confirmation_method,
              currency: paymentIntent.currency,
              customer: paymentIntent.customer as string,
              description: paymentIntent.description,
              invoice: paymentIntent.invoice,
              lastPaymentError: paymentIntent.last_payment_error || null,
              latestCharge: paymentIntent.latest_charge,
              livemode: paymentIntent.livemode,
              metadata: paymentIntent.metadata || {},
              nextAction: paymentIntent.next_action || null,
              onBehalfOf: paymentIntent.on_behalf_of,
              paymentMethod: paymentIntent.payment_method,
              paymentMethodConfigurationDetails: paymentIntent.payment_method_configuration_details || null,
              paymentMethodOptions: paymentIntent.payment_method_options || {},
              paymentMethodTypes: paymentIntent.payment_method_types || [],
              processing: paymentIntent.processing || null,
              receiptEmail: paymentIntent.receipt_email,
              review: paymentIntent.review,
              setupFutureUsage: paymentIntent.setup_future_usage,
              shipping: paymentIntent.shipping || null,
              statementDescriptor: paymentIntent.statement_descriptor,
              statementDescriptorSuffix: paymentIntent.statement_descriptor_suffix,
              status: paymentIntent.status,
              transferData: paymentIntent.transfer_data || null,
              transferGroup: paymentIntent.transfer_group,
              created: safeTimestampToDate(paymentIntent.created) || new Date(),
              updated: new Date(),
              // App-specific field
              customerId: customer.id,
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
              object: paymentMethod.object,
              acssDebit: paymentMethod.acss_debit || null,
              affirm: paymentMethod.affirm || null,
              afterpayClearpay: paymentMethod.afterpay_clearpay || null,
              alipay: paymentMethod.alipay || null,
              auBecsDebit: paymentMethod.au_becs_debit || null,
              bacsDebit: paymentMethod.bacs_debit || null,
              bancontact: paymentMethod.bancontact || null,
              billingDetails: paymentMethod.billing_details || {},
              blik: paymentMethod.blik || null,
              boleto: paymentMethod.boleto || null,
              card: paymentMethod.card || null,
              cardPresent: paymentMethod.card_present || null,
              cashapp: paymentMethod.cashapp || null,
              customerBalance: paymentMethod.customer_balance || null,
              eps: paymentMethod.eps || null,
              fpx: paymentMethod.fpx || null,
              giropay: paymentMethod.giropay || null,
              grabpay: paymentMethod.grabpay || null,
              ideal: paymentMethod.ideal || null,
              interacPresent: paymentMethod.interac_present || null,
              klarna: paymentMethod.klarna || null,
              konbini: paymentMethod.konbini || null,
              link: paymentMethod.link || null,
              livemode: paymentMethod.livemode,
              metadata: paymentMethod.metadata || {},
              oxxo: paymentMethod.oxxo || null,
              p24: paymentMethod.p24 || null,
              paynow: paymentMethod.paynow || null,
              paypal: paymentMethod.paypal || null,
              pix: paymentMethod.pix || null,
              promptpay: paymentMethod.promptpay || null,
              radarOptions: paymentMethod.radar_options || null,
              revolutPay: paymentMethod.revolut_pay || null,
              sepaDebit: paymentMethod.sepa_debit || null,
              sofort: paymentMethod.sofort || null,
              swish: paymentMethod.swish || null,
              type: paymentMethod.type,
              usBankAccount: paymentMethod.us_bank_account || null,
              wechatPay: paymentMethod.wechat_pay || null,
              zip: paymentMethod.zip || null,
              updated: new Date(),
            },
            create: {
              id: paymentMethod.id,
              object: paymentMethod.object,
              acssDebit: paymentMethod.acss_debit || null,
              affirm: paymentMethod.affirm || null,
              afterpayClearpay: paymentMethod.afterpay_clearpay || null,
              alipay: paymentMethod.alipay || null,
              auBecsDebit: paymentMethod.au_becs_debit || null,
              bacsDebit: paymentMethod.bacs_debit || null,
              bancontact: paymentMethod.bancontact || null,
              billingDetails: paymentMethod.billing_details || {},
              blik: paymentMethod.blik || null,
              boleto: paymentMethod.boleto || null,
              card: paymentMethod.card || null,
              cardPresent: paymentMethod.card_present || null,
              cashapp: paymentMethod.cashapp || null,
              customer: paymentMethod.customer as string,
              customerBalance: paymentMethod.customer_balance || null,
              eps: paymentMethod.eps || null,
              fpx: paymentMethod.fpx || null,
              giropay: paymentMethod.giropay || null,
              grabpay: paymentMethod.grabpay || null,
              ideal: paymentMethod.ideal || null,
              interacPresent: paymentMethod.interac_present || null,
              klarna: paymentMethod.klarna || null,
              konbini: paymentMethod.konbini || null,
              link: paymentMethod.link || null,
              livemode: paymentMethod.livemode,
              metadata: paymentMethod.metadata || {},
              oxxo: paymentMethod.oxxo || null,
              p24: paymentMethod.p24 || null,
              paynow: paymentMethod.paynow || null,
              paypal: paymentMethod.paypal || null,
              pix: paymentMethod.pix || null,
              promptpay: paymentMethod.promptpay || null,
              radarOptions: paymentMethod.radar_options || null,
              revolutPay: paymentMethod.revolut_pay || null,
              sepaDebit: paymentMethod.sepa_debit || null,
              sofort: paymentMethod.sofort || null,
              swish: paymentMethod.swish || null,
              type: paymentMethod.type,
              usBankAccount: paymentMethod.us_bank_account || null,
              wechatPay: paymentMethod.wechat_pay || null,
              zip: paymentMethod.zip || null,
              created: safeTimestampToDate(paymentMethod.created) || new Date(),
              updated: new Date(),
            },
          })
          logger.info(`Payment method ${event.type}: ${paymentMethod.id}`)
          break
        }

        case 'payment_method.detached': {
          const paymentMethod = event.data.object as Stripe.PaymentMethod
          
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
              object: session.object,
              afterExpiration: session.after_expiration || null,
              allowPromotionCodes: session.allow_promotion_codes,
              amountSubtotal: safeBigInt(session.amount_subtotal),
              amountTotal: safeBigInt(session.amount_total),
              automaticTax: session.automatic_tax || {},
              billingAddressCollection: session.billing_address_collection,
              cancelUrl: session.cancel_url,
              clientReferenceId: session.client_reference_id,
              consent: session.consent || null,
              consentCollection: session.consent_collection || null,
              currency: session.currency,
              currencyConversion: session.currency_conversion || null,
              customFields: session.custom_fields || [],
              customText: session.custom_text || {},
              customer: session.customer as string,
              customerCreation: session.customer_creation,
              customerDetails: session.customer_details || null,
              customerEmail: session.customer_email,
              expiresAt: safeTimestampToDate(session.expires_at),
              invoice: session.invoice,
              invoiceCreation: session.invoice_creation || null,
              livemode: session.livemode,
              locale: session.locale,
              metadata: session.metadata || {},
              mode: session.mode,
              paymentIntent: session.payment_intent,
              paymentLink: session.payment_link,
              paymentMethodCollection: session.payment_method_collection,
              paymentMethodConfigurationDetails: session.payment_method_configuration_details || null,
              paymentMethodOptions: session.payment_method_options || {},
              paymentMethodTypes: session.payment_method_types || [],
              paymentStatus: session.payment_status,
              phoneNumberCollection: session.phone_number_collection || null,
              recoveredFrom: session.recovered_from,
              setupIntent: session.setup_intent,
              shippingAddressCollection: session.shipping_address_collection || null,
              shippingCost: session.shipping_cost || null,
              shippingDetails: session.shipping_details || null,
              shippingOptions: session.shipping_options || [],
              status: session.status,
              submitType: session.submit_type,
              subscription: session.subscription,
              successUrl: session.success_url,
              totalDetails: session.total_details || null,
              uiMode: session.ui_mode,
              url: session.url,
              updated: new Date(),
            },
            create: {
              id: session.id,
              object: session.object,
              afterExpiration: session.after_expiration || null,
              allowPromotionCodes: session.allow_promotion_codes,
              amountSubtotal: safeBigInt(session.amount_subtotal),
              amountTotal: safeBigInt(session.amount_total),
              automaticTax: session.automatic_tax || {},
              billingAddressCollection: session.billing_address_collection,
              cancelUrl: session.cancel_url,
              clientReferenceId: session.client_reference_id,
              consent: session.consent || null,
              consentCollection: session.consent_collection || null,
              currency: session.currency,
              currencyConversion: session.currency_conversion || null,
              customFields: session.custom_fields || [],
              customText: session.custom_text || {},
              customer: session.customer as string,
              customerCreation: session.customer_creation,
              customerDetails: session.customer_details || null,
              customerEmail: session.customer_email,
              expiresAt: safeTimestampToDate(session.expires_at),
              invoice: session.invoice,
              invoiceCreation: session.invoice_creation || null,
              livemode: session.livemode,
              locale: session.locale,
              metadata: session.metadata || {},
              mode: session.mode,
              paymentIntent: session.payment_intent,
              paymentLink: session.payment_link,
              paymentMethodCollection: session.payment_method_collection,
              paymentMethodConfigurationDetails: session.payment_method_configuration_details || null,
              paymentMethodOptions: session.payment_method_options || {},
              paymentMethodTypes: session.payment_method_types || [],
              paymentStatus: session.payment_status,
              phoneNumberCollection: session.phone_number_collection || null,
              recoveredFrom: session.recovered_from,
              setupIntent: session.setup_intent,
              shippingAddressCollection: session.shipping_address_collection || null,
              shippingCost: session.shipping_cost || null,
              shippingDetails: session.shipping_details || null,
              shippingOptions: session.shipping_options || [],
              status: session.status,
              submitType: session.submit_type,
              subscription: session.subscription,
              successUrl: session.success_url,
              totalDetails: session.total_details || null,
              uiMode: session.ui_mode,
              url: session.url,
              created: safeTimestampToDate(session.created) || new Date(),
              updated: new Date(),
              // App-specific field
              customerId: customer.id,
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

  } catch (error) {
    logger.error('Critical webhook error:', error)
    return NextResponse.json({ 
      error: 'Critical webhook error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}