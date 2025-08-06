const Stripe = require('stripe')

async function createStripeData() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })

  console.log('🚀 Creating Stripe data for Singr Karaoke Connect...')

  try {
    // Create main product
    console.log('📦 Creating Singr Karaoke Connect product...')
    const product = await stripe.products.create({
      name: 'Singr Karaoke Connect',
      description: 'Professional karaoke management platform with real-time requests, multi-venue support, and OpenKJ integration',
      metadata: {
        category: 'subscription',
        type: 'saas',
      },
    })
    console.log(`✅ Product created: ${product.id}`)

    // Create monthly price
    console.log('💰 Creating monthly price ($15/month)...')
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 1500, // $15.00 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
        interval_count: 1,
      },
      nickname: 'Monthly Plan',
      metadata: {
        plan_name: 'monthly',
        billing_interval: 'monthly',
      },
    })
    console.log(`✅ Monthly price created: ${monthlyPrice.id}`)

    // Create semi-annual price (6 months)
    console.log('💰 Creating semi-annual price ($75 every 6 months)...')
    const semiAnnualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 7500, // $75.00 in cents (6 months at $12.50/month)
      currency: 'usd',
      recurring: {
        interval: 'month',
        interval_count: 6,
      },
      nickname: 'Semi-Annual Plan (17% savings)',
      metadata: {
        plan_name: 'semi-annual',
        billing_interval: 'semi-annual',
        savings_percentage: '17',
      },
    })
    console.log(`✅ Semi-annual price created: ${semiAnnualPrice.id}`)

    // Create annual price
    console.log('💰 Creating annual price ($135/year)...')
    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 13500, // $135.00 in cents (12 months at $11.25/month)
      currency: 'usd',
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
      nickname: 'Annual Plan (25% savings)',
      metadata: {
        plan_name: 'annual',
        billing_interval: 'annual',
        savings_percentage: '25',
      },
    })
    console.log(`✅ Annual price created: ${annualPrice.id}`)

    console.log('\n🎉 Stripe setup completed successfully!')
    console.log('\n📋 Summary:')
    console.log(`Product ID: ${product.id}`)
    console.log(`Monthly Price ID: ${monthlyPrice.id}`)
    console.log(`Semi-Annual Price ID: ${semiAnnualPrice.id}`)
    console.log(`Annual Price ID: ${annualPrice.id}`)

    // Sync the created data to database
    console.log('\n🔄 Syncing created data to database...')
    
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()
    
    try {
      // Sync product
      await prisma.product.upsert({
        where: { id: product.id },
        update: {
          active: product.active,
          name: product.name,
          description: product.description,
          images: product.images || [],
          metadata: product.metadata || {},
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
          livemode: product.livemode,
          created: new Date(product.created * 1000),
          updated: new Date(),
        },
      })
      
      // Sync prices
      for (const price of [monthlyPrice, semiAnnualPrice, annualPrice]) {
        await prisma.price.upsert({
          where: { id: price.id },
          update: {
            active: price.active,
            currency: price.currency,
            nickname: price.nickname,
            recurring: price.recurring || null,
            type: price.type,
            unitAmount: price.unit_amount ? BigInt(price.unit_amount) : null,
            metadata: price.metadata || {},
            updated: new Date(),
          },
          create: {
            id: price.id,
            object: price.object,
            active: price.active,
            currency: price.currency,
            livemode: price.livemode,
            metadata: price.metadata || {},
            nickname: price.nickname,
            product: price.product,
            recurring: price.recurring || null,
            type: price.type,
            unitAmount: price.unit_amount ? BigInt(price.unit_amount) : null,
            created: new Date(price.created * 1000),
            updated: new Date(),
          },
        })
      }
      
      console.log('✅ Data synced to database successfully!')
    } catch (syncError) {
      console.warn('⚠️  Database sync failed:', syncError.message)
      console.log('Note: This is optional - data will sync via webhooks')
    } finally {
      await prisma.$disconnect()
    }
  } catch (error) {
    console.error('❌ Error creating Stripe data:', error.message)
    process.exit(1)
  }
}

// Validate environment
function validateEnvironment() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Missing STRIPE_SECRET_KEY environment variable')
    console.error('Please set this in your .env file and try again.')
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  validateEnvironment()
  createStripeData()
}

module.exports = { createStripeData }