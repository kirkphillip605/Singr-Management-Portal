import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'

/**
 * Admin / support authorization guards.
 *
 * Reads the unified `roles` array on the session. Legacy admin/support
 * accounts that pre-date the roles migration are normalised in
 * `auth-server.ts` so this code only ever has to think in terms of the
 * new role names.
 *
 *   - `support`      — staff member with read access to support tools
 *   - `super_admin`  — full administrator (must include `super_admin`)
 *
 * Public surface routing is handled separately in `src/middleware.ts`.
 */

export type AdminLevel = 'support' | 'super_admin'

export async function getAdminSession() {
  const session = await getAuthSession()
  if (!session?.user) return null
  if (
    !session.user.roles?.includes('support') &&
    !session.user.roles?.includes('super_admin')
  ) {
    return null
  }
  return session
}

export async function requireAdminSession(
  requiredLevel: AdminLevel = 'support',
) {
  const session = await getAuthSession()
  if (!session?.user) redirect('/auth/signin')

  const isSupport =
    session.user.roles?.includes('support') ||
    session.user.roles?.includes('super_admin')
  if (!isSupport) redirect('/auth/signin')

  if (
    requiredLevel === 'super_admin' &&
    !session.user.roles?.includes('super_admin')
  ) {
    redirect('/admin')
  }

  return session
}

export function assertAdminLevel(
  session: Awaited<ReturnType<typeof getAdminSession>>,
  requiredLevel: AdminLevel = 'support',
) {
  if (!session?.user) return false
  const isSupport =
    session.user.roles?.includes('support') ||
    session.user.roles?.includes('super_admin')
  if (!isSupport) return false
  if (requiredLevel === 'super_admin') {
    return !!session.user.roles?.includes('super_admin')
  }
  return true
}
