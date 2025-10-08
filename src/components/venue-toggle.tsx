'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VenueToggleProps {
  venueId: string
  initialAccepting: boolean
  hasActiveSubscription: boolean
}

export function VenueToggle({ venueId, initialAccepting, hasActiveSubscription }: VenueToggleProps) {
  const [accepting, setAccepting] = useState(initialAccepting)
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()

  const handleToggle = async (checked: boolean) => {
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
        toast({
          title: checked ? 'Accepting requests enabled' : 'Accepting requests paused',
          description: checked
            ? 'Guests can now send new requests to this venue.'
            : 'Guests will no longer be able to submit new requests.',
        })
      } else {
        const data = await response.json().catch(() => ({}))
        const message = data.error || 'Unable to update accepting status'
        setAccepting(!checked)
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: message,
        })
      }
    } catch (error) {
      setAccepting(!checked)
      toast({
        variant: 'destructive',
        title: 'Network error',
        description: 'We could not update the venue status. Please try again.',
      })
    }

    setIsUpdating(false)
  }

  if (!hasActiveSubscription) {
    return (
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-2">
              <Switch checked={false} disabled />
              <span className="text-sm text-muted-foreground">Accepting</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-center">
            You must have an active subscription to accept requests for this or any venue in your account. Please check your
            subscription status.
          </TooltipContent>
        </Tooltip>
        <Button variant="outline" size="sm" className="text-xs" asChild>
          <a href="/dashboard/billing/plans">Manage billing</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={accepting}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
      />
      <span className="text-sm font-medium">
        {accepting ? 'Accepting' : 'Paused'}
      </span>
      {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  )
}