import { NextRequest } from 'next/server'
import { getAuthForHost } from '@/lib/auth'

export const runtime = 'nodejs'

// Each public surface (host portal, future admin & singer apps) gets its
// own Better Auth instance with a distinct cookie name. We dispatch by the
// incoming request's `Host` header so a sign-in flow on
// `host.singrkaraoke.com` sets a `singr.host.session_token` cookie, while
// the same handler on `admin.singrkaraoke.com` would set
// `singr.admin.session_token` — preventing cross-surface session reuse
// even if Domain scoping ever widened.
async function dispatch(req: NextRequest) {
  const auth = getAuthForHost(req.headers.get('host'))
  return auth.handler(req)
}

export const GET = dispatch
export const POST = dispatch
