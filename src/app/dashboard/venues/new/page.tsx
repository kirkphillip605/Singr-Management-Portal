import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { VenueSearchForm } from '@/components/venue-search-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MapPin, Info } from 'lucide-react'

export default async function NewVenuePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Venue</h1>
        <p className="text-muted-foreground">
          Search for your venue or add it manually to start receiving song requests
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          We'll help you find your venue automatically using location data. If we can't find it, you can add all the details manually.
        </AlertDescription>
      </Alert>

      <VenueSearchForm />
    </div>
  )
}