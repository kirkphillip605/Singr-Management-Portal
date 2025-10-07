// FILE: src/app/dashboard/billing/page.tsx
export const runtime = 'nodejs';

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CreditCard,
  FileText,
  Download,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { formatAmountForDisplay } from '@/lib/format-currency';
import { logger } from '@/lib/logger';
import { CustomerPortalButton } from '@/components/customer-portal-button';

/**
 * Safely format a Stripe UNIX-seconds timestamp or a JS/ISO date to a locale date.
 */
function formatMaybeUnix(value: number | string | Date | null | undefined): string {
  if (value == null) return '—';
  // Stripe returns UNIX seconds (number). Prisma returns Date objects.
  if (typeof value === 'number') {
    const d = new Date(value * 1000);
    return isNaN(d.valueOf()) ? '—' : d.toLocaleDateString();
  }
  if (value instanceof Date) {
    return isNaN(value.valueOf()) ? '—' : value.toLocaleDateString();
  }
  // string (ISO)
  const d = new Date(value);
  return isNaN(d.valueOf()) ? '—' : d.toLocaleDateString();
}

async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      customer: true,
    },
  });

  if (!user) {
    redirect('/auth/signin');
  }

  // Live data from Stripe (if we have a linked customer)
  let subscriptions: any[] = [];
  let paymentMethods: any[] = [];
  let invoices: any[] = [];

  if (user.customer?.stripeCustomerId) {
    try {
      // Subscriptions (active/trialing preferred; but fetch all for completeness)
      const subsResponse = await stripe.subscriptions.list({
        customer: user.customer.stripeCustomerId,
        status: 'all',
        limit: 10,
      });
      subscriptions = subsResponse.data ?? [];

      // Payment methods
      const pmResponse = await stripe.paymentMethods.list({
        customer: user.customer.stripeCustomerId,
        limit: 10,
      });
      paymentMethods = pmResponse.data ?? [];

      // Recent invoices
      const invoiceResponse = await stripe.invoices.list({
        customer: user.customer.stripeCustomerId,
        limit: 10,
      });
      invoices = invoiceResponse.data ?? [];
    } catch (error) {
      logger.error('Error fetching Stripe data:', error);
      // continue with DB fallback below
    }
  }

  // DB fallback for subscription (in case Stripe call failed or is delayed)
  const dbSubscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: { in: ['active', 'trialing'] },
    },
    orderBy: { created: 'desc' },
  });

  // Prefer live Stripe subscription if available; otherwise fall back to DB.
  const activeStripeSub = subscriptions.find(
    (s) => s?.status === 'active' || s?.status === 'trialing',
  );

  // Normalize a view model so the rest of the UI can use consistent keys.
  type NormalizedSub = {
    source: 'stripe' | 'db';
    status: string;
    currentPeriodStart?: number | Date | string | null;
    currentPeriodEnd?: number | Date | string | null;
    cancelAtPeriodEnd?: boolean;
  };

  let normalizedSub: NormalizedSub | null = null;

  if (activeStripeSub) {
    // Stripe returns UNIX seconds for period fields
    normalizedSub = {
      source: 'stripe',
      status: activeStripeSub.status,
      currentPeriodStart: activeStripeSub.current_period_start,
      currentPeriodEnd: activeStripeSub.current_period_end,
      cancelAtPeriodEnd: !!activeStripeSub.cancel_at_period_end,
    };
  } else if (dbSubscription) {
    // Prisma returns Date objects (camelCased by Prisma schema)
    normalizedSub = {
      source: 'db',
      status: dbSubscription.status,
      currentPeriodStart: dbSubscription.currentPeriodStart,
      currentPeriodEnd: dbSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: dbSubscription.cancelAtPeriodEnd ?? false,
    };
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
            Subscription &amp; Billing
          </CardTitle>
          <CardDescription>
            Manage your subscription, payment methods, and billing through Stripe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {normalizedSub ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Singr Karaoke Connect</h3>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <span>Status:</span>
                    <Badge
                      variant={
                        normalizedSub.status === 'active'
                          ? 'default'
                          : normalizedSub.status === 'trialing'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {normalizedSub.status === 'trialing' ? 'Trial' : normalizedSub.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Current period:</span>
                  <span>
                    {formatMaybeUnix(normalizedSub.currentPeriodStart)} —{' '}
                    {formatMaybeUnix(normalizedSub.currentPeriodEnd)}
                  </span>
                </div>

                {normalizedSub.cancelAtPeriodEnd && (
                  <div className="flex justify-between">
                    <span>Cancels on:</span>
                    <span>{formatMaybeUnix(normalizedSub.currentPeriodEnd)}</span>
                  </div>
                )}
              </div>

              {normalizedSub.cancelAtPeriodEnd && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Your subscription will be cancelled at the end of the current billing period on{' '}
                    {formatMaybeUnix(normalizedSub.currentPeriodEnd)}.
                  </AlertDescription>
                </Alert>
              )}

              <CustomerPortalButton />
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                You don&apos;t have an active subscription. Choose a plan to unlock all features.
              </p>
              <Button asChild>
                <Link href="/dashboard/billing/plans">Choose a Plan</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods Overview */}
      {paymentMethods && paymentMethods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Your saved payment methods (managed through Stripe)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentMethods.slice(0, 3).map((pm: any) => (
                <div key={pm.id} className="flex items-center space-x-3 p-3 border rounded-md">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {pm.card ? (
                        <>
                          {pm.card.brand?.toUpperCase?.()} •••• {pm.card.last4}
                        </>
                      ) : (
                        `${pm.type?.toUpperCase?.() ?? 'PAYMENT'} Method`
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {pm.card
                        ? `Expires ${pm.card.exp_month}/${pm.card.exp_year}`
                        : `Added ${formatMaybeUnix(pm.created)}`}
                    </div>
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
            <CardDescription>View and download your billing history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices.slice(0, 5).map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {formatAmountForDisplay(invoice.amount_paid || 0, invoice.currency)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatMaybeUnix(invoice.created)} • {invoice.status}
                      </div>
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
                        <a
                          href={invoice.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
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

      {!normalizedSub && (
        <div className="text-center">
          <Button asChild size="lg">
            <Link href="/dashboard/billing/plans">Choose a Plan</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default BillingPage;
