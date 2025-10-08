// file: prisma/seed.ts
// Seeds initial users (admin + customer) and related data for customer only.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function normalizeCombined(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric to hyphen
    .replace(/^-+|-+$/g, '') // trim hyphens
}

async function ensureCustomerForUser(userId: string, email?: string, name?: string) {
  return prisma.customer.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      stripeCustomerId: 'cus_seed_' + userId.slice(0, 8),
      email,
      name: name ?? 'Customer',
      description: 'Seeded customer record for testing',
      livemode: false,
      metadata: {},
      invoice_settings: {},
      shipping: {},
      tax_exempt: 'none',
      tax_ids: [],
    },
  })
}

async function ensureApiKeyForCustomer(customerId: string, description: string, rawKey: string) {
  const existing = await prisma.apiKey.findFirst({
    where: { customerId, description, status: 'active' },
  })
  if (existing) return existing

  const apiKeyHash = await bcrypt.hash(rawKey, 12)
  return prisma.apiKey.create({
    data: {
      customerId,
      description,
      apiKeyHash,
      status: 'active',
    },
  })
}

async function ensureSystem(userId: string, openKjSystemId: number, name: string) {
  return prisma.system.upsert({
    where: {
      systems_user_id_openkj_system_id_key: {
        userId,
        openKjSystemId,
      },
    },
    update: { name },
    create: {
      userId,
      openKjSystemId,
      name,
    },
  })
}

async function ensureVenue(userId: string, urlName: string, data: Omit<Parameters<typeof prisma.venue.create>[0]['data'], 'userId' | 'urlName'>) {
  return prisma.venue.upsert({
    where: {
      venues_userid_urlname_key: {
        userId,
        urlName,
      },
    },
    update: data,
    create: { userId, urlName, ...data },
  })
}

async function seedAdminUser() {
  const adminPasswordHash = await bcrypt.hash('admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash: adminPasswordHash,
      accountType: 'admin',
      adminLevel: 'super_admin',
    },
  })
  return admin
}

async function seedCustomerUser() {
  const customerPasswordHash = await bcrypt.hash('customer123!', 12)
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      name: 'Customer User',
      passwordHash: customerPasswordHash,
      businessName: 'Test Singr Venue',
      phoneNumber: '+1-605-555-0123',
      accountType: 'customer',
    },
  })

  // state
  await prisma.state.upsert({
    where: { userid: customerUser.id },
    update: {},
    create: { userId: customerUser.id },
  })

  // system (openKjSystemId = 1)
  await ensureSystem(customerUser.id, 1, 'Main System 1')

  // venue
  await ensureVenue(customerUser.id, 'singr-bar', {
    name: "Sandy's Bar Grill & Casino",
    address: '519 9th Ave SE',
    city: 'Watertown',
    state: 'SD',
    zip: 57201,
    country: 'USA',
    latitude: '44.89017',
    longitude: '-97.10838',
    hereplaceid: 'here:pds:place:8409zfzq-a4443b27ffeebda69129098386bb86c1',
    acceptingRequests: true,
    accepting: true,
    currentSystemId: 1,
  })

  // customer record (for Stripe linkage)
  const customer = await ensureCustomerForUser(customerUser.id, customerUser.email, customerUser.name ?? undefined)

  // API key
  await ensureApiKeyForCustomer(customer.id, 'Default API Key for Singr Connect', 'test-api-key-123456789')

  // sample songs
  const songs = [
    { artist: 'Queen', title: 'Bohemian Rhapsody' },
    { artist: 'Journey', title: "Don't Stop Believin'" },
    { artist: 'ABBA', title: 'Dancing Queen' },
    { artist: 'Neil Diamond', title: 'Sweet Caroline' },
    { artist: 'Garth Brooks', title: 'Friends In Low Places' },
  ]

  const toCreate = songs.map((s) => {
    const combined = `${s.artist} - ${s.title}`
    return {
      userId: customerUser.id,
      openKjSystemId: 1,
      artist: s.artist,
      title: s.title,
      combined,
      normalizedCombined: normalizeCombined(combined),
    }
  })

  await prisma.songDb.createMany({ data: toCreate, skipDuplicates: true })

  return customerUser
}

async function main() {
  console.log('🌱 Seeding database...')

  const admin = await seedAdminUser()
  const customer = await seedCustomerUser()

  console.log('✅ Database seed complete!\n')
  console.log(`👑 Admin Login:`)
  console.log(`   Email:    ${admin.email}`)
  console.log(`   Password: admin123!`)
  console.log('\n👤 Customer Login:')
  console.log(`   Email:    ${customer.email}`)
  console.log(`   Password: customer123!`)
  console.log('\n🔑 Test API Key (raw): test-api-key-123456789 (hash stored only)')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
