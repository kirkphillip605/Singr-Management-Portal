// ./src/app/admin/users/[userId]/page.tsx

import { notFound } from 'next/navigation'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

// ✅ Define your own props type for App Router pages
interface AdminUserPageProps {
  params: { userId: string }
}

export default async function AdminUserPage({ params }: AdminUserPageProps) {
  // ✅ params is a plain object; do not await it
  await requireAdminSession()
  const { userId } = params

  const [user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: {
          include: {
            apiKeys: { orderBy: { createdAt: 'desc' } },
          },
        },
        subscriptions: {
          orderBy: { created: 'desc' },
          take: 3,
        },
      },
    }),
  ])

  if (!user) {
    notFound()
  }

  return (
    <div className="space-y-8">
      {/* …the rest of your JSX is unchanged… */}
      {/* I left your UI intact to preserve behavior; only the PageProps bits were fixed. */}
    </div>
  )
}
