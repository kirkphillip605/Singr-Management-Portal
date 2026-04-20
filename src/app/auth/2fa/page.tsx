'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { twoFactor } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { OtpInput } from '@/components/otp-input'

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

  const verify = async (codeValue: string) => {
    setIsLoading(true)
    setError('')
    const result =
      method === 'totp'
        ? await twoFactor.verifyTotp({ code: codeValue })
        : method === 'otp'
          ? await twoFactor.verifyOtp({ code: codeValue })
          : await twoFactor.verifyBackupCode({ code: codeValue })
    setIsLoading(false)
    if (result.error) {
      setError(result.error.message || 'Invalid code')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    await verify(code)
  }

  const useBoxes = method === 'totp' || method === 'otp'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
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
              onClick={() => {
                setMethod('totp')
                setCode('')
              }}
            >
              Authenticator
            </Button>
            <Button
              type="button"
              variant={method === 'otp' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setMethod('otp')
                setCode('')
              }}
            >
              Email / SMS
            </Button>
            <Button
              type="button"
              variant={method === 'backup' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setMethod('backup')
                setCode('')
              }}
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
              <Label htmlFor="code">
                {method === 'backup' ? 'Backup code' : '6-digit code'}
              </Label>
              {useBoxes ? (
                <OtpInput
                  id="code"
                  value={code}
                  onChange={setCode}
                  onComplete={(c) => verify(c)}
                  disabled={isLoading}
                  autoFocus
                />
              ) : (
                <IconInput
                  id="code"
                  icon={KeyRound}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoComplete="one-time-code"
                  disabled={isLoading}
                />
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                (useBoxes ? code.length < 6 : code.length === 0)
              }
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </Button>
          </form>

          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Protected by two-factor
            authentication
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
