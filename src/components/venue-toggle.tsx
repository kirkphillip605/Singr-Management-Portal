'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface VenueToggleProps {
  venueId: string
  initialAccepting: boolean
  hasActiveSubscription: boolean
}

export function VenueToggle({ venueId, initialAccepting, hasActiveSubscription }: VenueToggleProps) {
  const [accepting, setAccepting] = useState(initialAccepting)
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const handleToggle = async (checked: boolean) => {
    // If trying to enable accepting without subscription, prevent it
    if (checked && !hasActiveSubscription) {
      return
    }

    setIsUpdating(true)
    
    try {
      const response = await fetch(`/api/venues/${venueId}/accepting`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accepting: checked }),
      })

      if (response.ok) {
        setAccepting(checked)
      } else {
        // Revert on error
        setAccepting(!checked)
      }
    } catch (error) {
      // Revert on error
      setAccepting(!checked)
    }
    
    setIsUpdating(false)
  }

  if (!hasActiveSubscription) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center space-x-2 opacity-50">
          <Switch checked={false} disabled />
          <span className="text-sm text-muted-foreground">Accepting</span>
        </div>
        <div className="text-center">
          <Alert className="p-2">
            <AlertTriangle className="h-3 w-3" />
            <AlertDescription className="text-xs">
              Valid subscription required
            </AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" className="mt-1" asChild>
            <a href="/dashboard/billing/plans">Reactivate</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch
        checked={accepting}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
      />
      <span className="text-sm font-medium">
        {accepting ? 'Accepting' : 'Paused'}
      </span>
    </div>
  )
}