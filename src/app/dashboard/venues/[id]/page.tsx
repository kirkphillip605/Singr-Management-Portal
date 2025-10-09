import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { VenueManagementForm } from '@/components/venue-management-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar } from 'lucide-react'
import Link from 'next/link'

type PageProps = {
  params: Promise<Record<string, string>>
  searchParams?: Promise<Record<string, string | string[]>>
}

export default async function VenueManagePage(props: PageProps) {
  const paramsResolved = await props.params

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const venue = await prisma.venue.findFirst({
    where: {
      id: paramsResolved['id'],
      userId: session.user.id,
    },
    include: {
      _count: {
        select: {
          requests: true,
        },
      },
    },
  })

  if (!venue) {
    redirect('/dashboard/venues')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{venue.name}</h1>
          <p className="text-muted-foreground">
            Manage venue settings and information
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/venues">
            <Button variant="outline">
              Back to Venues
            </Button>
          </Link>
        </div>
      </div>

      {/* Venue Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Venue Overview</CardTitle>
          <CardDescription>
            Read-only venue information
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Venue Name</h4>
              <p className="font-medium">{venue.name}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">URL Name</h4>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded">
                {venue.urlName}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
              <Badge variant={venue.acceptingRequests ? "default" : "secondary"}>
                {venue.acceptingRequests ? "Accepting Requests" : "Paused"}
              </Badge>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Total Requests</h4>
              <p className="font-medium">{venue._count.requests}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{venue.createdAt.toLocaleDateString()}</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Request URL</h4>
              <p className="text-sm font-mono bg-muted px-2 py-1 rounded break-all">
                {process.env.NEXTAUTH_URL || 'https://your-domain.com'}/venue/{venue.urlName}
              </p>
            </div>

            {venue.address && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Location</h4>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    {venue.address && <div>{venue.address}</div>}
                    <div>
                      {venue.city && venue.city}
                      {venue.city && venue.state && ', '}
                      {venue.state && venue.state}
                      {(venue.city || venue.state) && venue.postalCode && ' '}
                      {venue.postalCode && venue.postalCode}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editable Information */}
      <Card>
        <CardHeader>
          <CardTitle>Editable Information</CardTitle>
          <CardDescription>
            Update contact information and display settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VenueManagementForm venue={venue} />
        </CardContent>
      </Card>
    </div>
  )
}