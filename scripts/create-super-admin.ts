/**
 * scripts/create-super-admin.ts
 *
 * Idempotent super-admin bootstrap. Run once on a fresh deployment to
 * create (or promote) the very first super-admin user — the only
 * accounts that can reach the `/admin/*` console and grant other staff
 * the `support` or `super_admin` roles via the admin UI.
 *
 * Usage:
 *
 *     SINGR_SUPERADMIN_EMAIL='you@example.com' \
 *     SINGR_SUPERADMIN_PASSWORD='strong-password' \
 *     SINGR_SUPERADMIN_NAME='Jane Doe' \
 *       npx tsx scripts/create-super-admin.ts
 *
 * Re-running the script with the same email is safe — it only ever
 * adds the role / resets the password if requested.
 */

import { auth } from '../src/lib/auth'
import { prisma } from '../src/lib/prisma'

async function main() {
  const email = process.env.SINGR_SUPERADMIN_EMAIL
  const password = process.env.SINGR_SUPERADMIN_PASSWORD
  const name = process.env.SINGR_SUPERADMIN_NAME || 'Super Admin'

  if (!email || !password) {
    console.error(
      'Missing env vars. Set SINGR_SUPERADMIN_EMAIL and SINGR_SUPERADMIN_PASSWORD before running.',
    )
    process.exit(1)
  }
  if (password.length < 12) {
    console.error('Refusing to create a super-admin with a password shorter than 12 chars.')
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    const next = new Set([...(existing.roles ?? []), 'super_admin', 'support'])
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        roles: { set: Array.from(next) },
        accountType: 'admin',
        adminLevel: 'super_admin',
        emailVerified: true,
      },
    })
    console.log(
      `✅ Promoted existing user ${email} (id=${existing.id}) to super_admin.`,
    )
    await prisma.auditLog.create({
      data: {
        actorId: existing.id,
        action: 'user.promoted_super_admin',
        resource: 'user',
        resourceId: existing.id,
        surface: 'system',
        metadata: { script: 'create-super-admin', email },
      },
    })
    return
  }

  // Use Better Auth's sign-up endpoint so the password is hashed with
  // the same scheme as the rest of the app, the verification record is
  // marked correctly, and downstream databaseHooks fire.
  const result = await auth.api.signUpEmail({
    body: { email, password, name },
    asResponse: false,
  })

  const userId = (result as { user?: { id?: string } }).user?.id
  if (!userId) {
    console.error('Better Auth signUp did not return a user id:', result)
    process.exit(1)
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      roles: { set: ['super_admin', 'support'] },
      accountType: 'admin',
      adminLevel: 'super_admin',
      emailVerified: true,
      mustSetPassword: false,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: 'user.created_super_admin',
      resource: 'user',
      resourceId: userId,
      surface: 'system',
      metadata: { script: 'create-super-admin', email },
    },
  })

  console.log(`✅ Created super_admin: ${email} (id=${userId})`)
  console.log('   Role set: ["super_admin", "support"]')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('❌ create-super-admin failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
