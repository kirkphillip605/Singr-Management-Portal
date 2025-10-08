import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'
import { DashboardLayoutShell } from '@/components/dashboard-layout-shell'

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
    <DashboardLayoutShell userEmail={session.user?.email}>
      {children}
    </DashboardLayoutShell>
  )
}