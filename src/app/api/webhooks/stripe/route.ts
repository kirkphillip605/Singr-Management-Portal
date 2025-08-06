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

    // Store webhook event using EXACT field names from schema
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

          // Find our customer record
          const customer = await prisma.customer.findUnique({
            where: { stripeCustomerId: customerId },
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
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodEnd: safeTimestampToDate(subscription.current_period_end) || new Date(),
              currentPeriodStart: safeTimestampToDate(subscription.current_period_start) || new Date(),
              cancelAt: safeTimestampToDate(subscription.cancel_at),
              canceledAt: safeTimestampToDate(subscription.canceled_at),
              endedAt: safeTimestampToDate(subscription.ended_at),
              trialStart: safeTimestampToDate(subscription.trial_start),
              trialEnd: safeTimestampToDate(subscription.trial_end),
              priceId: priceId,
              metadata: subscription.metadata as any,
              object: subscription.object,
              applicationFeePercent: subscription.application_fee_percent,
              automaticTax: subscription.automatic_tax as any,
              billingCycleAnchor: safeTimestampToDate(subscription.billing_cycle_anchor),
              billingThresholds: subscription.billing_thresholds as any,
              collectionMethod: subscription.collection_method,
              currency: subscription.currency,
              customer: customerId,
              daysUntilDue: subscription.days_until_due,
              defaultPaymentMethod: subscription.default_payment_method,
              defaultSource: subscription.default_source,
              defaultTaxRates: subscription.default_tax_rates as any,
              description: subscription.description,
              discount: subscription.discount as any,
              items: subscription.items as any,
              latestInvoice: subscription.latest_invoice,
              livemode: subscription.livemode,
              nextPendingInvoiceItemInvoice: safeTimestampToDate(subscription.next_pending_invoice_item_invoice),
              pauseCollection: subscription.pause_collection as any,
              paymentSettings: subscription.payment_settings as any,
              pendingInvoiceItemInterval: subscription.pending_invoice_item_interval as any,
              pendingSetupIntent: subscription.pending_setup_intent,
              pendingUpdate: subscription.pending_update as any,
              schedule: subscription.schedule,
              startDate: safeTimestampToDate(subscription.start_date) || new Date(),
              testClock: subscription.test_clock,
              transferData: subscription.transfer_data as any,
              data: subscription as any,
              updated: new Date(),
            },
            create: {
              id: subscription.id,
              userId: customer.id,
              currency: subscription.currency,
              customer: customerId,
              status: subscription.status,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodEnd: safeTimestampToDate(subscription.current_period_end) || new Date(),
              currentPeriodStart: safeTimestampToDate(subscription.current_period_start) || new Date(),
              startDate: safeTimestampToDate(subscription.start_date) || new Date(),
              created: safeTimestampToDate(subscription.created) || new Date(),
              cancelAt: safeTimestampToDate(subscription.cancel_at),
              canceledAt: safeTimestampToDate(subscription.canceled_at),
              endedAt: safeTimestampToDate(subscription.ended_at),
              trialStart: safeTimestampToDate(subscription.trial_start),
              trialEnd: safeTimestampToDate(subscription.trial_end),
              priceId: priceId,
              metadata: subscription.metadata as any,
              object: subscription.object,
              applicationFeePercent: subscription.application_fee_percent,
              automaticTax: subscription.automatic_tax as any,
              billingCycleAnchor: safeTimestampToDate(subscription.billing_cycle_anchor),
              billingThresholds: subscription.billing_thresholds as any,
              collectionMethod: subscription.collection_method,
              daysUntilDue: subscription.days_until_due,
              defaultPaymentMethod: subscription.default_payment_method,
              defaultSource: subscription.default_source,
              defaultTaxRates: subscription.default_tax_rates as any,
              description: subscription.description,
              discount: subscription.discount as any,
              items: subscription.items as any,
              latestInvoice: subscription.latest_invoice,
              livemode: subscription.livemode,
              nextPendingInvoiceItemInvoice: safeTimestampToDate(subscription.next_pending_invoice_item_invoice),
              pauseCollection: subscription.pause_collection as any,
              paymentSettings: subscription.payment_settings as any,
              pendingInvoiceItemInterval: subscription.pending_invoice_item_interval as any,
              pendingSetupIntent: subscription.pending_setup_intent,
              pendingUpdate: subscription.pending_update as any,
              schedule: subscription.schedule,
              testClock: subscription.test_clock,
              transferData: subscription.transfer_data as any,
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
              endedAt: safeTimestampToDate(subscription.ended_at) || new Date(),
              canceledAt: safeTimestampToDate(subscription.canceled_at) || new Date(),
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
            where: { stripeCustomerId: customerId },
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
              amountDue: safeBigInt(invoice.amount_due) || BigInt(0),
              amountPaid: safeBigInt(invoice.amount_paid) || BigInt(0),
              amountRemaining: safeBigInt(invoice.amount_remaining) || BigInt(0),
              total: safeBigInt(invoice.total) || BigInt(0),
              subtotal: safeBigInt(invoice.subtotal) || BigInt(0),
              tax: safeBigInt(invoice.tax),
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              invoicePdf: invoice.invoice_pdf,
              paid: invoice.paid,
              number: invoice.number,
              finalized_at: finalizedAt,
              dueDate: safeTimestampToDate(invoice.due_date),
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
              collectionMethod: invoice.collection_method,
              amountDue: safeBigInt(invoice.amount_due) || BigInt(0),
              amountPaid: safeBigInt(invoice.amount_paid) || BigInt(0),
              amountRemaining: safeBigInt(invoice.amount_remaining) || BigInt(0),
              total: safeBigInt(invoice.total) || BigInt(0),
              subtotal: safeBigInt(invoice.subtotal) || BigInt(0),
              tax: safeBigInt(invoice.tax),
              periodEnd: safeTimestampToDate(invoice.period_end) || new Date(),
              periodStart: safeTimestampToDate(invoice.period_start) || new Date(),
              created: safeTimestampToDate(invoice.created) || new Date(),
              hostedInvoiceUrl: invoice.hosted_invoice_url,
              invoicePdf: invoice.invoice_pdf,
              paid: invoice.paid,
              number: invoice.number,
              finalized_at: finalizedAt,
              dueDate: safeTimestampToDate(invoice.due_date),
              subscription: extractCustomerId(invoice.subscription),
              metadata: invoice.metadata as any,
              accountCountry: invoice.account_country,
              accountName: invoice.account_name,
              accountTaxIds: invoice.account_tax_ids as any,
              amountShipping: safeBigInt(invoice.amount_shipping) || BigInt(0),
              application: invoice.application,
              applicationFeeAmount: safeBigInt(invoice.application_fee_amount),
              attemptCount: invoice.attempt_count || 0,
              attempted: invoice.attempted || false,
              autoAdvance: invoice.auto_advance !== false,
              automaticTax: invoice.automatic_tax as any || {},
              billingReason: invoice.billing_reason,
              charge: invoice.charge,
              customFields: invoice.custom_fields as any,
              customerAddress: invoice.customer_address as any,
              customerEmail: invoice.customer_email,
              customerName: invoice.customer_name,
              customerPhone: invoice.customer_phone,
              customerShipping: invoice.customer_shipping as any,
              customerTaxExempt: invoice.customer_tax_exempt,
              customerTaxIds: invoice.customer_tax_ids as any,
              defaultPaymentMethod: invoice.default_payment_method,
              defaultSource: invoice.default_source,
              defaultTaxRates: invoice.default_tax_rates as any || [],
              description: invoice.description,
              discounts: invoice.discounts as any || [],
              effectiveAt: safeTimestampToDate(invoice.effective_at),
              endingBalance: safeBigInt(invoice.ending_balance),
              footer: invoice.footer,
              fromInvoice: invoice.from_invoice as any,
              lastFinalizationError: invoice.last_finalization_error as any,
              latestRevision: invoice.latest_revision,
              lines: invoice.lines as any || {},
              livemode: invoice.livemode,
              nextPaymentAttempt: safeTimestampToDate(invoice.next_payment_attempt),
              object: invoice.object,
              onBehalfOf: invoice.on_behalf_of,
              paidOutOfBand: invoice.paid_out_of_band || false,
              paymentIntent: invoice.payment_intent,
              paymentSettings: invoice.payment_settings as any || {},
              postPaymentCreditNotesAmount: safeBigInt(invoice.post_payment_credit_notes_amount) || BigInt(0),
              prePaymentCreditNotesAmount: safeBigInt(invoice.pre_payment_credit_notes_amount) || BigInt(0),
              quote: invoice.quote,
              receiptNumber: invoice.receipt_number,
              renderingOptions: invoice.rendering_options as any,
              shippingCost: invoice.shipping_cost as any,
              shippingDetails: invoice.shipping_details as any,
              startingBalance: safeBigInt(invoice.starting_balance) || BigInt(0),
              statementDescriptor: invoice.statement_descriptor,
              statusTransitions: invoice.status_transitions as any || {},
              subscriptionDetails: invoice.subscription_details as any,
              subtotalExcludingTax: safeBigInt(invoice.subtotal_excluding_tax),
              testClock: invoice.test_clock,
              totalDiscountAmounts: invoice.total_discount_amounts as any || [],
              totalExcludingTax: safeBigInt(invoice.total_excluding_tax),
              totalTaxAmounts: invoice.total_tax_amounts as any || [],
              transferData: invoice.transfer_data as any,
              webhooksDeliveredAt: safeTimestampToDate(invoice.webhooks_delivered_at),
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

        // Payment Method events
        case 'payment_method.attached':
        case 'payment_method.automatically_updated':
        case 'payment_method.updated': {
          const paymentMethod = event.data.object as Stripe.PaymentMethod
          const customerId = extractCustomerId(paymentMethod.customer)
          
          await prisma.paymentMethod.upsert({
            where: { id: paymentMethod.id },
            update: {
              type: paymentMethod.type,
              billingDetails: paymentMethod.billing_details as any,
              card: paymentMethod.card as any,
              metadata: paymentMethod.metadata as any,
              customer: customerId,
              data: paymentMethod as any,
              updated: new Date(),
            },
            create: {
              id: paymentMethod.id,
              type: paymentMethod.type,
              customer: customerId,
              billingDetails: paymentMethod.billing_details as any,
              card: paymentMethod.card as any,
              metadata: paymentMethod.metadata as any,
              livemode: paymentMethod.livemode,
              object: paymentMethod.object,
              data: paymentMethod as any,
              created: safeTimestampToDate(paymentMethod.created) || new Date(),
              updated: new Date(),
            },
          })
          
          logger.info(`Payment method ${event.type}: ${paymentMethod.id}`)
          break
        }

        case 'payment_method.detached': {
          const paymentMethod = event.data.object as Stripe.PaymentMethod
          
          await prisma.paymentMethod.updateMany({
            where: { id: paymentMethod.id },
            data: {
              customer: null,
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
              where: { stripeCustomerId: customerId },
            })

            if (customer) {
              await prisma.stripePaymentIntent.upsert({
                where: { id: paymentIntent.id },
                update: {
                  amount: safeBigInt(paymentIntent.amount) || BigInt(0),
                  currency: paymentIntent.currency,
                  status: paymentIntent.status,
                  captureMethod: paymentIntent.capture_method,
                  confirmationMethod: paymentIntent.confirmation_method,
                  amountReceived: safeBigInt(paymentIntent.amount_received) || BigInt(0),
                  canceledAt: safeTimestampToDate(paymentIntent.canceled_at),
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
                  captureMethod: paymentIntent.capture_method,
                  confirmationMethod: paymentIntent.confirmation_method,
                  customer: customerId,
                  amountReceived: safeBigInt(paymentIntent.amount_received) || BigInt(0),
                  canceledAt: safeTimestampToDate(paymentIntent.canceled_at),
                  metadata: paymentIntent.metadata as any,
                  amountCapturable: safeBigInt(paymentIntent.amount_capturable) || BigInt(0),
                  amountDetails: paymentIntent.amount_details as any,
                  application: paymentIntent.application,
                  applicationFeeAmount: safeBigInt(paymentIntent.application_fee_amount),
                  automaticPaymentMethods: paymentIntent.automatic_payment_methods as any,
                  cancellationReason: paymentIntent.cancellation_reason,
                  charges: paymentIntent.charges as any || {},
                  clientSecret: paymentIntent.client_secret,
                  description: paymentIntent.description,
                  invoice: paymentIntent.invoice,
                  lastPaymentError: paymentIntent.last_payment_error as any,
                  latestCharge: paymentIntent.latest_charge,
                  livemode: paymentIntent.livemode,
                  nextAction: paymentIntent.next_action as any,
                  object: paymentIntent.object,
                  onBehalfOf: paymentIntent.on_behalf_of,
                  paymentMethod: paymentIntent.payment_method,
                  paymentMethodConfigurationDetails: paymentIntent.payment_method_configuration_details as any,
                  paymentMethodOptions: paymentIntent.payment_method_options as any || {},
                  paymentMethodTypes: paymentIntent.payment_method_types as any || [],
                  processing: paymentIntent.processing as any,
                  receiptEmail: paymentIntent.receipt_email,
                  review: paymentIntent.review,
                  setupFutureUsage: paymentIntent.setup_future_usage,
                  shipping: paymentIntent.shipping as any,
                  statementDescriptor: paymentIntent.statement_descriptor,
                  statementDescriptorSuffix: paymentIntent.statement_descriptor_suffix,
                  transferData: paymentIntent.transfer_data as any,
                  transferGroup: paymentIntent.transfer_group,
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
              where: { stripeCustomerId: customerId },
            })

            if (customer) {
              await prisma.stripeCheckoutSession.upsert({
                where: { id: session.id },
                update: {
                  paymentStatus: session.payment_status,
                  status: session.status,
                  amountTotal: safeBigInt(session.amount_total),
                  currency: session.currency,
                  customer: customerId,
                  paymentIntent: session.payment_intent as string,
                  subscription: session.subscription as string,
                  data: session as any,
                  updated: new Date(),
                },
                create: {
                  id: session.id,
                  customerId: customer.id,
                  paymentStatus: session.payment_status,
                  mode: session.mode,
                  amountTotal: safeBigInt(session.amount_total),
                  currency: session.currency,
                  expiresAt: safeTimestampToDate(session.expires_at),
                  url: session.url,
                  customer: customerId,
                  paymentIntent: session.payment_intent as string,
                  subscription: session.subscription as string,
                  metadata: session.metadata as any,
                  afterExpiration: session.after_expiration as any,
                  allowPromotionCodes: session.allow_promotion_codes,
                  amountSubtotal: safeBigInt(session.amount_subtotal),
                  automaticTax: session.automatic_tax as any || {},
                  billingAddressCollection: session.billing_address_collection,
                  cancelUrl: session.cancel_url,
                  clientReferenceId: session.client_reference_id,
                  consent: session.consent as any,
                  consentCollection: session.consent_collection as any,
                  currencyConversion: session.currency_conversion as any,
                  customFields: session.custom_fields as any || [],
                  customText: session.custom_text as any || {},
                  customerCreation: session.customer_creation,
                  customerDetails: session.customer_details as any,
                  customerEmail: session.customer_email,
                  invoice: session.invoice,
                  invoiceCreation: session.invoice_creation as any,
                  livemode: session.livemode,
                  locale: session.locale,
                  object: session.object,
                  paymentLink: session.payment_link,
                  paymentMethodCollection: session.payment_method_collection,
                  paymentMethodConfigurationDetails: session.payment_method_configuration_details as any,
                  paymentMethodOptions: session.payment_method_options as any || {},
                  paymentMethodTypes: session.payment_method_types as any || [],
                  phoneNumberCollection: session.phone_number_collection as any,
                  recoveredFrom: session.recovered_from,
                  setupIntent: session.setup_intent,
                  shippingAddressCollection: session.shipping_address_collection as any,
                  shippingCost: session.shipping_cost as any,
                  shippingDetails: session.shipping_details as any,
                  shippingOptions: session.shipping_options as any || [],
                  submitType: session.submit_type,
                  successUrl: session.success_url,
                  totalDetails: session.total_details as any,
                  uiMode: session.ui_mode,
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

        default: {
          logger.info(`Unhandled webhook event type: ${event.type}`)
          break
        }
      }

      // Mark webhook as processed using EXACT field names
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
      
      // Mark webhook as failed using EXACT field names
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