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
import { VenueToggle } from '@/components/venue-toggle';
import { Plus, MapPin, Users, Clock } from 'lucide-react';
import Link from 'next/link';

/**
 * VenuesPage
 * Server Component rendered in the Node runtime.
 * - Auth-gates anonymous users to /auth/signin
 * - Lists user's venues and recent requests
 * - Checks for an active or trialing Stripe subscription
 *
 * NOTE: This file avoids invalid DOM nesting by:
 *   1) Using inline content inside <CardDescription> (p → span)
 *   2) Using <Button asChild> to render <a> via <Link> (no <a><button/></a>)
 */

export default async function VenuesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Fetch venues and a small slice of recent requests for each
  const venues = await prisma.venue.findMany({
    where: { userId: session.user.id },
    include: {
      requests: {
        take: 5,
        orderBy: {
          // Preserve existing logic as requested; ensure column exists in your schema
          requestTime: 'desc',
        },
      },
      _count: {
        select: {
          requests: true,
        },
      },
    },
  });

  // Check subscription status (active OR trialing)
  let hasActiveSubscription = false;
  const customer = await prisma.customer.findUnique({
    where: { id: session.user.id },
  });

  if (customer?.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.stripeCustomerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        const trialing = await stripe.subscriptions.list({
          customer: customer.stripeCustomerId,
          status: 'trialing',
          limit: 1,
        });
        hasActiveSubscription = trialing.data.length > 0;
      } else {
        hasActiveSubscription = true;
      }
    } catch (error) {
      // Proactive but non-failing: log and continue without blocking the page
      console.warn('Failed to check subscription status:', error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Venues</h1>
          <p className="text-muted-foreground">
            Manage your Singr karaoke venues and their settings
          </p>
        </div>

        {/* Use Button asChild to render a proper <a> for Link (no nested button) */}
        <Button asChild>
          <Link href="/dashboard/venues/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Venue
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {venues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No venues yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by adding your first karaoke venue
            </p>

            {/* Use asChild to avoid <a><button/></a> nesting */}
            <Button asChild>
              <Link href="/dashboard/venues/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Venue
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Grid of venues
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <Card key={venue.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{venue.name}</CardTitle>

                  {/* Toggle is a Client Component; keep API usage consistent */}
                  <VenueToggle
                    venueId={venue.id}
                    initialAccepting={venue.acceptingRequests}
                    hasActiveSubscription={hasActiveSubscription}
                  />
                </div>

                {/* CardDescription renders a <p>; use inline content (span) to avoid div-in-p */}
                <CardDescription>
                  {venue.address && (
                    <span className="inline-flex items-center text-sm text-muted-foreground">
                      <MapPin className="mr-1 h-3 w-3" />
                      {venue.city}, {venue.state}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm">
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{venue._count.requests} total requests</span>
                  </div>
                </div>

                {/* Recent requests */}
                {venue.requests.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Recent Requests</h4>
                    <div className="space-y-1">
                      {venue.requests.slice(0, 3).map((request) => (
                        <div
                          key={request.requestId?.toString?.() ?? `${request.artist}-${request.title}`}
                          className="text-xs text-muted-foreground"
                        >
                          <div className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            {request.artist} - {request.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions: render <a> via Button asChild to avoid invalid nesting */}
                <div className="flex gap-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/dashboard/venues/${venue.id}`} className="flex-1">
                      Manage
                    </Link>
                  </Button>

                  <Button className="w-full" asChild>
                    <Link href={`/dashboard/venues/${venue.id}/requests`} className="flex-1">
                      View Requests
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
