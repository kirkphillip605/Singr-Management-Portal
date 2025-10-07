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
import { CreditCard, FileText, Download, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { formatAmountForDisplay } from '@/lib/format-currency';
import { logger } from '@/lib/logger';
import { CustomerPortalButton } from '@/components/customer-portal-button';

// ✅ Use shared helper to derive a friendly plan name from a live Stripe subscription
import { planLabelFromSubscription } from '@/lib/subscription-normalize';

/** Format UNIX seconds, Date, or ISO string to a locale date. */
function fmtDate(value: number | string | Date | null | undefined): string {
  if (value == null) return '—';
  if (typeof value === 'number') {
    const d = new Date(value * 1000); // Stripe UNIX seconds
    return Number.isNaN(d.valueOf()) ? '—' : d.toLocaleDateString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? '—' : value.toLocaleDateString();
  }
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? '—' : d.toLocaleDateString();
}

/** Optional chaining via path string. */
function get(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

/** Extract period {start,end} from Stripe subscription. */
function periodFromStripe(sub: any): { start?: number; end?: number } {
  if (!sub) return {};
  let start = typeof sub.current_period_start === 'number' ? sub.current_period_start : undefined;
  let end = typeof sub.current_period_end === 'number' ? sub.current_period_end : undefined;

  // Some mirrors/legacy payloads carry period on the first item
  if (start == null || end == null) {
    const itemStart = get(sub, 'items.data.0.current_period_start');
    const itemEnd = get(sub, 'items.data.0.current_period_end');
    if (typeof itemStart === 'number') start = itemStart;
    if (typeof itemEnd === 'number') end = itemEnd;
  }

  // Fallback start
  if (start == null && typeof sub.billing_cycle_anchor === 'number') {
    start = sub.billing_cycle_anchor;
  }
  return { start, end };
}

/** Extract trial {start,end} from Stripe subscription. */
function trialFromStripe(sub: any): { trialStart?: number; trialEnd?: number } {
  if (!sub) return {};
  let trialStart = typeof sub.trial_start === 'number' ? sub.trial_start : undefined;
  let trialEnd = typeof sub.trial_end === 'number' ? sub.trial_end : undefined;

  // Rarely present on items
  if (trialStart == null || trialEnd == null) {
    const itemTrialStart = get(sub, 'items.data.0.trial_start');
    const itemTrialEnd = get(sub, 'items.data.0.trial_end');
    if (typeof itemTrialStart === 'number') trialStart = itemTrialStart;
    if (typeof itemTrialEnd === 'number') trialEnd = itemTrialEnd;
  }
  return { trialStart, trialEnd };
}

/** Extract period {start,end} from DB subscription (Prisma model or JSON mirror). */
function periodFromDb(dbSub: any): { start?: Date | number; end?: Date | number } {
  if (!dbSub) return {};
  // Preferred: Prisma Date fields
  if (dbSub.currentPeriodStart || dbSub.currentPeriodEnd) {
    return { start: dbSub.currentPeriodStart, end: dbSub.currentPeriodEnd };
  }
  // Fallback: JSON string/object mirror
  try {
    const payload = typeof dbSub.data === 'string' ? JSON.parse(dbSub.data) : dbSub.data;
    let start =
      typeof payload?.current_period_start === 'number' ? payload.current_period_start : undefined;
    let end =
      typeof payload?.current_period_end === 'number' ? payload.current_period_end : undefined;

    if (start == null || end == null) {
      const itemStart = get(payload, 'items.data.0.current_period_start');
      const itemEnd = get(payload, 'items.data.0.current_period_end');
      if (typeof itemStart === 'number') start = itemStart;
      if (typeof itemEnd === 'number') end = itemEnd;
    }

    if (start == null && typeof payload?.start_date === 'number') {
      start = payload.start_date;
    }

    return { start, end };
  } catch {
    return {};
  }
}

/** Extract trial {start,end} from DB subscription (Prisma model or JSON mirror). */
function trialFromDb(dbSub: any): { trialStart?: Date | number; trialEnd?: Date | number } {
  if (!dbSub) return {};
  if (dbSub.trialStart || dbSub.trialEnd) {
    return { trialStart: dbSub.trialStart, trialEnd: dbSub.trialEnd };
  }
  try {
    const payload = typeof dbSub.data === 'string' ? JSON.parse(dbSub.data) : dbSub.data;
    let trialStart =
      typeof payload?.trial_start === 'number' ? payload.trial_start : undefined;
    let trialEnd = typeof payload?.trial_end === 'number' ? payload.trial_end : undefined;

    if (trialStart == null || trialEnd == null) {
      const itemTrialStart = get(payload, 'items.data.0.trial_start');
      const itemTrialEnd = get(payload, 'items.data.0.trial_end');
      if (typeof itemTrialStart === 'number') trialStart = itemTrialStart;
      if (typeof itemTrialEnd === 'number') trialEnd = itemTrialEnd;
    }

    return { trialStart, trialEnd };
  } catch {
    return {};
  }
}

async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { customer: true },
  });
  if (!user) redirect('/auth/signin');

  // Live Stripe
  let subscriptions: any[] = [];
  let paymentMethods: any[] = [];
  let invoices: any[] = [];

  if (user.customer?.stripeCustomerId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: user.customer.stripeCustomerId,
        status: 'all',
        limit: 10,
        // expand price so we can build a good "Plan" label
        expand: ['data.items.data.price'],
      });
      subscriptions = subs.data ?? [];

      const pms = await stripe.paymentMethods.list({
        customer: user.customer.stripeCustomerId,
        limit: 10,
      });
      paymentMethods = pms.data ?? [];

      const invs = await stripe.invoices.list({
        customer: user.customer.stripeCustomerId,
        limit: 10,
      });
      invoices = invs.data ?? [];
    } catch (err) {
      logger.error('Stripe fetch failed', err);
    }
  }

  // DB fallback
  const dbSub = await prisma.subscription.findFirst({
    where: { userId: user.id, status: { in: ['active', 'trialing'] } },
    orderBy: { created: 'desc' },
  });

  // Prefer live subscription if present
  const live = subscriptions.find((s) => s?.status === 'active' || s?.status === 'trialing');
  const planLabel = planLabelFromSubscription(live);

  type Normalized = {
    source: 'stripe' | 'db';
    status: string;
    cancelAtPeriodEnd: boolean;
    periodStart?: number | Date;
    periodEnd?: number | Date;
    trialStart?: number | Date;
    trialEnd?: number | Date;
  };

  let sub: Normalized | null = null;

  if (live) {
    const { start, end } = periodFromStripe(live);
    const { trialStart, trialEnd } = trialFromStripe(live);
    sub = {
      source: 'stripe',
      status: live.status,
      cancelAtPeriodEnd: !!live.cancel_at_period_end,
      periodStart: start,
      periodEnd: end,
      trialStart,
      trialEnd,
    };
  } else if (dbSub) {
    const { start, end } = periodFromDb(dbSub);
    const { trialStart, trialEnd } = trialFromDb(dbSub);
    sub = {
      source: 'db',
      status: dbSub.status,
      cancelAtPeriodEnd: !!dbSub.cancelAtPeriodEnd,
      periodStart: start,
      periodEnd: end,
      trialStart,
      trialEnd,
    };
  }

  const isTrial =
    sub?.status === 'trialing' || (sub?.trialStart != null && sub?.trialEnd != null);

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

      {/* Subscription */}
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
          {sub ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Singr Karaoke Connect</h3>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <span>Status:</span>
                    <Badge
                      variant={
                        sub.status === 'active'
                          ? 'default'
                          : sub.status === 'trialing'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {sub.status === 'trialing' ? 'Trial' : sub.status}
                    </Badge>
                    <span className="text-xs">
                      ({sub.source === 'stripe' ? 'live' : 'from DB'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Plan label (mirrors dashboard) */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Plan:</span>
                <span className="font-semibold">
                  {planLabel ??
                    (sub.status === 'active' || sub.status === 'trialing'
                      ? 'Singr Pro Plan'
                      : 'No Plan')}
                </span>
              </div>

              <div className="text-sm space-y-2">
                {isTrial && (
                  <div className="flex justify-between">
                    <span>Trial period:</span>
                    <span>
                      {fmtDate(sub.trialStart)} — {fmtDate(sub.trialEnd)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Current period:</span>
                  <span>
                    {fmtDate(sub.periodStart)} — {fmtDate(sub.periodEnd)}
                  </span>
                </div>
                {sub.cancelAtPeriodEnd && (
                  <div className="flex justify-between">
                    <span>Cancels on:</span>
                    <span>{fmtDate(sub.periodEnd)}</span>
                  </div>
                )}
              </div>

              <CustomerPortalButton />

              {sub.cancelAtPeriodEnd && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Your subscription will be cancelled at the end of the current billing period on{' '}
                    {fmtDate(sub.periodEnd)}.
                  </AlertDescription>
                </Alert>
              )}
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

      {/* Payment Methods */}
      {paymentMethods && paymentMethods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Your saved payment methods (managed through Stripe)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentMethods.slice(0, 3).map((pm: any) => (
                <div
                  key={pm.id}
                  className="flex items-center space-x-3 p-3 border rounded-md"
                >
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
                        : `Added ${fmtDate(pm.created)}`}
                    </div>
                  </div>
                </div>
              ))}
              <CustomerPortalButton variant="outline" text="Manage Payment Methods" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
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
                        {fmtDate(invoice.created)} • {invoice.status}
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

      {!sub && (
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
