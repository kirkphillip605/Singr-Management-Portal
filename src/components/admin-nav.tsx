'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Customer Directory', href: '/admin' },
  { name: 'Global Activity', href: '/admin/activity' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="p-4 space-y-2">
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
