'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

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
  const { toast } = useToast()

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

      toast({
        title: 'API key revoked',
        description: 'The key can no longer be used for requests.',
      })
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke API key'
      setError(message)
      toast({
        variant: 'destructive',
        title: 'Unable to revoke key',
        description: message,
      })
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
        {isRevoked ? (
          'Revoked'
        ) : isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Revoking…
          </span>
        ) : (
          'Revoke key'
        )}
      </Button>
    </div>
  )
}
