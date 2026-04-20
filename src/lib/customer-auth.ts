import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { getAuthSession, type AuthSession } from '@/lib/auth-server'

/**
 * Host-portal authorization guards.
 *
 * Historically named `customer-auth.ts` because the host role was called
 * `customer` in the original schema. Behaviour is unchanged for callers:
 * the function names stay the same so the ~30 routes that import them
 * keep working; the underlying check now consults `session.user.roles`
 * (which derives `accountType` for back-compat in `auth-server.ts`).
 *
 * `requireCustomerSession` is for server components / SSR pages
 * (it `redirect()`s on failure). `requireCustomerApi` is for route
 * handlers (returns a JSON 401/403 response).
 */

export async function requireCustomerSession(): Promise<AuthSession> {
  const session = await getAuthSession()
  if (!session?.user) redirect('/auth/signin')
  if (!session.user.roles?.includes('host')) {
    if (
      session.user.roles?.includes('super_admin') ||
      session.user.roles?.includes('support')
    ) {
      redirect('/admin')
    }
    redirect('/auth/signin')
  }
  return session
}

export type CustomerApiAuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; response: NextResponse }

export async function requireCustomerApi(): Promise<CustomerApiAuthResult> {
  const session = await getAuthSession()
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  if (!session.user.roles?.includes('host')) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Forbidden',
          message: 'This endpoint is only available to host accounts.',
        },
        { status: 403 },
      ),
    }
  }
  return { ok: true, session }
}

// Re-export under the new name so new code can prefer the host
// terminology. The legacy names above stay as aliases.
export const requireHostSession = requireCustomerSession
export const requireHostApi = requireCustomerApi
