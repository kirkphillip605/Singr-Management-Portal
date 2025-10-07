'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'

interface AdminVenueEditorProps {
  venue: {
    id: string
    name: string
    urlName: string
    acceptingRequests: boolean
    address?: string | null
    city?: string | null
    state?: string | null
    stateCode?: string | null
    postalCode?: string | null
    phoneNumber?: string | null
    website?: string | null
    createdAt: Date
    updatedAt: Date
  }
  adminLevel: 'support' | 'super_admin'
}

export function AdminVenueEditor({ venue, adminLevel }: AdminVenueEditorProps) {
  const router = useRouter()
  const isReadOnly = adminLevel !== 'super_admin'

  const [formState, setFormState] = useState({
    name: venue.name,
    address: venue.address || '',
    city: venue.city || '',
    state: venue.state || '',
    stateCode: venue.stateCode || '',
    postalCode: venue.postalCode || '',
    phoneNumber: venue.phoneNumber || '',
    website: venue.website || '',
    acceptingRequests: venue.acceptingRequests,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChange = (field: string, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (isReadOnly) return

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/venues/${venue.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formState),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update venue')
      }

      setSuccess('Venue details updated successfully')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update venue')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (isReadOnly) return

    const confirmation = window.confirm(
      'Are you sure you want to permanently delete this venue? This action cannot be undone.'
    )

    if (!confirmation) {
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/venues/${venue.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete venue')
      }

      setSuccess('Venue deleted')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete venue')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {isReadOnly && (
        <Alert>
          <AlertDescription>
            Support-level admins can review venue details but only super admins can modify them.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`venue-name-${venue.id}`}>Display Name</Label>
          <Input
            id={`venue-name-${venue.id}`}
            value={formState.name}
            onChange={(event) => handleChange('name', event.target.value)}
            disabled={isReadOnly || isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`venue-phone-${venue.id}`}>Phone</Label>
          <Input
            id={`venue-phone-${venue.id}`}
            value={formState.phoneNumber}
            onChange={(event) => handleChange('phoneNumber', event.target.value)}
            disabled={isReadOnly || isSaving}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`venue-address-${venue.id}`}>Address</Label>
        <Input
          id={`venue-address-${venue.id}`}
          value={formState.address}
          onChange={(event) => handleChange('address', event.target.value)}
          disabled={isReadOnly || isSaving}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`venue-city-${venue.id}`}>City</Label>
          <Input
            id={`venue-city-${venue.id}`}
            value={formState.city}
            onChange={(event) => handleChange('city', event.target.value)}
            disabled={isReadOnly || isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`venue-state-${venue.id}`}>State</Label>
          <Input
            id={`venue-state-${venue.id}`}
            value={formState.state}
            onChange={(event) => handleChange('state', event.target.value)}
            disabled={isReadOnly || isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`venue-postal-${venue.id}`}>Postal Code</Label>
          <Input
            id={`venue-postal-${venue.id}`}
            value={formState.postalCode}
            onChange={(event) => handleChange('postalCode', event.target.value)}
            disabled={isReadOnly || isSaving}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`venue-website-${venue.id}`}>Website</Label>
        <Input
          id={`venue-website-${venue.id}`}
          value={formState.website}
          onChange={(event) => handleChange('website', event.target.value)}
          disabled={isReadOnly || isSaving}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label className="text-sm font-medium">Accepting Requests</Label>
          <p className="text-xs text-muted-foreground">
            Toggle whether this venue is currently collecting song requests.
          </p>
        </div>
        <Switch
          checked={formState.acceptingRequests}
          onCheckedChange={(checked) => handleChange('acceptingRequests', checked)}
          disabled={isReadOnly || isSaving}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isReadOnly || isSaving}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isReadOnly || isSaving}
        >
          Delete venue
        </Button>
      </div>
    </form>
  )
}
