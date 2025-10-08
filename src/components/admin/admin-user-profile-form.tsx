'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { formatUSPhoneInput, isCompleteUSPhone } from '@/lib/phone'

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
  const { toast } = useToast()

  const [formState, setFormState] = useState({
    name: name || '',
    businessName: businessName || '',
    phoneNumber: phoneNumber ? formatUSPhoneInput(phoneNumber) : '',
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

    if (formState.phoneNumber && !isCompleteUSPhone(formState.phoneNumber)) {
      setError('Phone number must include 10 digits (US format) or be blank')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        ...formState,
        phoneNumber: formState.phoneNumber || null,
      }

      const response = await fetch(`/api/admin/users/${userId}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update profile')
      }

      setSuccess('Customer profile updated successfully')
      toast({
        title: 'Profile updated',
        description: 'Customer profile changes have been saved.',
      })
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile'
      setError(message)
      toast({
        variant: 'destructive',
        title: 'Unable to update profile',
        description: message,
      })
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
          onChange={(event) => handleChange('phoneNumber', formatUSPhoneInput(event.target.value))}
          disabled={isReadOnly || isSaving}
        />
      </div>

      <Button type="submit" disabled={isReadOnly || isSaving}>
        {isSaving ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </span>
        ) : (
          'Save profile changes'
        )}
      </Button>
    </form>
  )
}
