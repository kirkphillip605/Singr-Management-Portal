const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');

const LOG_SEPARATOR = '────────────────────────────────────────────';

async function createStripeData() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });

  console.log('🚀 Creating Stripe data for Singr Karaoke Connect...');

  try {
    // Create main product
    console.log('📦 Creating Singr Karaoke Connect product...');
    const product = await stripe.products.create({
      name: 'Singr Karaoke Connect',
      description:
        'Professional karaoke management platform with real-time requests, multi-venue support, and OpenKJ integration',
      metadata: {
        category: 'subscription',
        type: 'saas',
      },
    });
    console.log(`✅ Product created: ${product.id}`);

    // Monthly Price
    console.log('💰 Creating monthly price ($15/month)...');
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 1500,
      currency: 'usd',
      recurring: { interval: 'month', interval_count: 1 },
      nickname: 'Monthly Plan',
      metadata: {
        plan_name: 'monthly',
        billing_interval: 'monthly',
      },
    });
    console.log(`✅ Monthly price created: ${monthlyPrice.id}`);

    // Semi-annual Price
    console.log('💰 Creating semi-annual price ($75 every 6 months)...');
    const semiAnnualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 7500,
      currency: 'usd',
      recurring: { interval: 'month', interval_count: 6 },
      nickname: 'Semi-Annual Plan (17% savings)',
      metadata: {
        plan_name: 'semi-annual',
        billing_interval: 'semi-annual',
        savings_percentage: '17',
      },
    });
    console.log(`✅ Semi-annual price created: ${semiAnnualPrice.id}`);

    // Annual Price
    console.log('💰 Creating annual price ($135/year)...');
    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 13500,
      currency: 'usd',
      recurring: { interval: 'year', interval_count: 1 },
      nickname: 'Annual Plan (25% savings)',
      metadata: {
        plan_name: 'annual',
        billing_interval: 'annual',
        savings_percentage: '25',
      },
    });
    console.log(`✅ Annual price created: ${annualPrice.id}`);

    console.log('\n🎉 Stripe setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`Product ID: ${product.id}`);
    console.log(`Monthly Price ID: ${monthlyPrice.id}`);
    console.log(`Semi-Annual Price ID: ${semiAnnualPrice.id}`);
    console.log(`Annual Price ID: ${annualPrice.id}`);

    // Sync with DB
    console.log('\n🔄 Syncing created Stripe data to database...');

    const prisma = new PrismaClient();

    try {
      //
      // 🔹 Sync Product
      //
      await prisma.stripeProduct.upsert({
        where: { id: product.id },
        update: {
          active: product.active,
          name: product.name,
          description: product.description,
          images: product.images || [],
          metadata: product.metadata || {},
          updatedAt: new Date(),
        },
        create: {
          id: product.id,
          active: product.active,
          name: product.name,
          description: product.description,
          images: product.images || [],
          metadata: product.metadata || {},
          livemode: product.livemode,
          createdAt: new Date(product.created * 1000),
          updatedAt: new Date(),
        },
      });

      //
      // 🔹 Sync Prices
      //
      for (const price of [monthlyPrice, semiAnnualPrice, annualPrice]) {
        await prisma.stripePrice.upsert({
          where: { id: price.id },
          update: {
            active: price.active,
            currency: price.currency,
            nickname: price.nickname || null,
            recurring: price.recurring || null,
            type: price.type,
            unitAmount: price.unit_amount
              ? BigInt(price.unit_amount)
              : null,
            metadata: price.metadata || {},
            updatedAt: new Date(),
          },
          create: {
            id: price.id,
            productId: price.product,
            active: price.active,
            currency: price.currency,
            nickname: price.nickname || null,
            recurring: price.recurring || null,
            type: price.type,
            unitAmount: price.unit_amount
              ? BigInt(price.unit_amount)
              : null,
            metadata: price.metadata || {},
            livemode: price.livemode,
            createdAt: new Date(price.created * 1000),
            updatedAt: new Date(),
          },
        });
      }

      console.log('✅ Data synced to database successfully!');
    } catch (syncError) {
      console.warn('⚠️  Database sync failed:', syncError.message);
      console.log('Note: This is optional — Stripe webhooks will sync data anyway.');
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('❌ Error creating Stripe data:', error.message);
    process.exit(1);
  }
}

function validateEnvironment() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Missing STRIPE_SECRET_KEY environment variable');
    console.error('Please set this in your .env file and try again.');
    process.exit(1);
  }
}

if (require.main === module) {
  validateEnvironment();
  createStripeData();
}

module.exports = { createStripeData };
