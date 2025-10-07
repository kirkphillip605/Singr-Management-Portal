'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'

interface AdminCreateVenueFormProps {
  userId: string
  adminLevel: 'support' | 'super_admin'
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

export function AdminCreateVenueForm({ userId, adminLevel }: AdminCreateVenueFormProps) {
  const router = useRouter()
  const isSupport = adminLevel === 'support'
  const [formState, setFormState] = useState({
    name: '',
    urlName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    countryCode: 'US',
    phoneNumber: '',
    website: '',
    acceptingRequests: true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChange = (field: string, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formState.name.trim() || !formState.urlName.trim()) {
      setError('Name and URL name are required')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/admin/users/${userId}/venues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formState.name,
          urlName: formState.urlName,
          address: formState.address || undefined,
          city: formState.city || undefined,
          state: formState.state || undefined,
          postalCode: formState.postalCode || undefined,
          country: formState.countryCode || 'US',
          countryCode: formState.countryCode || 'US',
          phoneNumber: formState.phoneNumber || undefined,
          website: formState.website || undefined,
          acceptingRequests: formState.acceptingRequests,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create venue')
      }

      const data = await response.json()
      setSuccess(`Venue ${data.name} created successfully`)
      setFormState((prev) => ({
        ...prev,
        name: '',
        urlName: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        phoneNumber: '',
        website: '',
        acceptingRequests: true,
      }))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create venue')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isSupport && (
        <Alert>
          <AlertDescription>
            Support admins can create venues for customers. Any changes to existing venues must be escalated to a super admin.
          </AlertDescription>
        </Alert>
      )}

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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="admin-new-venue-name">Venue Name</Label>
          <Input
            id="admin-new-venue-name"
            value={formState.name}
            onChange={(event) => {
              const name = event.target.value
              handleChange('name', name)
              if (!formState.urlName || formState.urlName === toSlug(formState.name)) {
                handleChange('urlName', toSlug(name))
              }
            }}
            placeholder="Singr Lounge Downtown"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-new-venue-url">URL Name</Label>
          <Input
            id="admin-new-venue-url"
            value={formState.urlName}
            onChange={(event) => handleChange('urlName', toSlug(event.target.value))}
            placeholder="singr-lounge-downtown"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-new-venue-address">Address</Label>
        <Input
          id="admin-new-venue-address"
          value={formState.address}
          onChange={(event) => handleChange('address', event.target.value)}
          placeholder="123 Main Street"
          disabled={isSubmitting}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="admin-new-venue-city">City</Label>
          <Input
            id="admin-new-venue-city"
            value={formState.city}
            onChange={(event) => handleChange('city', event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-new-venue-state">State</Label>
          <Input
            id="admin-new-venue-state"
            value={formState.state}
            onChange={(event) => handleChange('state', event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-new-venue-postal">Postal Code</Label>
          <Input
            id="admin-new-venue-postal"
            value={formState.postalCode}
            onChange={(event) => handleChange('postalCode', event.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="admin-new-venue-phone">Phone</Label>
          <Input
            id="admin-new-venue-phone"
            value={formState.phoneNumber}
            onChange={(event) => handleChange('phoneNumber', event.target.value)}
            placeholder="+1 (555) 123-4567"
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-new-venue-website">Website</Label>
          <Input
            id="admin-new-venue-website"
            value={formState.website}
            onChange={(event) => handleChange('website', event.target.value)}
            placeholder="https://example.com"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label className="text-sm font-medium">Accepting Requests</Label>
          <p className="text-xs text-muted-foreground">
            New venues default to accepting requests. Toggle off for closed locations.
          </p>
        </div>
        <Switch
          checked={formState.acceptingRequests}
          onCheckedChange={(checked) => handleChange('acceptingRequests', checked)}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating venue...' : 'Create venue'}
      </Button>
    </form>
  )
}
