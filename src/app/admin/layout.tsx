import { requireAdminSession } from '@/lib/admin-auth'
import { AdminLayoutShell } from '@/components/admin/admin-layout-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdminSession()

  return (
    <AdminLayoutShell
      userEmail={session.user?.email}
      adminLevel={session.user?.adminLevel}
    >
      {children}
    </AdminLayoutShell>
  )
}
