import { NextResponse, type NextRequest } from 'next/server'

/**
 * Admin Console middleware — auth + role check.
 *
 * Every route in the admin console requires an active session with
 * support or super_admin role. The role check happens server-side in
 * the page/layout via `requireAdminSession()`, but we still redirect
 * unauthenticated users at the middleware layer for a better UX.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  const publicPaths = ['/auth', '/api/auth']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const sessionCookie =
    request.cookies.get('singr.session_token') ||
    request.cookies.get('singr.session_token.sig')

  if (!sessionCookie) {
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
