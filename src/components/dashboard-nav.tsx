'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { stripPortalPrefix } from '@/lib/portal-links'
import { usePortalHref } from '@/components/portal-surface-context'

// Routes are written in their canonical, prefix-free form. The
// `portalHref` helper adds the `/dashboard` prefix on the apex / preview
// domain (where the route files live) and leaves it off on
// `host.singrkaraoke.com` (where middleware rewrites `/x` → `/dashboard/x`
// internally). This way `host.*` URLs render natively without the
// `/dashboard` redirect bounce, and active-state detection works against
// the actual path the user sees.
const navigation = [
  { name: 'Dashboard', path: '/' },
  { name: 'Venues', path: '/venues' },
  { name: 'API Keys', path: '/api-keys' },
  { name: 'Systems', path: '/systems' },
  { name: 'Song Database', path: '/songs' },
  { name: 'Requests', path: '/requests' },
  { name: 'Billing', path: '/billing' },
  { name: 'Support', path: '/support' },
  { name: 'Settings', path: '/settings' },
]

type DashboardNavProps = {
  onNavigate?: () => void
}

export function DashboardNav({ onNavigate }: DashboardNavProps) {
  const pathname = usePathname()
  const portalHref = usePortalHref()
  // Normalize so active-state checks work the same on the apex
  // (`/dashboard/venues`) and on `host.` (`/venues`).
  const normalized = stripPortalPrefix(pathname || '/')

  return (
    <nav className="space-y-2">
      {navigation.map((item) => {
        const isActive =
          normalized === item.path ||
          (item.path !== '/' && normalized.startsWith(`${item.path}/`))
        const href = portalHref(item.path)

        return (
          <Link
            key={item.name}
            href={href}
            className={cn(
              'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            aria-current={isActive ? 'page' : undefined}
            onClick={onNavigate}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
