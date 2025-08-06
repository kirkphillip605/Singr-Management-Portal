import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, MapPin, Users, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function VenuesPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const venues = await prisma.venue.findMany({
    where: { userId: session.user.id },
    include: {
      states: true,
      requests: {
        take: 5,
        orderBy: {
          requestTime: 'desc',
        },
      },
      _count: {
        select: {
          requests: true,
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Venues</h1>
          <p className="text-muted-foreground">
            Manage your Singr karaoke venues and their settings
          </p>
        </div>
        <Link href="/dashboard/venues/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Venue
          </Button>
        </Link>
      </div>

      {venues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No venues yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by adding your first karaoke venue
            </p>
            <Link href="/dashboard/venues/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Venue
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <Card key={venue.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {venue.name}
                  </CardTitle>
                  <Badge
                    variant={venue.acceptingRequests ? "default" : "secondary"}
                  >
                    {venue.acceptingRequests ? "Accepting" : "Paused"}
                  </Badge>
                </div>
                <CardDescription>
                  {venue.address && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="mr-1 h-3 w-3" />
                      {venue.city}, {venue.state}
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm">
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{venue._count.requests} total requests</span>
                  </div>
                </div>

                {venue.requests.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Recent Requests</h4>
                    <div className="space-y-1">
                      {venue.requests.slice(0, 3).map((request) => (
                        <div key={request.requestId.toString()} className="text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            {request.artist} - {request.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Link href={`/dashboard/venues/${venue.id}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      Manage
                    </Button>
                  </Link>
                  <Link href={`/dashboard/venues/${venue.id}/requests`} className="flex-1">
                    <Button className="w-full">
                      View Requests
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}