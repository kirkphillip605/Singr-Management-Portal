import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Music, Clock, User, MapPin, Trash2, CheckCircle, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function RequestsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const requests = await prisma.request.findMany({
    where: {
      venue: {
        userId: session.user.id,
      },
    },
    include: {
      venue: true,
    },
    orderBy: {
      requestTime: 'desc',
    },
    take: 50,
  })

  const totalRequests = await prisma.request.count({
    where: {
      venue: {
        userId: session.user.id,
      },
    },
  })

  const venues = await prisma.venue.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: {
          requests: true,
        },
      },
    },
  })

  const recentRequests = requests.slice(0, 10)
  const todayRequests = requests.filter(req => 
    new Date(req.requestTime).toDateString() === new Date().toDateString()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Song Requests</h1>
          <p className="text-muted-foreground">
            Manage incoming karaoke song requests from all your venues
          </p>
        </div>
        <Button>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayRequests.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Venues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {venues.filter(v => v.acceptingRequests).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Queue Length</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentRequests.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Venue Status */}
      <Card>
        <CardHeader>
          <CardTitle>Venue Status</CardTitle>
          <CardDescription>Request acceptance status for all venues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((venue) => (
              <div key={venue.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center space-x-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{venue.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {venue._count.requests} requests
                    </p>
                  </div>
                </div>
                <Badge
                  variant={venue.acceptingRequests ? "default" : "secondary"}
                >
                  {venue.acceptingRequests ? "Accepting" : "Paused"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {totalRequests === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No song requests yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Song requests will appear here when singers submit them through your venue links
            </p>
            <Alert className="max-w-md">
              <AlertDescription>
                Share your venue URLs with customers so they can submit song requests directly to your queue.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>
              Latest song requests from all venues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRequests.map((request) => (
                <div key={request.requestId.toString()} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-start space-x-4">
                    <Music className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{request.artist} - {request.title}</p>
                        {request.keyChange !== 0 && (
                          <Badge variant="outline" className="text-xs">
                            Key {request.keyChange > 0 ? '+' : ''}{request.keyChange}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {request.singer || 'Anonymous'}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {request.venue.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(request.requestTime), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {totalRequests > recentRequests.length && (
              <div className="text-center mt-6">
                <Button variant="outline">
                  Load More Requests
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}