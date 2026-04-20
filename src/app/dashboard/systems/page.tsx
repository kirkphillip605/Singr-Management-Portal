import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { SystemsManager, SystemSummary } from '@/components/systems-manager'

export const runtime = 'nodejs'

export default async function SystemsPage() {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const systems = await prisma.system.findMany({
    where: { userId: session.user.id },
    orderBy: { openkjSystemId: 'asc' },
  })

  const serializedSystems: SystemSummary[] = systems.map((system) => ({
    id: system.id,
    name: system.name,
    openKjSystemId: system.openkjSystemId,
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
