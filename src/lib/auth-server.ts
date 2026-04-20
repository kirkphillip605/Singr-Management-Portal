import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

/**
 * Returns a NextAuth-compatible session shape so legacy server
 * components / route handlers can keep using `session.user.id`,
 * `session.user.accountType`, etc. New code should prefer reading
 * `session.user.roles` (a `string[]`) — `accountType`/`adminLevel`
 * are derived from the role array for back-compat.
 */
export async function getAuthSession() {
  const hdrs = await headers()
  const data = await auth.api.getSession({ headers: hdrs })
  if (!data?.user) return null

  const user = data.user as typeof data.user & {
    roles?: string[] | null
    accountType?: 'customer' | 'admin' | 'support' | null
    adminLevel?: 'support' | 'super_admin' | null
    businessName?: string | null
    displayName?: string | null
    avatarUrl?: string | null
    mustSetPassword?: boolean | null
    stripeCustomerId?: string | null
    banned?: boolean | null
  }

  const roles: string[] =
    Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : deriveRoles(user.accountType, user.adminLevel)

  // Legacy `accountType` is derived from the role list so all the
  // existing `session.user.accountType === 'customer'` checks continue
  // to work without modification while the rename ripples through.
  //
  // IMPORTANT: only return `'customer'` (the host bucket) when the user
  // actually has the `host` role. A singer-only account must NOT pass
  // host-only legacy checks like `accountType === 'customer'`, otherwise
  // a singer could call host-only endpoints (api-keys, venues, systems,
  // support, etc.). Singers without any host/admin role get `null`,
  // which fails every `accountType === '...'` legacy check by design.
  const legacyAccountType: 'customer' | 'admin' | 'support' | null =
    roles.includes('super_admin')
      ? 'admin'
      : roles.includes('support')
        ? 'support'
        : roles.includes('host')
          ? 'customer'
          : null

  const legacyAdminLevel: 'super_admin' | 'support' | undefined =
    roles.includes('super_admin')
      ? 'super_admin'
      : roles.includes('support')
        ? 'support'
        : undefined

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      roles,
      accountType: legacyAccountType,
      adminLevel: legacyAdminLevel,
      adminId: roles.includes('support') ? user.id : undefined,
      userId: roles.includes('host') ? user.id : undefined,
      businessName: user.businessName ?? undefined,
      displayName: user.displayName ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      mustSetPassword: !!user.mustSetPassword,
      stripeCustomerId: user.stripeCustomerId ?? undefined,
      banned: !!user.banned,
    },
    session: data.session,
  }
}

function deriveRoles(
  accountType: string | null | undefined,
  adminLevel: string | null | undefined,
): string[] {
  const r = new Set<string>()
  if (accountType === 'customer') r.add('host')
  if (accountType === 'support') r.add('support')
  if (accountType === 'admin') {
    r.add('support')
    if (adminLevel === 'super_admin') r.add('super_admin')
  }
  if (r.size === 0) r.add('host')
  return Array.from(r)
}

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>

/* ---------- Role helpers used by new code ---------- */

export function hasRole(
  session: AuthSession | null | undefined,
  role: string,
): boolean {
  return !!session?.user?.roles?.includes(role)
}

export function hasAnyRole(
  session: AuthSession | null | undefined,
  roles: string[],
): boolean {
  return !!session?.user?.roles?.some((r) => roles.includes(r))
}
