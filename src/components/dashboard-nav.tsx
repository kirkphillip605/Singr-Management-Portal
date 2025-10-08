'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Venues', href: '/dashboard/venues' },
  { name: 'API Keys', href: '/dashboard/api-keys' },
  { name: 'Systems', href: '/dashboard/systems' },
  { name: 'Song Database', href: '/dashboard/songs' },
  { name: 'Requests', href: '/dashboard/requests' },
  { name: 'Billing', href: '/dashboard/billing' },
  { name: 'Support', href: '/dashboard/support' },
  { name: 'Settings', href: '/dashboard/settings' },
]

type DashboardNavProps = {
  onNavigate?: () => void
}

export function DashboardNav({ onNavigate }: DashboardNavProps) {
  const pathname = usePathname()

  return (
    <nav className="space-y-2">
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.name}
            href={item.href}
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
