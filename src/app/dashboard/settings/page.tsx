export const runtime = 'nodejs'

import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const session = await getAuthSession()
  if (!session?.user?.id) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' } },
      accounts: {
        select: {
          id: true,
          providerId: true,
          accountId: true,
        },
      },
    },
  })
  if (!user) redirect('/auth/signin')

  const activeSubscription = user.subscriptions.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  )

  return (
    <SettingsClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        businessName: user.businessName ?? '',
        phoneNumber: user.phoneNumber ?? '',
        phoneNumberVerified: user.phoneNumberVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        accounts: user.accounts.map((a) => ({
          id: a.id,
          providerId: a.providerId,
        })),
      }}
      activeSubscription={
        activeSubscription
          ? {
              status: activeSubscription.status,
              currentPeriodEnd: activeSubscription.currentPeriodEnd.toISOString(),
            }
          : null
      }
    />
  )
}
