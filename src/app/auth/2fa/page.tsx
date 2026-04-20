'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { twoFactor } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Method = 'totp' | 'otp' | 'backup'

export default function TwoFactorPage() {
  const router = useRouter()
  const [method, setMethod] = useState<Method>('totp')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  const handleSendOtp = async () => {
    setError('')
    const { error: err } = await twoFactor.sendOtp()
    if (err) {
      setError(err.message || 'Could not send code')
      return
    }
    setOtpSent(true)
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const result =
      method === 'totp'
        ? await twoFactor.verifyTotp({ code })
        : method === 'otp'
          ? await twoFactor.verifyOtp({ code })
          : await twoFactor.verifyBackupCode({ code })

    setIsLoading(false)
    if (result.error) {
      setError(result.error.message || 'Invalid code')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Verify your identity to finish signing in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={method === 'totp' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('totp')}
            >
              Authenticator
            </Button>
            <Button
              type="button"
              variant={method === 'otp' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('otp')}
            >
              Email / SMS
            </Button>
            <Button
              type="button"
              variant={method === 'backup' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('backup')}
            >
              Backup code
            </Button>
          </div>

          {method === 'otp' && !otpSent && (
            <Button type="button" onClick={handleSendOtp} className="w-full">
              Send me a code
            </Button>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
