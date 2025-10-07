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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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

            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="uppercase tracking-wide">
                {(session.user?.adminLevel?.replace(/_/g, ' ') ?? 'support').toUpperCase()}
              </Badge>
              <DashboardHeader userEmail={session.user?.email} />
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-72 bg-white border-r min-h-[calc(100vh-89px)]">
          <AdminNav />
        </aside>

        <main className="flex-1 p-8 space-y-8">
          {children}
        </main>
      </div>
    </div>
  )
}
