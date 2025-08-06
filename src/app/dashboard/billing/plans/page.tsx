import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PricingPlans } from '@/components/pricing-plans'

export default async function PlansPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  // Get all active prices
  const prices = await prisma.price.findMany({
    where: {
      active: true,
      type: 'recurring', 
    },
    include: {
      productRelation: true,
    },
    orderBy: {
      unitAmount: 'asc',
    },
  })

  // Get user's current subscription
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      customer: {
        include: {
          subscriptions: {
            where: {
              status: { in: ['active', 'trialing', 'past_due'] }, 
            },
            orderBy: {
              created: 'desc',
            },
            take: 1,
          },
        },
      },
    },
  })

  const currentSubscription = user?.customer?.subscriptions[0]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">
          Select the perfect plan for your karaoke business
        </p>
      </div>

      <PricingPlans 
        prices={prices} 
        currentSubscription={currentSubscription ? {
          price: currentSubscription.priceId,
          status: currentSubscription.status,
        } : undefined}
      />
    </div>
  )
}