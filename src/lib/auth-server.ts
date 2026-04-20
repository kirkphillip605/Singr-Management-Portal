import { headers } from 'next/headers'
import { getAuthForHost } from '@/lib/auth'

/**
 * Returns a NextAuth-compatible session shape so legacy server components
 * can keep using `session.user.id`, `session.user.accountType`, etc.
 *
 * Returns `null` when there is no signed-in user.
 */
export async function getAuthSession() {
  const hdrs = await headers()
  const auth = getAuthForHost(hdrs.get('host'))
  const data = await auth.api.getSession({ headers: hdrs })
  if (!data?.user) return null

  const user = data.user as typeof data.user & {
    accountType?: 'customer' | 'admin' | 'support' | null
    adminLevel?: 'support' | 'super_admin' | null
    businessName?: string | null
    mustSetPassword?: boolean | null
  }

  const accountType = (user.accountType ?? 'customer') as
    | 'customer'
    | 'admin'
    | 'support'

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      accountType,
      adminLevel: (user.adminLevel ?? undefined) as
        | 'support'
        | 'super_admin'
        | undefined,
      adminId: accountType === 'admin' ? user.id : undefined,
      userId: accountType === 'customer' ? user.id : undefined,
      mustSetPassword: !!user.mustSetPassword,
    },
    session: data.session,
  }
}

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>
