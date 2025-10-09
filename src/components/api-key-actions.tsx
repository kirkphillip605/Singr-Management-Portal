'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Trash2, Copy, CheckIcon, AlertTriangle } from 'lucide-react'

interface ApiKey {
  id: string
  description: string | null
  status: string
  createdAt: Date
  lastUsedAt: Date | null
}

interface ApiKeyActionsProps {
  apiKey: ApiKey
}

interface RollKeyResponse {
  id: string
  apiKey: string
  description: string
  status: string
  createdAt: string
}

export function ApiKeyActions({ apiKey }: ApiKeyActionsProps) {
  const [isRevoking, setIsRevoking] = useState(false)
  const [isRolling, setIsRolling] = useState(false)
  const [revokeConfirmation, setRevokeConfirmation] = useState('')
  const [rollConfirmation, setRollConfirmation] = useState('')
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [showRollDialog, setShowRollDialog] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const copyToClipboard = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const revokeApiKey = async () => {
    if (revokeConfirmation !== 'CONFIRM') return
    
    setIsRevoking(true)
    setError('')
    
    try {
      const response = await fetch(`/api/api-keys/${apiKey.id}/revoke`, {
        method: 'POST',
      })
      
      if (response.ok) {
        setShowRevokeDialog(false)
        router.refresh()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to revoke API key')
      }
    } catch (error) {
      setError('Failed to revoke API key')
    }
    setIsRevoking(false)
  }

  const rollApiKey = async () => {
    if (rollConfirmation !== 'CONFIRM') return
    
    setIsRolling(true)
    setError('')
    
    try {
      const response = await fetch(`/api/api-keys/${apiKey.id}/roll`, {
        method: 'POST',
      })
      
      if (response.ok) {
        const data: RollKeyResponse = await response.json()
        setNewApiKey(data.apiKey)
        setRollConfirmation('')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to roll API key')
      }
    } catch (error) {
      setError('Failed to roll API key')
    }
    setIsRolling(false)
  }

  const handleRollDialogClose = () => {
    setShowRollDialog(false)
    setNewApiKey(null)
    setCopied(false)
    setRollConfirmation('')
    setError('')
    if (newApiKey) {
      router.refresh()
    }
  }

  const isRevoked = apiKey.status === 'revoked'
  const isSuspended = apiKey.status === 'suspended'

  return (
    <div className="flex items-center space-x-2">
      {!isRevoked && (
        <>
          <Dialog open={showRollDialog} onOpenChange={setShowRollDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isSuspended}>
                <RefreshCw className="h-4 w-4" />
                Roll
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Roll API Key</DialogTitle>
                <DialogDescription className="space-y-3 text-sm">
                  <p>
                    Rolling this API key will permanently replace it with a new key. The old key will stop working immediately.
                  </p>
                  <p className="font-medium">
                    ⚠️ Any applications using the current key will stop working until you update them with the new key.
                  </p>
                  <p>
                    This action cannot be undone. Type <strong>CONFIRM</strong> to proceed.
                  </p>
                </DialogDescription>
              </DialogHeader>
              
              {!newApiKey ? (
                <>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="rollConfirmation">Type CONFIRM to proceed</Label>
                    <Input
                      id="rollConfirmation"
                      value={rollConfirmation}
                      onChange={(e) => setRollConfirmation(e.target.value)}
                      placeholder="CONFIRM"
                      disabled={isRolling}
                    />
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowRollDialog(false)} disabled={isRolling}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={rollApiKey}
                      disabled={rollConfirmation !== 'CONFIRM' || isRolling}
                    >
                      {isRolling ? 'Rolling...' : 'Roll Key'}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <CheckIcon className="h-4 w-4" />
                    <AlertDescription>
                      <strong>New API Key Generated!</strong> Copy this key now - you won't be able to see it again.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Your New API Key</Label>
                    <div className="flex space-x-2">
                      <Input
                        value={newApiKey}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        onClick={copyToClipboard}
                        variant="outline"
                        disabled={copied}
                      >
                        {copied ? <CheckIcon className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>This key cannot be displayed again.</strong> Make sure to copy and securely store it now.
                    </AlertDescription>
                  </Alert>

                  <DialogFooter>
                    <Button onClick={handleRollDialogClose} className="w-full">
                      Done
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isSuspended}>
                <Trash2 className="h-4 w-4 text-destructive" />
                Revoke
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Revoke API Key</DialogTitle>
                <DialogDescription className="space-y-3 text-sm">
                  <p>
                    Are you sure you want to permanently revoke this API key? This action cannot be undone.
                  </p>
                  <p className="font-medium">
                    ⚠️ Any applications using this key will immediately stop working.
                  </p>
                  <p>
                    Revoked keys cannot be restored. You'll need to create a new API key if you want to restore access.
                  </p>
                  <p>
                    Type <strong>CONFIRM</strong> to proceed with revocation.
                  </p>
                </DialogDescription>
              </DialogHeader>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="revokeConfirmation">Type CONFIRM to proceed</Label>
                <Input
                  id="revokeConfirmation"
                  value={revokeConfirmation}
                  onChange={(e) => setRevokeConfirmation(e.target.value)}
                  placeholder="CONFIRM"
                  disabled={isRevoking}
                />
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRevokeDialog(false)} disabled={isRevoking}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={revokeApiKey}
                  disabled={revokeConfirmation !== 'CONFIRM' || isRevoking}
                >
                  {isRevoking ? 'Revoking...' : 'Revoke Key'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}