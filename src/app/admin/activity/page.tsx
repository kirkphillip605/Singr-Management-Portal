import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

export default async function AdminActivityPage() {
  await requireAdminSession()

  type ActivityItem = {
    id: string
    type: string
    detail: string
    account?: string | null
    meta?: string
    timestamp: Date
  }

  const [venues, requests, apiKeys, songs] = await Promise.all([
    prisma.venue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.request.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
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
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        description: true,
        status: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.songDb.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        songId: true,
        artist: true,
        title: true,
        openKjSystemId: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
  ])

  const activity: ActivityItem[] = [
    ...venues.map((venue) => ({
      id: `venue-${venue.id}`,
      type: 'Venue created',
      detail: venue.name,
      account: venue.user.name || venue.user.email,
      meta: undefined,
      timestamp: venue.createdAt,
    })),
    ...requests.map((request) => ({
      id: `request-${request.requestId.toString()}`,
      type: 'Song request',
      detail: `${request.artist} – ${request.title}`,
      account: request.venue?.user?.name || request.venue?.user?.email,
      meta: request.venue?.name,
      timestamp: request.createdAt,
    })),
    ...apiKeys.map((key) => ({
      id: `apikey-${key.id}`,
      type: 'API key',
      detail: key.description || key.id,
      account: key.customer.user?.name || key.customer.user?.email,
      meta: key.status,
      timestamp: key.createdAt,
    })),
    ...songs.map((song) => ({
      id: `song-${song.songId.toString()}`,
      type: 'Catalog update',
      detail: `${song.artist} – ${song.title}`,
      account: song.user.name || song.user.email,
      meta: `System ${song.openKjSystemId}`,
      timestamp: song.createdAt,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 80)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Global activity</h1>
        <p className="text-muted-foreground">
          Unified timeline of customer changes across venues, requests, catalog updates, and integrations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardDescription>Most recent 80 events across all accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activity.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-md border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="uppercase tracking-wide text-xs">
                    {item.type}
                  </Badge>
                  <span className="font-medium">{item.detail}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Account: {item.account || 'Unknown'}
                  {item.meta ? ` • ${item.meta}` : ''}
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
              </span>
            </div>
          ))}
          {activity.length === 0 && (
            <p className="text-center text-muted-foreground">No recent activity recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
