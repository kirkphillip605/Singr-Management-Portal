// syncStripeData.js
// Synchronizes Stripe products and prices with a local database using Prisma.
// Requirements: Set STRIPE_SECRET_KEY and DATABASE_URL in environment variables.

'use strict';

const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const LOG_SEPARATOR = '────────────────────────────────────────────';

// Validate required environment variables
function validateEnvironment() {
  const requiredEnvVars = ['STRIPE_SECRET_KEY', 'DATABASE_URL'];
  const missing = requiredEnvVars.filter(env => !process.env[env]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(env => console.error(`  • ${env}`));
    process.exit(1);
  }
}

validateEnvironment();

// Initialize Stripe and Prisma
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});
const prisma = new PrismaClient();

async function syncStripeProducts() {
  console.log('📦 Syncing Stripe products...');

  let hasMore = true;
  let startingAfter = undefined;

  while (hasMore) {
    const { data, has_more } = await stripe.products.list({
      limit: 100,
      active: true,
      starting_after: startingAfter,
    });

    for (const product of data) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {
          active: product.active,
          name: product.name,
          description: product.description,
          images: product.images || [],
          packageDimensions: product.package_dimensions || null,
          shippable: product.shippable,
          statementDescriptor: product.statement_descriptor,
          taxCode: product.tax_code,
          unitLabel: product.unit_label,
          url: product.url,
          metadata: product.metadata || {},
          updated: new Date(),
          data: product,
        },
        create: {
          id: product.id,
          object: product.object,
          active: product.active,
          name: product.name,
          description: product.description,
          images: product.images || [],
          packageDimensions: product.package_dimensions || null,
          shippable: product.shippable,
          statementDescriptor: product.statement_descriptor,
          taxCode: product.tax_code,
          unitLabel: product.unit_label,
          url: product.url,
          metadata: product.metadata || {},
          livemode: product.livemode,
          created: new Date(product.created * 1000),
          updated: new Date(),
          data: product,
        },
      });
      console.log(`  ✅ Product synced: ${product.name || product.id} (${product.id})`);
    }

    hasMore = has_more;
    startingAfter = data.length > 0 ? data[data.length - 1].id : undefined;
  }
}

async function syncStripePrices() {
  console.log('💰 Syncing Stripe prices...');

  let hasMore = true;
  let startingAfter = undefined;

  while (hasMore) {
    const { data, has_more } = await stripe.prices.list({
      limit: 100,
      active: true,
      starting_after: startingAfter,
    });

    for (const price of data) {
      await prisma.price.upsert({
        where: { id: price.id },
        update: {
          active: price.active,
          billingScheme: price.billing_scheme,
          currency: price.currency,
          customUnitAmount: price.custom_unit_amount || null,
          lookupKey: price.lookup_key,
          nickname: price.nickname,
          recurring: price.recurring || null,
          taxBehavior: price.tax_behavior,
          tiersMode: price.tiers_mode,
          transformQuantity: price.transform_quantity || null,
          type: price.type,
          unitAmount: price.unit_amount ? BigInt(price.unit_amount) : null,
          unitAmountDecimal: price.unit_amount_decimal,
          metadata: price.metadata || {},
          updated: new Date(),
          data: price,
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
          unitAmount: price.unit_amount ? BigInt(price.unit_amount) : null,
          unitAmountDecimal: price.unit_amount_decimal,
          created: new Date(price.created * 1000),
          updated: new Date(),
          data: price,
        },
      });

      const amount = price.unit_amount != null ? `$${(price.unit_amount / 100).toFixed(2)}` : 'Free';
      const interval = price.recurring?.interval ? `/${price.recurring.interval}` : '';
      console.log(`  ✅ Price synced: ${amount}${interval} (${price.id})`);
    }

    hasMore = has_more;
    startingAfter = data.length > 0 ? data[data.length - 1].id : undefined;
  }
}

async function main() {
  console.log('🔄 Starting Stripe data synchronization...');
  console.log(LOG_SEPARATOR);

  try {
    console.log('🔑 Verifying Stripe connection...');
    const account = await stripe.account.retrieve();
    console.log(`✅ Connected to Stripe account: ${account.settings.dashboard.display_name || account.id}`);

    await syncStripeProducts();
    await syncStripePrices();

    console.log(LOG_SEPARATOR);
    console.log('🎉 Stripe data synchronization completed successfully!');

    // Summary
    const [productCount, priceCount] = await Promise.all([
      prisma.product.count(),
      prisma.price.count(),
    ]);

    console.log('\n📊 Database Summary:');
    console.log(`  • Products: ${productCount}`);
    console.log(`  • Prices: ${priceCount}`);
  } catch (error) {
    console.error('❌ Error during synchronization:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute only when run directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { main };