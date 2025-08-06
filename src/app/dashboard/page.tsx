import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  // Get user data with relationships
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      customer: {
        include: {
          subscriptions: {
            orderBy: {
              created: 'desc',
            },
          },
          apiKeys: {
            where: {
              status: 'active',
            },
          },
        },
      },
      venues: {
        include: {
          requests: {
            take: 5,
            orderBy: {
              requestTime: 'desc',
            },
          },
        },
      },
      songDb: {
        take: 1,
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  // Find active subscription
  const activeSubscription = user?.customer?.subscriptions.find(sub => 
    sub.status === 'active' || sub.status === 'trialing'
  )

  // Get product name from price metadata or product lookup
  let productName = 'Pro Plan'
  if (activeSubscription?.priceId) {
    const price = await prisma.price.findUnique({
      where: { id: activeSubscription.priceId },
      include: { productRelation: true }
    }).catch(() => null)
    
    if (price?.productRelation?.name) {
      productName = price.productRelation.name
    }
  }

  const totalSongs = await prisma.songDb.count({
    where: { userId: session.user.id },
  })

  const totalRequests = await prisma.request.count({
    where: {
      venue: {
        userId: session.user.id,
      },
    },
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Singr Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || user?.email}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Venues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.venues.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Songs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSongs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.customer?.apiKeys.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Subscription Status */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Status</CardTitle>
            <CardDescription>
              Your current plan and billing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSubscription ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <span className="font-medium">
                    {productName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-medium capitalize ${
                    activeSubscription.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {activeSubscription.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Next billing:</span>
                  <span className="font-medium">
                    {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">No active subscription</p>
                <Link href="/dashboard/billing">
                  <Button>Choose a Plan</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>
              Latest karaoke requests from your venues
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user?.venues.some(venue => venue.requests.length > 0) ? (
              <div className="space-y-3">
                {user.venues
                  .flatMap(venue => venue.requests.map(req => ({ ...req, venue })))
                  .slice(0, 5)
                  .map((request) => (
                    <div key={request.requestId.toString()} className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{request.artist} - {request.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.singer} at {request.venue.name}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(request.requestTime).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No recent requests
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/dashboard/venues">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <h3 className="font-medium">Manage Venues</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add or configure your karaoke venues
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/api-keys">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <h3 className="font-medium">API Keys</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage OpenKJ integration keys
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/billing">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <h3 className="font-medium">Billing</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  View invoices and manage subscription
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}