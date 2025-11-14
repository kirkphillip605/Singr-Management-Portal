const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');

async function createStripeData() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });

  console.log('🚀 Creating Stripe data for Singr Karaoke Connect...');

  try {
    // Create product
    const product = await stripe.products.create({
      name: 'Singr Karaoke Connect',
      description:
        'Professional karaoke management platform with real-time requests, multi-venue support, and OpenKJ integration',
      metadata: {
        category: 'subscription',
        type: 'saas',
      },
    });

    console.log(`📦 Product created: ${product.id}`);

    // Create prices
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 1500,
      currency: 'usd',
      recurring: { interval: 'month', interval_count: 1 },
      metadata: { plan_name: 'monthly', billing_interval: 'monthly' },
    });

    const semiAnnualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 7500,
      currency: 'usd',
      recurring: { interval: 'month', interval_count: 6 },
      metadata: {
        plan_name: 'semi-annual',
        billing_interval: 'semi-annual',
        savings_percentage: '17',
      },
    });

    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 13500,
      currency: 'usd',
      recurring: { interval: 'year', interval_count: 1 },
      metadata: {
        plan_name: 'annual',
        billing_interval: 'annual',
        savings_percentage: '25',
      },
    });

    console.log('🎉 Prices created successfully.');

    console.log('🔄 Syncing with database...');

    const prisma = new PrismaClient();

    try {
      //
      // ----------------------------
      // SYNC PRODUCT
      // ----------------------------
      //
      await prisma.stripeProduct.upsert({
        where: { id: product.id },
        update: {
          active: product.active,
          name: product.name,
          description: product.description,
          metadata: product.metadata || {},
          images: product.images || [],
          livemode: product.livemode,
          updatedAt: new Date(),
        },
        create: {
          id: product.id,
          active: product.active,
          name: product.name,
          description: product.description,
          metadata: product.metadata || {},
          images: product.images || [],
          livemode: product.livemode,
          createdAt: new Date(product.created * 1000),
          updatedAt: new Date(),
        },
      });

      //
      // ----------------------------
      // SYNC PRICES
      // ----------------------------
      //
      const priceList = [monthlyPrice, semiAnnualPrice, annualPrice];

      for (const price of priceList) {
        await prisma.stripePrice.upsert({
          where: { id: price.id },
          update: {
            active: price.active,
            currency: price.currency,
            type: price.type,
            recurring: price.recurring || null,
            unitAmount: price.unit_amount
              ? BigInt(price.unit_amount)
              : null,
            metadata: price.metadata || {},
            livemode: price.livemode,
            updatedAt: new Date(),
          },
          create: {
            id: price.id,
            productId: price.product,
            active: price.active,
            currency: price.currency,
            type: price.type,
            recurring: price.recurring || null,
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

      console.log('✅ Stripe data synced to database.');
    } catch (error) {
      console.warn('⚠️ Database sync failed:', error.message);
      console.log('This is optional; Stripe webhooks will sync.');
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function validateEnvironment() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Missing STRIPE_SECRET_KEY');
    process.exit(1);
  }
}

if (require.main === module) {
  validateEnvironment();
  createStripeData();
}

module.exports = { createStripeData };
