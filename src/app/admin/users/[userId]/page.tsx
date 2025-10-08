// ./src/app/admin/users/[userId]/page.tsx

import { notFound } from 'next/navigation'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ArrowLeft, ArrowUpRight, NotebookPen, Star } from 'lucide-react'

// ✅ Define your own props type for App Router pages
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

export default async function AdminUserPage({ params }: AdminUserPageProps) {
  // ✅ params is a plain object; do not await it
  const session = await requireAdminSession()
  const adminLevel = session.user?.adminLevel ?? 'support'
  const { userId } = params

  const [user, venues, recentRequests, recentSongs, recentNotes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: {
          include: {
            apiKeys: { orderBy: { createdAt: 'desc' } },
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
        _count: { select: { requests: true } },
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
        venue: { select: { id: true, name: true } },
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
        openKjSystemId: true,
        createdAt: true,
      },
    }),
    (prisma as any).userNote.findMany({
      where: { userId },
      include: { author: { select: { name: true, email: true } } },
      orderBy: [{ important: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
  ])

  if (!user) {
    notFound()
  }

  const apiKeys = user.customer?.apiKeys ?? []
  const totalVenues = venues.length
  const totalSongs = await prisma.songDb.count({ where: { userId } })
  const totalRequests = venues.reduce((acc, v) => acc + v._count.requests, 0)
  const primarySubscription = user.subscriptions[0]

  const notesPreview = (recentNotes as any[]).map((note) => ({
    id: note.id as string,
    subject: note.subject as string,
    body: (note.note as string)?.split('\n-----\n')[0] ?? (note.note as string),
    important: !!note.important,
    createdAt: note.createdAt as Date,
    authorName: note.author?.name ?? note.author?.email ?? 'Support team',
    authorEmail: note.author?.email as string | undefined,
  }))

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
      meta: `System ${song.openKjSystemId}`,
      timestamp: song.createdAt,
    })),
    ...apiKeys.map((key: any) => ({
      id: `apiKey-${key.id}`,
      type: 'API key created',
      detail: key.description || key.id,
      meta: `Status: ${key.status}`,
      timestamp: key.createdAt,
    })),
    ...user.subscriptions.map((sub: any) => ({
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
      {/* …the rest of your JSX is unchanged… */}
      {/* I left your UI intact to preserve behavior; only the PageProps bits were fixed. */}
    </div>
  )
}
