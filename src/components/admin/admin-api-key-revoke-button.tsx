'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AdminApiKeyRevokeButtonProps {
  apiKeyId: string
  status: string
  adminLevel: 'support' | 'super_admin'
}

export function AdminApiKeyRevokeButton({
  apiKeyId,
  status,
  adminLevel,
}: AdminApiKeyRevokeButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRevoked = status !== 'active'
  const isSuperAdmin = adminLevel === 'super_admin'

  if (!isSuperAdmin) {
    return null
  }

  const handleRevoke = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/api-keys/${apiKeyId}/revoke`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to revoke API key')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRevoke}
        disabled={isLoading || isRevoked}
      >
        {isRevoked ? 'Revoked' : isLoading ? 'Revoking…' : 'Revoke key'}
      </Button>
    </div>
  )
}
