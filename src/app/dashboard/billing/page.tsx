import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, FileText, AlertTriangle, CheckCircle, Download, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatAmountForDisplay } from '@/lib/stripe'
import { SubscriptionManagement } from '@/components/subscription-management'

export default async function BillingPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

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
          invoices: {
            orderBy: {
              created: 'desc',
            },
            take: 10,
          },
          paymentMethods: {
            orderBy: {
              created: 'desc',
            },
          },
        },
      },
    },
  })

  const activeSubscription = user?.customer?.subscriptions.find(
    sub => sub.status === 'active' || sub.status === 'trialing'
  )

  const recentInvoices = user?.customer?.invoices || []
  const paymentMethods = user?.customer?.paymentMethods || []
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
      <SubscriptionManagement 
        subscription={activeSubscription} 
      />

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Manage your payment methods for subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <div key={pm.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {pm.cardBrand?.toUpperCase()} •••• {pm.cardLast4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires {pm.cardExpMonth}/{pm.cardExpYear}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t">
                <Button variant="outline" asChild>
                  <Link href="/api/billing/customer-portal">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Manage Payment Methods
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No payment methods added</p>
              <Button asChild>
                <Link href="/api/billing/customer-portal">
                  Add Payment Method
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>
            View and download your billing history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentInvoices.length > 0 ? (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {formatAmountForDisplay(Number(invoice.amountPaid || 0), invoice.currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.createdAt).toLocaleDateString()} • {invoice.status}
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
                    {invoice.hostedInvoiceUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No invoices yet</p>
            </div>
          )}
        </CardContent>
      </Card>

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