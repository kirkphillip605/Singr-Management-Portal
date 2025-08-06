import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'
import { CreateVenueForm } from '@/components/create-venue-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MapPin, Info } from 'lucide-react'

export default async function NewVenuePage() {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Venue</h1>
        <p className="text-muted-foreground">
          Create a new karaoke venue to start receiving song requests
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Each venue will have its own request queue and can be managed independently. 
          You can customize the display name and URL for each venue.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Venue Information
          </CardTitle>
          <CardDescription>
            Enter the details for your new karaoke venue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateVenueForm />
        </CardContent>
      </Card>
    </div>
  )
}