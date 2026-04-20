import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  // Backfill roles from accountType/adminLevel
  const users = await prisma.user.findMany({
    select: { id: true, accountType: true, adminLevel: true, roles: true },
  })
  let rolesUpdated = 0
  for (const u of users) {
    if (u.roles && u.roles.length > 0) continue
    const r = new Set()
    if (u.accountType === 'customer') r.add('host')
    if (u.accountType === 'support') r.add('support')
    if (u.accountType === 'admin') {
      r.add('support')
      if (u.adminLevel === 'super_admin') r.add('super_admin')
    }
    // Least-privilege fallback: leave roles[] empty so the user has no
    // access until an admin explicitly grants them a role.
    await prisma.user.update({
      where: { id: u.id },
      data: { roles: { set: Array.from(r) } },
    })
    rolesUpdated++
  }
  // Backfill stripeCustomerId from Customer table
  const customers = await prisma.customer.findMany({
    select: { userId: true, stripeCustomerId: true },
  })
  let scuUpdated = 0
  for (const c of customers) {
    const existing = await prisma.user.findUnique({
      where: { id: c.userId },
      select: { stripeCustomerId: true },
    })
    if (existing && !existing.stripeCustomerId) {
      try {
        await prisma.user.update({
          where: { id: c.userId },
          data: { stripeCustomerId: c.stripeCustomerId },
        })
        scuUpdated++
      } catch (e) {
        console.warn(`skip user ${c.userId}: ${e.message}`)
      }
    }
  }
  console.log(`Backfilled roles for ${rolesUpdated} users, stripeCustomerId for ${scuUpdated} users.`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
