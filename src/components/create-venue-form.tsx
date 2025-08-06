'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { z } from 'zod'

const venueSchema = z.object({
  name: z.string().min(1, 'Venue name is required'),
  displayName: z.string().optional(),
  urlName: z.string().min(1, 'URL name is required').regex(/^[a-z0-9-]+$/, 'URL name can only contain lowercase letters, numbers, and hyphens'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  acceptingRequests: z.boolean().default(true),
})

export function CreateVenueForm() {
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    urlName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    acceptingRequests: true,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const generateUrlName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      urlName: prev.urlName || generateUrlName(name)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const validatedData = venueSchema.parse(formData)

      const response = await fetch('/api/venues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create venue')
      }

      router.push('/dashboard/venues')
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.errors[0].message)
      } else {
        setError(error instanceof Error ? error.message : 'An error occurred')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Venue Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., The Singing Spot"
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            placeholder="e.g., Main Location (optional)"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="urlName">URL Name *</Label>
        <Input
          id="urlName"
          value={formData.urlName}
          onChange={(e) => setFormData(prev => ({ ...prev, urlName: e.target.value }))}
          placeholder="e.g., singing-spot"
          required
          disabled={isLoading}
        />
        <p className="text-sm text-muted-foreground">
          This will be used in the request URL: /venue/{formData.urlName || 'your-url-name'}
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Address (Optional)</h3>
        
        <div className="space-y-2">
          <Label htmlFor="address">Street Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="123 Main Street"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              placeholder="Anytown"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State/Province</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
              placeholder="CA"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal Code</Label>
            <Input
              id="postalCode"
              value={formData.postalCode}
              onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
              placeholder="90210"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="acceptingRequests"
          checked={formData.acceptingRequests}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptingRequests: checked }))}
          disabled={isLoading}
        />
        <Label htmlFor="acceptingRequests">Accept song requests immediately</Label>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Creating...' : 'Create Venue'}
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => router.push('/dashboard/venues')}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}