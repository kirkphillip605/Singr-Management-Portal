'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AdminUserProfileFormProps {
  userId: string
  name?: string | null
  businessName?: string | null
  phoneNumber?: string | null
  adminLevel: 'support' | 'super_admin'
}

export function AdminUserProfileForm({
  userId,
  name,
  businessName,
  phoneNumber,
  adminLevel,
}: AdminUserProfileFormProps) {
  const router = useRouter()
  const isReadOnly = adminLevel !== 'super_admin'

  const [formState, setFormState] = useState({
    name: name || '',
    businessName: businessName || '',
    phoneNumber: phoneNumber || '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChange = (field: keyof typeof formState, value: string) => {
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
      const response = await fetch(`/api/admin/users/${userId}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formState),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update profile')
      }

      setSuccess('Customer profile updated successfully')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isReadOnly && (
        <Alert>
          <AlertDescription>
            Support admins can review profile information. Editing profile details requires a super admin.
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

      <div className="space-y-2">
        <Label htmlFor="admin-customer-name">Customer Name</Label>
        <Input
          id="admin-customer-name"
          value={formState.name}
          onChange={(event) => handleChange('name', event.target.value)}
          disabled={isReadOnly || isSaving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-customer-business">Business Name</Label>
        <Input
          id="admin-customer-business"
          value={formState.businessName}
          onChange={(event) => handleChange('businessName', event.target.value)}
          disabled={isReadOnly || isSaving}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-customer-phone">Phone Number</Label>
        <Input
          id="admin-customer-phone"
          value={formState.phoneNumber}
          onChange={(event) => handleChange('phoneNumber', event.target.value)}
          disabled={isReadOnly || isSaving}
        />
      </div>

      <Button type="submit" disabled={isReadOnly || isSaving}>
        {isSaving ? 'Saving...' : 'Save profile changes'}
      </Button>
    </form>
  )
}
