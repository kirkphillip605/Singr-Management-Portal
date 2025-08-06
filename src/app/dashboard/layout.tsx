import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'
import Link from 'next/link'
import { DashboardNav } from '@/components/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard-header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()

  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <img
                src="/singr-logo-color.png"
                alt="Singr Karaoke"
                className="h-8 w-8"
              />
              <span className="text-xl font-bold">Singr Karaoke Connect</span>
            </Link>
            
            <DashboardHeader userEmail={session.user?.email} />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r min-h-[calc(100vh-73px)]">
          <DashboardNav />
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}