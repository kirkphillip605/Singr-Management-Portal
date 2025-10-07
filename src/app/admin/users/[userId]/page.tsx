import { notFound } from 'next/navigation'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminUserProfileForm } from '@/components/admin/admin-user-profile-form'
import { AdminCreateVenueForm } from '@/components/admin/admin-create-venue-form'
import { AdminVenueEditor } from '@/components/admin/admin-venue-editor'
import { AdminApiKeyGenerator } from '@/components/admin/admin-api-key-generator'
import { AdminApiKeyRevokeButton } from '@/components/admin/admin-api-key-revoke-button'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageProps } from 'next';

interface AdminUserPageProps {
  params: { userId: string }
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

type ActivityItem = {
  id: string
  type: string
  detail: string
  meta?: string
  timestamp: Date
}

export default async function AdminUserPage(props: PageProps<'/admin/users/[userId]'>) {
  const paramsResolved = await props.params

  const session = await requireAdminSession()
  const adminLevel = session.user?.adminLevel ?? 'support'
  const { userId } = paramsResolved

  const [user, venues, recentRequests, recentSongs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: {
          include: {
            apiKeys: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        subscriptions: {
          orderBy: { created: 'desc' },
          take: 3,
        },
      },
    }),
    prisma.venue.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        urlName: true,
        acceptingRequests: true,
        address: true,
        city: true,
        state: true,
        stateCode: true,
        postalCode: true,
        phoneNumber: true,
        website: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            requests: true,
          },
        },
      },
    }),
    prisma.request.findMany({
      where: { venue: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        requestId: true,
        artist: true,
        title: true,
        singer: true,
        createdAt: true,
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.songDb.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        songId: true,
        artist: true,
        title: true,
        systemId: true,
        createdAt: true,
      },
    }),
  ])

  if (!user) {
    notFound()
  }

  const apiKeys = user.customer?.apiKeys ?? []
  const totalVenues = venues.length
  const totalSongs = await prisma.songDb.count({ where: { userId } })
  const totalRequests = venues.reduce((acc, venue) => acc + venue._count.requests, 0)
  const primarySubscription = user.subscriptions[0]

  const activityItems: ActivityItem[] = [
    ...venues.map((venue) => ({
      id: `venue-${venue.id}`,
      type: 'Venue created',
      detail: venue.name,
      meta: [venue.city, venue.state].filter(Boolean).join(', ') || undefined,
      timestamp: venue.createdAt,
    })),
    ...recentRequests.map((request) => ({
      id: `request-${request.requestId.toString()}`,
      type: 'Song request',
      detail: `${request.artist} – ${request.title}`,
      meta: request.venue?.name
        ? `Venue: ${request.venue.name}${request.singer ? ` • Singer: ${request.singer}` : ''}`
        : request.singer
        ? `Singer: ${request.singer}`
        : undefined,
      timestamp: request.createdAt,
    })),
    ...recentSongs.slice(0, 20).map((song) => ({
      id: `song-${song.songId.toString()}`,
      type: 'Catalog update',
      detail: `${song.artist} – ${song.title}`,
      meta: `System ${song.systemId}`,
      timestamp: song.createdAt,
    })),
    ...apiKeys.map((key) => ({
      id: `apiKey-${key.id}`,
      type: 'API key created',
      detail: key.description || key.id,
      meta: `Status: ${key.status}`,
      timestamp: key.createdAt,
    })),
    ...user.subscriptions.map((sub) => ({
      id: `subscription-${sub.id}`,
      type: 'Subscription',
      detail: `${sub.status}`,
      meta: `Current period ${sub.currentPeriodStart.toLocaleDateString()} – ${sub.currentPeriodEnd.toLocaleDateString()}`,
      timestamp: sub.created,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 40)

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{user.name || user.email}</h1>
            <Badge variant="secondary">{primarySubscription?.status ?? 'no subscription'}</Badge>
          </div>
          <p className="text-muted-foreground">Customer since {user.createdAt.toLocaleDateString()}</p>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>Email: {user.email}</span>
            {user.businessName && <span>Business: {user.businessName}</span>}
            {user.phoneNumber && <span>Phone: {user.phoneNumber}</span>}
          </div>
        </div>
        <Card className="min-w-[260px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Account Snapshot
            </CardTitle>
            <CardDescription>Key metrics for this customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Venues</span>
              <span className="font-semibold">{formatCount(totalVenues)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Songs in catalog</span>
              <span className="font-semibold">{formatCount(totalSongs)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total requests</span>
              <span className="font-semibold">{formatCount(totalRequests)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API keys</span>
              <span className="font-semibold">{formatCount(apiKeys.length)}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="#profile" className="group">
          <Card className="border-dashed group-hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Identity, business, and contact information</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="#venues" className="group">
          <Card className="border-dashed group-hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle>Venues</CardTitle>
              <CardDescription>Manage {totalVenues} active location(s)</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="#api-keys" className="group">
          <Card className="border-dashed group-hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Create and review integration credentials</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="#activity" className="group">
          <Card className="border-dashed group-hover:border-primary transition-colors">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Latest requests, venues, and catalog updates</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>

      <section id="profile" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer profile</CardTitle>
            <CardDescription>Update customer-facing details and contact information.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUserProfileForm
              userId={userId}
              name={user.name}
              businessName={user.businessName}
              phoneNumber={user.phoneNumber}
              adminLevel={adminLevel}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Account assistance</CardTitle>
            <CardDescription>Tools to support the customer quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Password reset links and session impersonation are not yet available in the shared database. We recommend logging a
                follow-up task to introduce secure reset tokens.
              </AlertDescription>
            </Alert>
            <Button variant="outline" disabled>
              Generate password reset link (coming soon)
            </Button>
          </CardContent>
        </Card>
      </section>

      <section id="venues" className="space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Venues</h2>
          <p className="text-muted-foreground">
            Create venues on behalf of the customer and make adjustments to existing locations.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create a new venue</CardTitle>
            <CardDescription>Provision a new location that is linked to this customer account.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminCreateVenueForm userId={userId} adminLevel={adminLevel} />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {venues.map((venue) => (
            <Card key={venue.id}>
              <CardHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <CardTitle>{venue.name}</CardTitle>
                  <Badge variant={venue.acceptingRequests ? 'default' : 'outline'}>
                    {venue.acceptingRequests ? 'Accepting requests' : 'Paused'}
                  </Badge>
                </div>
                <CardDescription>
                  Opened {formatDistanceToNow(venue.createdAt, { addSuffix: true })} • {venue._count.requests} total requests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AdminVenueEditor venue={venue} adminLevel={adminLevel} />
              </CardContent>
            </Card>
          ))}
          {venues.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No venues created yet. Use the form above to add their first location.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section id="api-keys" className="space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">API keys</h2>
          <p className="text-muted-foreground">
            Generate new keys and review the history of integrations tied to this customer.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Generate a new API key</CardTitle>
            <CardDescription>Create keys on behalf of the customer and share securely.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminApiKeyGenerator userId={userId} adminLevel={adminLevel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing keys</CardTitle>
            <CardDescription>Active and historical keys linked to this account.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Created</th>
                  <th className="px-4 py-2">Last used</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-4 py-2 font-medium">{key.description || '—'}</td>
                    <td className="px-4 py-2">
                      <Badge variant={key.status === 'active' ? 'default' : 'outline'}>{key.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {key.createdAt.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {key.lastUsedAt ? key.lastUsedAt.toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-2">
                      <AdminApiKeyRevokeButton
                        apiKeyId={key.id}
                        status={key.status}
                        adminLevel={adminLevel}
                      />
                    </td>
                  </tr>
                ))}
                {apiKeys.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No API keys have been generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section id="requests" className="space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Recent requests</h2>
          <p className="text-muted-foreground">
            The latest 25 requests submitted across all venues for this account.
          </p>
        </div>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Song</th>
                  <th className="px-4 py-2">Venue</th>
                  <th className="px-4 py-2">Singer</th>
                  <th className="px-4 py-2">Requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentRequests.map((request) => (
                  <tr key={request.requestId.toString()}>
                    <td className="px-4 py-2 font-medium">
                      {request.artist} – {request.title}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {request.venue?.name || '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{request.singer || '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDistanceToNow(request.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
                {recentRequests.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No requests recorded for this account yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section id="songs" className="space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Song catalog</h2>
          <p className="text-muted-foreground">
            A rolling log of the 50 most recent songs added to the customer library.
          </p>
        </div>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Song</th>
                  <th className="px-4 py-2">System</th>
                  <th className="px-4 py-2">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentSongs.map((song) => (
                  <tr key={song.songId.toString()}>
                    <td className="px-4 py-2 font-medium">
                      {song.artist} – {song.title}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{song.systemId}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDistanceToNow(song.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
                {recentSongs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      No songs have been imported into this account yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section id="activity" className="space-y-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Activity timeline</h2>
          <p className="text-muted-foreground">
            Combined operational log of venue creation, catalog updates, API key issuance, and requests.
          </p>
        </div>
        <Card>
          <CardContent className="space-y-4">
            {activityItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1 rounded-md border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="uppercase tracking-wide text-xs">
                      {item.type}
                    </Badge>
                    <span className="font-medium">{item.detail}</span>
                  </div>
                  {item.meta && <p className="text-sm text-muted-foreground">{item.meta}</p>}
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                </span>
              </div>
            ))}
            {activityItems.length === 0 && (
              <p className="text-center text-muted-foreground">No tracked activity for this account yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
