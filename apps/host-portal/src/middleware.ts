import { NextResponse, type NextRequest } from 'next/server'

/**
 * Host Portal middleware — lightweight auth redirect.
 * 
 * Since this app IS host.singrkaraoke.com, there's no subdomain routing
 * needed. We only check if unauthenticated users try to access protected
 * routes and redirect them to sign in.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicPaths = ['/auth', '/api/auth']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for session cookie (Better Auth uses 'singr.session_token')
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
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
