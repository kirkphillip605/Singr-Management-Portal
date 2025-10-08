'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface AdminApiKeyGeneratorProps {
  userId: string
  adminLevel: 'support' | 'super_admin'
}

export function AdminApiKeyGenerator({ userId, adminLevel }: AdminApiKeyGeneratorProps) {
  const router = useRouter()
  const isSupport = adminLevel === 'support'
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const { toast } = useToast()

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setGeneratedKey(null)

    if (!description.trim()) {
      setError('Please provide a description for the new API key.')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch(`/api/admin/users/${userId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to generate API key')
      }

      const data = await response.json()
      setGeneratedKey(data.apiKey)
      setDescription('')
      toast({
        title: 'API key generated',
        description: 'Share the new key securely with the customer.',
      })
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate API key'
      setError(message)
      toast({
        variant: 'destructive',
        title: 'Unable to generate API key',
        description: message,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedKey) return

    try {
      await navigator.clipboard.writeText(generatedKey)
      setError(null)
      toast({
        title: 'Copied to clipboard',
        description: 'The API key value is ready to share.',
      })
    } catch (err) {
      const message = 'Unable to copy API key to clipboard'
      setError(message)
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: message,
      })
    }
  }

  return (
    <form onSubmit={handleGenerate} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-api-key-description">API Key Description</Label>
        <Input
          id="admin-api-key-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Production integration, Zapier, etc."
          disabled={isGenerating}
        />
      </div>

      <Button type="submit" disabled={isGenerating}>
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </span>
        ) : (
          'Generate new API key'
        )}
      </Button>

      {isSupport && (
        <Alert>
          <AlertDescription>
            Support admins can provision API keys but cannot revoke existing keys. Contact a super admin for lifecycle changes.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {generatedKey && (
        <Alert>
          <AlertDescription className="space-y-2">
            <div>
              API key generated successfully. This value will not be shown again—copy it now and share securely with the customer.
            </div>
            <div className="flex flex-col gap-2">
              <code className="rounded-md bg-muted px-3 py-2 text-sm break-words">{generatedKey}</code>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleCopy}>
                  Copy to clipboard
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </form>
  )
}
