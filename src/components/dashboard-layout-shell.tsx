'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

import { DashboardNav } from '@/components/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard-header'
import { usePortalHref } from '@/components/portal-surface-context'
import { cn } from '@/lib/utils'

type DashboardLayoutShellProps = {
  children: React.ReactNode
  userEmail?: string | null
}

export function DashboardLayoutShell({
  children,
  userEmail,
}: DashboardLayoutShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isSidebarOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isSidebarOpen])

  const closeSidebar = () => setIsSidebarOpen(false)
  const portalHref = usePortalHref()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-1 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <Link href={portalHref('/')} className="flex items-center gap-2">
              <Image
                src="/singr-icon.png"
                alt="Singr Karaoke"
                width={40}
                height={40}
                className="h-10 w-10"
                priority
              />
              <span className="text-xl font-bold">Singr Karaoke Connect</span>
            </Link>
          </div>

          <DashboardHeader userEmail={userEmail} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:gap-8">
        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            aria-label="Close navigation menu"
            onClick={closeSidebar}
          />
        )}

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85%] transform flex-col border-r border-slate-200 bg-white shadow-lg transition-transform duration-200 md:static md:z-auto md:h-auto md:w-64 md:max-w-none md:translate-x-0 md:border-none md:bg-transparent md:shadow-none',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
          aria-label="Primary navigation"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:hidden">
            <span className="text-sm font-semibold text-slate-900">Navigation</span>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={closeSidebar}
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-0">
            <DashboardNav onNavigate={closeSidebar} />
          </div>
        </aside>

        <main className="order-last flex-1 space-y-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:order-none md:p-8">
          {children}
        </main>
      </div>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 md:flex-row">
          <span>
            © {new Date().getFullYear()} KirkNetworks, LLC dba Singr Karaoke.
            All rights reserved.
          </span>
          <nav className="flex gap-4">
            <Link href="/legal/privacy" className="hover:text-primary">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-primary">
              Terms
            </Link>
            <Link href="/legal/refund" className="hover:text-primary">
              Refund
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
