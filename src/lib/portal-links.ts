/**
 * Helpers for building in-portal links that work whether the customer
 * portal is being served from the apex domain (development / Replit
 * preview, where routes live under `/dashboard/*`) or from
 * `host.singrkaraoke.com` (where the host-based middleware in
 * `src/middleware.ts` rewrites `/x` → `/dashboard/x` internally).
 *
 * We deliberately route the surface decision through a value that's
 * deterministic for the whole render pass — `getServerPortalSurface()`
 * on the server (read from the `Host` header) and the React context
 * provided by `<PortalSurfaceProvider>` on the client — instead of
 * reading `window.location.host` at render time. That way the server
 * and the client always agree on the rendered href, which keeps React
 * hydration warning-free.
 */

const PORTAL_PREFIX = '/dashboard'

export type PortalSurface = 'host' | 'apex'

/**
 * Build an absolute URL on a sibling surface (host., admin., api., app.)
 * given the current request's Host header. Keeps dev (`*.localhost:5000`)
 * and prod (`*.singrkaraoke.com`) symmetrical so the landing page can
 * link the support-login button to the admin sign-in page on the right
 * domain in either environment.
 */
export function siblingSurfaceUrl(
  hostHeader: string | null | undefined,
  subdomain: 'host' | 'admin' | 'api' | 'app',
  path: string,
): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  const raw = (hostHeader || '').toLowerCase()
  const parts = raw.split(':')
  const hostname = parts[0] || ''
  const port = parts[1]

  if (hostname.endsWith('.localhost') || hostname === 'localhost') {
    const portPart = port ? `:${port}` : ''
    return `http://${subdomain}.localhost${portPart}${clean}`
  }

  // Strip a known subdomain prefix to find the apex, then prepend the
  // requested subdomain. Falls back to `singrkaraoke.com` if we can't
  // recognise the host (e.g. a Replit preview URL): production users
  // expect the canonical domain anyway.
  const KNOWN = ['host.', 'admin.', 'api.', 'app.', 'www.']
  let apex: string = hostname
  for (const prefix of KNOWN) {
    if (apex.startsWith(prefix)) {
      apex = apex.slice(prefix.length)
      break
    }
  }
  if (!apex.includes('.')) {
    apex = 'singrkaraoke.com'
  }
  return `https://${subdomain}.${apex}${clean}`
}

const HOST_SUBDOMAINS = new Set([
  'host.singrkaraoke.com',
  'host.localhost',
])

export function detectPortalSurface(hostHeader: string | null | undefined): PortalSurface {
  if (!hostHeader) return 'apex'
  const hostname = (hostHeader.split(':')[0] || '').toLowerCase()
  return HOST_SUBDOMAINS.has(hostname) ? 'host' : 'apex'
}

/** Build a path inside the customer portal. Pass paths like `'/venues'`. */
export function portalHref(path: string, surface: PortalSurface = 'apex'): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (surface === 'host') {
    return clean === '/' ? '/' : clean
  }
  return clean === '/' ? PORTAL_PREFIX : `${PORTAL_PREFIX}${clean}`
}

/** Inverse: strip the portal prefix from a path so active-state checks
 *  work consistently on either surface. */
export function stripPortalPrefix(path: string): string {
  if (path === PORTAL_PREFIX) return '/'
  if (path.startsWith(`${PORTAL_PREFIX}/`)) return path.slice(PORTAL_PREFIX.length)
  return path
}
