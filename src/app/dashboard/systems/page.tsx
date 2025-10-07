import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SystemsManager, SystemSummary } from '@/components/systems-manager'

export const runtime = 'nodejs'

export default async function SystemsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const systems = await prisma.system.findMany({
    where: { userId: session.user.id },
    orderBy: { openKjSystemId: 'asc' },
  })

  const serializedSystems: SystemSummary[] = systems.map((system) => ({
    id: system.id,
    name: system.name,
    openKjSystemId: system.openKjSystemId,
    createdAt: system.createdAt.toISOString(),
    updatedAt: system.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Systems</h1>
        <p className="text-muted-foreground">
          Manage the OpenKJ systems associated with your Singr account. Each system receives a
          unique, gapless ID used for songbook synchronization.
        </p>
      </div>

      <SystemsManager initialSystems={serializedSystems} />
    </div>
  )
}
