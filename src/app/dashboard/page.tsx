import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatAmountForDisplay } from '@/lib/format-currency'
import { CreditCard, AlertTriangle, CheckCircle, Clock, Key, MapPin, Music } from 'lucide-react'

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

  // Get subscription status from Stripe if we have a customer
  let activeSubscription = null
  let nextInvoice = null
  let subscriptionDetails = null

  if (user?.customer?.stripeCustomerId) {
    try {
      // Get active subscriptions
      const subsResponse = await stripe.subscriptions.list({
        customer: user.customer.stripeCustomerId,
        status: 'all',
        limit: 10,
      })
      
      activeSubscription = subsResponse.data.find(
        sub => sub.status === 'active' || sub.status === 'trialing'
      )

      if (activeSubscription) {
        // Get upcoming invoice for payment details
        try {
          const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
            customer: user.customer.stripeCustomerId,
            subscription: activeSubscription.id,
          })
          nextInvoice = upcomingInvoice
        } catch (error) {
          // No upcoming invoice or error - that's okay
          logger.warn('No upcoming invoice found:', error)
        }

        // Get subscription details
        subscriptionDetails = {
          id: activeSubscription.id,
          status: activeSubscription.status,
          currentPeriodStart: new Date(activeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(activeSubscription.current_period_end * 1000),
          trialStart: activeSubscription.trial_start ? new Date(activeSubscription.trial_start * 1000) : null,
          trialEnd: activeSubscription.trial_end ? new Date(activeSubscription.trial_end * 1000) : null,
          cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
          priceId: activeSubscription.items.data[0]?.price.id,
          priceAmount: activeSubscription.items.data[0]?.price.unit_amount,
          currency: activeSubscription.items.data[0]?.price.currency || 'usd',
          interval: activeSubscription.items.data[0]?.price.recurring?.interval,
          intervalCount: activeSubscription.items.data[0]?.price.recurring?.interval_count || 1,
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch subscription status:', error)
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

  const getPlanDisplayName = () => {
    if (!subscriptionDetails) return 'No Plan'
    
    const { interval, intervalCount } = subscriptionDetails
    if (interval === 'month' && intervalCount === 1) return 'Monthly Plan'
    if (interval === 'month' && intervalCount === 6) return 'Semi-Annual Plan'
    if (interval === 'year') return 'Annual Plan'
    return 'Singr Pro Plan'
  }

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
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Venues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.venues.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Music className="h-4 w-4" />
              Total Songs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSongs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Status
            </CardTitle>
            <CardDescription>
              Your current plan and billing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptionDetails ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Plan:</span>
                  <span className="font-semibold">{getPlanDisplayName()}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <div className="flex items-center gap-2">
                    {subscriptionDetails.status === 'active' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {subscriptionDetails.status === 'trialing' && (
                      <Clock className="h-4 w-4 text-blue-600" />
                    )}
                    <Badge
                      variant={
                        subscriptionDetails.status === 'active' 
                          ? 'default' 
                          : subscriptionDetails.status === 'trialing'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {subscriptionDetails.status === 'trialing' ? 'Free Trial' : subscriptionDetails.status}
                    </Badge>
                  </div>
                </div>

                {subscriptionDetails.status === 'trialing' && subscriptionDetails.trialEnd && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Trial ends:</span>
                    <span className="font-medium">
                      {subscriptionDetails.trialEnd.toLocaleDateString()}
                    </span>
                  </div>
                )}

                {subscriptionDetails.status === 'active' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Current period:</span>
                      <span className="text-sm">
                        {subscriptionDetails.currentPeriodStart.toLocaleDateString()} - {subscriptionDetails.currentPeriodEnd.toLocaleDateString()}
                      </span>
                    </div>

                    {nextInvoice && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Next payment:</span>
                          <span className="font-medium">
                            {formatAmountForDisplay(nextInvoice.amount_due || 0, nextInvoice.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Payment date:</span>
                          <span className="font-medium">
                            {new Date((nextInvoice.next_payment_attempt || nextInvoice.period_end) * 1000).toLocaleDateString()}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}

                {subscriptionDetails.cancelAtPeriodEnd && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Your subscription will cancel on {subscriptionDetails.currentPeriodEnd.toLocaleDateString()}
                    </AlertDescription>
                  </Alert>
                )}

                <Link href="/dashboard/billing">
                  <Button variant="outline" className="w-full">
                    Manage Billing
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="mb-4">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <h3 className="font-semibold text-lg">No Active Subscription</h3>
                  <p className="text-muted-foreground text-sm">
                    Choose a plan to access all features
                  </p>
                </div>
                <Link href="/dashboard/billing/plans">
                  <Button className="w-full">
                    Choose a Plan
                  </Button>
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
                <MapPin className="h-8 w-8 text-primary mx-auto mb-2" />
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
                <Key className="h-8 w-8 text-primary mx-auto mb-2" />
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
                <CreditCard className="h-8 w-8 text-primary mx-auto mb-2" />
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
