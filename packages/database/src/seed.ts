// Singr Karaoke Connect — Database Seed
// Creates sample admin + host users with venues, songs, and API keys for development.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function normalizeCombined(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function ensureApiKeyForUser(userId: string, description: string, rawKey: string) {
  const existing = await prisma.apiKey.findFirst({
    where: { userId, description, status: 'active' },
  })
  if (existing) return existing

  const apiKeyHash = await bcrypt.hash(rawKey, 12)
  return prisma.apiKey.create({
    data: {
      userId,
      description,
      apiKeyHash,
      status: 'active',
    },
  })
}

async function ensureSystem(userId: string, openkjSystemId: number, name: string) {
  return prisma.system.upsert({
    where: {
      userId_openkjSystemId: {
        userId,
        openkjSystemId,
      },
    },
    update: { name },
    create: {
      userId,
      openkjSystemId,
      name,
    },
  })
}

async function seedAdminUser() {
  const passwordHash = await bcrypt.hash('admin123!', 12)
  return prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      roles: ['super_admin'],
      emailVerified: true,
      accounts: {
        create: {
          accountId: 'admin@example.com',
          providerId: 'credential',
          password: passwordHash,
        },
      },
    },
  })
}

async function seedHostUser() {
  const passwordHash = await bcrypt.hash('host123!', 12)
  const user = await prisma.user.upsert({
    where: { email: 'host@example.com' },
    update: {},
    create: {
      email: 'host@example.com',
      name: 'Demo Host',
      businessName: 'Test Singr Venue',
      phoneNumber: '+16055550123',
      roles: ['host'],
      emailVerified: true,
      stripeCustomerId: 'cus_seed_demo_host',
      accounts: {
        create: {
          accountId: 'host@example.com',
          providerId: 'credential',
          password: passwordHash,
        },
      },
    },
  })

  // State
  await prisma.state.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })

  // System
  await ensureSystem(user.id, 1, 'Main System 1')

  // Venue
  await prisma.venue.upsert({
    where: { openkjVenueId: 1 },
    update: {},
    create: {
      userId: user.id,
      urlName: 'singr-bar',
      name: "Sandy's Bar Grill & Casino",
      address: '519 9th Ave SE',
      city: 'Watertown',
      state: 'SD',
      postalCode: '57201',
      country: 'USA',
      latitude: 44.89017,
      longitude: -97.10838,
      acceptingRequests: true,
      accepting: true,
      currentSystemId: 1,
      openkjVenueId: 1,
    },
  })

  // API key
  await ensureApiKeyForUser(user.id, 'Default API Key for Singr Connect', 'test-api-key-123456789')

  // Sample songs
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
      userId: user.id,
      openkjSystemId: 1,
      artist: s.artist,
      title: s.title,
      combined,
      normalizedCombined: normalizeCombined(combined),
    }
  })

  await prisma.songDb.createMany({ data: toCreate, skipDuplicates: true })

  return user
}

async function main() {
  console.log('🌱 Seeding database...')

  const admin = await seedAdminUser()
  const host = await seedHostUser()

  console.log('✅ Database seed complete!\n')
  console.log('👑 Admin Login:')
  console.log(`   Email:    ${admin.email}`)
  console.log('   Password: admin123!')
  console.log('\n🎤 Host Login:')
  console.log(`   Email:    ${host.email}`)
  console.log('   Password: host123!')
  console.log('\n🔑 Test API Key (raw): test-api-key-123456789')
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
