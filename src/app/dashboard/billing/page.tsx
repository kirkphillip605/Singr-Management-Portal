import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, FileText, Download, ExternalLink, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { formatAmountForDisplay } from '@/lib/stripe'
import { logger } from '@/lib/logger'

async function BillingPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      customer: true,
    },
  })

  if (!user) {
    redirect('/auth/signin')
  }

  // Get live data from Stripe if we have a customer
  let stripeCustomer = null
  let subscriptions = []
  let paymentMethods = []
  let invoices = []

  if (user.customer?.stripeCustomerId) {
    try {
      // Get customer data from Stripe
      stripeCustomer = await stripe.customers.retrieve(user.customer.stripeCustomerId)
      
      // Get subscriptions
      const subsResponse = await stripe.subscriptions.list({
        customer: user.customer.stripeCustomerId,
        status: 'all',
        limit: 10,
      })
      subscriptions = subsResponse.data

      // Get payment methods
      const pmResponse = await stripe.paymentMethods.list({
        customer: user.customer.stripeCustomerId,
        limit: 10,
      })
      paymentMethods = pmResponse.data

      // Get recent invoices
      const invoiceResponse = await stripe.invoices.list({
        customer: user.customer.stripeCustomerId,
        limit: 10,
      })
      invoices = invoiceResponse.data
    } catch (error) {
      logger.error('Error fetching Stripe data:', error)
    }
  }

  const activeSubscription = subscriptions.find(
    sub => sub.status === 'active' || sub.status === 'trialing'
  )

  const handleCustomerPortal = async () => {
    'use client'
    
    const response = await fetch('/api/billing/customer-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const { url } = await response.json()
      window.location.href = url
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">
            Manage your Singr Karaoke Connect subscription and billing information
          </p>
        </div>
      </div>

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription & Billing
          </CardTitle>
          <CardDescription>
            Manage your subscription, payment methods, and billing through Stripe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSubscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Singr Karaoke Connect</h3>
                  <p className="text-muted-foreground">
                    Status: <Badge variant={
                      activeSubscription.status === 'active' 
                        ? 'default' 
                        : activeSubscription.status === 'trialing'
                        ? 'secondary'
                        : 'destructive'
                    }>
                      {activeSubscription.status === 'trialing' ? 'Trial' : activeSubscription.status}
                    </Badge>
                  </p>
                </div>
              </div>

              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Current period:</span>
                  <span>
                    {new Date(activeSubscription.current_period_start * 1000).toLocaleDateString()} -{' '}
                    {new Date(activeSubscription.current_period_end * 1000).toLocaleDateString()}
                  </span>
                </div>
                {activeSubscription.cancel_at_period_end && (
                  <div className="flex justify-between">
                    <span>Cancels on:</span>
                    <span>{new Date(activeSubscription.current_period_end * 1000).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {activeSubscription.cancel_at_period_end && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Your subscription will be cancelled at the end of the current billing period on{' '}
                    {new Date(activeSubscription.current_period_end * 1000).toLocaleDateString()}.
                  </AlertDescription>
                </Alert>
              )}

              <CustomerPortalButton />
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                You don't have an active subscription. Choose a plan to unlock all features.
              </p>
              <Link href="/dashboard/billing/plans">
                <Button>Choose a Plan</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods Overview */}
      {paymentMethods && paymentMethods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>
              Your saved payment methods (managed through Stripe)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentMethods.slice(0, 3).map((pm: any) => (
                <div key={pm.id} className="flex items-center space-x-3 p-3 border rounded-md">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {pm.card ? (
                        <>
                          {pm.card.brand.toUpperCase()} •••• {pm.card.last4}
                        </>
                      ) : (
                        `${pm.type.toUpperCase()} Payment Method`
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pm.card ? (
                        `Expires ${pm.card.exp_month}/${pm.card.exp_year}`
                      ) : (
                        `Added ${new Date(pm.created * 1000).toLocaleDateString()}`
                      )}
                    </p>
                  </div>
                </div>
              ))}
              <CustomerPortalButton variant="outline" text="Manage Payment Methods" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices Overview */}
      {invoices && invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>
              View and download your billing history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices.slice(0, 5).map((invoice: any) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {formatAmountForDisplay(invoice.amount_paid || 0, invoice.currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.created * 1000).toLocaleDateString()} • {invoice.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        invoice.status === 'paid' 
                          ? 'default' 
                          : invoice.status === 'open'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {invoice.status}
                    </Badge>
                    {invoice.hosted_invoice_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <CustomerPortalButton variant="outline" text="View All Invoices" />
            </div>
          </CardContent>
        </Card>
      )}

      {!activeSubscription && (
        <div className="text-center">
          <Link href="/dashboard/billing/plans">
            <Button size="lg">
              Choose a Plan
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

export default BillingPage