import Link from 'next/link'
import { requireAdminSession } from '@/lib/admin-auth'
import { AdminNav } from '@/components/admin-nav'
import { DashboardHeader } from '@/components/dashboard-header'
import { Badge } from '@/components/ui/badge'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdminSession()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:flex-nowrap sm:gap-6">
          <Link href="/admin" className="flex items-center space-x-2">
            <img
              src="/singr-icon.png"
              alt="Singr Karaoke"
              className="h-10 w-auto"
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold">Singr Support Portal</span>
              <span className="text-xs text-muted-foreground">
                Empowered admin access for customer assistance
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Badge variant="secondary" className="uppercase tracking-wide whitespace-nowrap">
              {(session.user?.adminLevel?.replace(/_/g, ' ') ?? 'support').toUpperCase()}
            </Badge>
            <DashboardHeader userEmail={session.user?.email} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-89px)] w-full max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8">
        <aside className="order-2 w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:order-1 md:w-72 md:border-none md:bg-transparent md:p-0 md:shadow-none">
          <div className="hidden md:block">
            <AdminNav />
          </div>
          <div className="md:hidden">
            <AdminNav />
          </div>
        </aside>

        <main className="order-1 w-full flex-1 space-y-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:order-2 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
