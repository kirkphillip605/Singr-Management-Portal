import { NextRequest, NextResponse } from 'next/server'

/**
 * Host → surface routing.
 *
 * The whole product runs as a single Next.js process, but we serve it under
 * several public hostnames. This middleware inspects the `Host` header and
 * rewrites incoming requests into the right section of the app so that:
 *
 *   - `singrkaraoke.com` / `www.singrkaraoke.com` → marketing landing page
 *   - `host.singrkaraoke.com`                     → customer portal (the
 *                                                    existing `/dashboard`
 *                                                    tree, with the
 *                                                    `/dashboard` prefix
 *                                                    hidden from the URL bar)
 *   - `api.singrkaraoke.com`                      → `/api/*` route handlers
 *   - everything else (Replit preview domains,
 *     `localhost`, etc.)                          → fall through unchanged so
 *                                                    development and previews
 *                                                    keep working.
 *
 * Adding `admin.` or `app.` later is a single entry in the SURFACE_BY_HOST
 * map below.
 */

type Surface = 'apex' | 'host' | 'api' | 'admin'

interface SurfaceConfig {
  /** Internal path prefix that requests get rewritten to. `''` means root. */
  prefix: string
}

// Cookie prefixes for each surface live in `src/lib/auth.ts`
// (`SURFACE_COOKIE_PREFIXES`) — the source of truth Better Auth uses to
// build cookie names. Don't duplicate them here; the middleware only
// needs the URL-rewrite prefix.
const SURFACES: Record<Surface, SurfaceConfig> = {
  apex: { prefix: '' },
  host: { prefix: '/dashboard' },
  api: { prefix: '/api' },
  admin: { prefix: '/admin' },
}

const SURFACE_BY_HOST: Record<string, Surface> = {
  'singrkaraoke.com': 'apex',
  'www.singrkaraoke.com': 'apex',
  'host.singrkaraoke.com': 'host',
  'api.singrkaraoke.com': 'api',
  'admin.singrkaraoke.com': 'admin',
  // Local dev aliases — `*.localhost` works in browsers without /etc/hosts.
  'host.localhost': 'host',
  'api.localhost': 'api',
  'admin.localhost': 'admin',
  'singrkaraoke.localhost': 'apex',
}

function detectSurface(hostHeader: string | null): Surface | null {
  if (!hostHeader) return null
  const hostname = (hostHeader.split(':')[0] || '').toLowerCase()
  const direct = SURFACE_BY_HOST[hostname]
  if (direct) return direct
  // Allow an env override (handy on staging / preview)
  const override = process.env['SINGR_HOST_SURFACE_OVERRIDE']
  if (override && override in SURFACES) return override as Surface
  return null
}

const ALWAYS_PASS_THROUGH = [
  '/_next',
  '/static',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]

const ALLOWED_API_ORIGINS = (() => {
  const set = new Set<string>()
  set.add('https://host.singrkaraoke.com')
  set.add('https://singrkaraoke.com')
  set.add('https://www.singrkaraoke.com')
  // Future surfaces — pre-allowed so adding them later doesn't require a
  // CORS code change.
  set.add('https://app.singrkaraoke.com')
  set.add('https://admin.singrkaraoke.com')
  // Local dev convenience
  set.add('http://host.localhost:5000')
  set.add('http://localhost:5000')
  for (const extra of (process.env['SINGR_EXTRA_ALLOWED_ORIGINS'] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    set.add(extra)
  }
  return set
})()

function buildCorsHeaders(origin: string | null): Headers {
  const headers = new Headers()
  if (origin && ALLOWED_API_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    )
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-CSRF-Token'
    )
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const surface = detectSurface(req.headers.get('host'))

  // Unknown host (Replit preview, localhost, etc.) — keep the original
  // single-app behavior so dev and previews keep working.
  if (!surface) {
    return NextResponse.next()
  }

  // Static assets and Next internals always pass through, regardless of
  // host. Anything with a file extension (images, fonts, JSON manifests,
  // etc.) is treated as a `/public` asset and served as-is on every
  // surface, so the landing page logos and PWA icons render the same on
  // apex, host., and admin.
  const lastSegment = url.pathname.split('/').pop() || ''
  const looksLikeFile = lastSegment.includes('.')
  if (
    looksLikeFile ||
    ALWAYS_PASS_THROUGH.some((p) => url.pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  if (surface === 'api') {
    const origin = req.headers.get('origin')
    const cors = buildCorsHeaders(origin)

    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: cors })
    }

    // Origin-bound authorization context (browser callers only).
    //
    // The public `api.` surface serves the existing `/api/*` route
    // handlers — OpenKJ endpoints (bearer API key), webhooks, and the
    // Better Auth callback handler used by sibling-surface clients.
    //
    // Server-to-server callers (no `Origin` header — OpenKJ clients,
    // Stripe webhooks, scripts) pass through untouched. Browser
    // callers are required to come from an allow-listed origin so a
    // page on `evil.example.com` can't ride a user's
    // `.singrkaraoke.com` cookie into our API.
    if (origin && !ALLOWED_API_ORIGINS.has(origin)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    let rewritten = url.clone()
    if (!url.pathname.startsWith('/api')) {
      rewritten.pathname = `/api${url.pathname === '/' ? '' : url.pathname}`
    }
    const res = NextResponse.rewrite(rewritten)
    cors.forEach((value, key) => res.headers.set(key, value))
    return res
  }

  if (surface === 'apex') {
    // Apex serves the marketing landing + legal pages only. Auth, the
    // host portal, the admin console, and the public OpenKJ API each
    // live on their own subdomain (host., admin., api.). Anything else
    // 404s here so the apex truly is "marketing-only".
    const allowedOnApex =
      url.pathname === '/' ||
      url.pathname.startsWith('/legal')
    if (!allowedOnApex) {
      return new NextResponse('Not Found', { status: 404 })
    }
    return NextResponse.next()
  }

  if (surface === 'host') {
    // Internal API / Next assets pass through untouched.
    if (url.pathname.startsWith('/api')) {
      return NextResponse.next()
    }
    // The marketing landing only lives on the apex.
    if (url.pathname === '/') {
      // Send signed-out users straight to sign-in; signed-in users will be
      // forwarded to the dashboard by the existing layout logic.
      const dest = url.clone()
      dest.pathname = '/dashboard'
      return NextResponse.rewrite(dest)
    }
    // Auth + legal pages are served as-is so URLs like
    // host.singrkaraoke.com/auth/signin keep working.
    if (
      url.pathname.startsWith('/auth') ||
      url.pathname.startsWith('/legal')
    ) {
      return NextResponse.next()
    }
    // The admin console is not part of the host portal.
    if (url.pathname.startsWith('/admin')) {
      return new NextResponse('Not Found', { status: 404 })
    }
    // If a legacy link still points at `/dashboard/...`, redirect to the
    // clean URL so `/dashboard` never leaks into the user-visible URL bar.
    if (
      url.pathname === '/dashboard' ||
      url.pathname.startsWith('/dashboard/')
    ) {
      const stripped = url.pathname.replace(/^\/dashboard/, '') || '/'
      const dest = url.clone()
      dest.pathname = stripped
      return NextResponse.redirect(dest, 308)
    }
    // Everything else gets internally rewritten under /dashboard.
    const dest = url.clone()
    dest.pathname = `/dashboard${url.pathname}`
    return NextResponse.rewrite(dest)
  }

  if (surface === 'admin') {
    if (url.pathname.startsWith('/api')) return NextResponse.next()
    if (url.pathname.startsWith('/auth')) return NextResponse.next()
    if (
      url.pathname === '/admin' ||
      url.pathname.startsWith('/admin/')
    ) {
      const stripped = url.pathname.replace(/^\/admin/, '') || '/'
      const dest = url.clone()
      dest.pathname = stripped
      return NextResponse.redirect(dest, 308)
    }
    const dest = url.clone()
    dest.pathname = `/admin${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(dest)
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except static assets — host detection itself is cheap.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

export { SURFACES, SURFACE_BY_HOST, ALLOWED_API_ORIGINS }
