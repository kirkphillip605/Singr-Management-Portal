import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { getAuthSession, type AuthSession } from '@/lib/auth-server'

/**
 * Customer / host-portal authorization guard.
 *
 * The product runs four auth realms over a single Postgres DB
 * (customer / admin / support / singer). Cookie-name isolation in
 * `src/lib/auth.ts` already prevents a session minted on one surface
 * from being *presented* as a session on another, but route handlers
 * still have to refuse a request that arrives carrying the wrong
 * `accountType` (defense in depth — e.g. a stolen support cookie
 * being replayed against the host portal, or a future bug that
 * widens cookie scope).
 *
 * `requireCustomerSession` is for server components / SSR pages
 * (it `redirect()`s to sign-in / `/admin` like the admin equivalent).
 * `requireCustomerApi` is for route handlers (it returns a JSON
 * response you can `return` straight from the handler when the
 * caller is unauthorised, otherwise it returns the session).
 */

export async function requireCustomerSession(): Promise<AuthSession> {
  const session = await getAuthSession()
  if (!session?.user) {
    redirect('/auth/signin')
  }
  if (session.user.accountType !== 'customer') {
    // Admin / support users land on the admin console instead of the
    // customer portal; anyone else gets bounced back to sign-in.
    if (
      session.user.accountType === 'admin' ||
      session.user.accountType === 'support'
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
  if (session.user.accountType !== 'customer') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Forbidden',
          message:
            'This endpoint is only available to customer (host) accounts.',
        },
        { status: 403 },
      ),
    }
  }
  return { ok: true, session }
}
