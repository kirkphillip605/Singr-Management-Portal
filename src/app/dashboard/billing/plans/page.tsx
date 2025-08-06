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
  const prices = await prisma.stripePrice.findMany({
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">
          Select the perfect plan for your karaoke business
        </p>
      </div>

      <PricingPlans prices={prices} />
    </div>
  )
}