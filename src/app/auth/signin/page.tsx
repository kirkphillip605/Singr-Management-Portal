'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock } from 'lucide-react'
import {
  signIn,
  useSession,
  phoneNumber as phoneClient,
} from '@/lib/auth-client'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PhoneInput, toE164US } from '@/components/phone-input'
import { OtpInput } from '@/components/otp-input'
import { PolicyDialog } from '@/components/legal-policy-dialog'

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInForm />
    </Suspense>
  )
}

function SignInLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function SignInForm() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneStage, setPhoneStage] = useState<'idle' | 'sent'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isPending) return
    if (session?.user) {
      router.push(callbackUrl)
    }
  }, [session, isPending, router, callbackUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address')
      return
    }
    setIsLoading(true)
    setError('')

    const { error: signInError } = await signIn.email({
      email: cleanEmail,
      password,
      callbackURL: callbackUrl,
    })

    setIsLoading(false)
    if (signInError) {
      setError(signInError.message || 'Invalid credentials')
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  const handleSendPhoneOtp = async () => {
    setError('')
    const e164 = toE164US(phone)
    if (!e164) {
      setError('Please enter a valid US/CA phone number')
      return
    }
    setIsLoading(true)
    const { error: err } = await phoneClient.sendOtp({ phoneNumber: e164 })
    setIsLoading(false)
    if (err) {
      setError(err.message || 'Could not send verification code')
      return
    }
    setPhoneStage('sent')
  }

  const handleVerifyPhoneOtp = async (codeOverride?: string) => {
    setError('')
    const e164 = toE164US(phone)
    if (!e164) {
      setError('Please enter a valid US/CA phone number')
      return
    }
    setIsLoading(true)
    const { error: err } = await phoneClient.verify({
      phoneNumber: e164,
      code: codeOverride ?? phoneCode,
    })
    setIsLoading(false)
    if (err) {
      setError(err.message || 'Invalid verification code')
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  const handleGoogleSignIn = async () => {
    await signIn.social({
      provider: 'google',
      callbackURL: callbackUrl,
    })
  }

  const isGoogleOAuthEnabled = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  if (isPending) {
    return <SignInLoading />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/singr-logo-color.png"
              alt="Singr Karaoke"
              className="h-18 w-auto"
            />
          </div>
          <hr />
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Welcome back to Singr Karaoke Connect
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <Tabs defaultValue="email" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <IconInput
                    id="email"
                    type="email"
                    icon={Mail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <IconInput
                    id="password"
                    type="password"
                    icon={Lock}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <PhoneInput
                  id="phone"
                  value={phone}
                  onChange={(formatted) => setPhone(formatted)}
                  disabled={isLoading || phoneStage === 'sent'}
                />
              </div>
              {phoneStage === 'sent' && (
                <div className="space-y-2">
                  <Label htmlFor="phoneCode">Verification code</Label>
                  <OtpInput
                    id="phoneCode"
                    value={phoneCode}
                    onChange={setPhoneCode}
                    onComplete={(code) => handleVerifyPhoneOtp(code)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
              )}
              {phoneStage === 'idle' ? (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    By providing your phone number and selecting &ldquo;Send
                    Verification Code,&rdquo; you confirm that the number
                    belongs to you and consent to receive a one-time
                    verification code via SMS from Singr. Message and data
                    rates may apply. View{' '}
                    <PolicyDialog
                      policy="privacy"
                      trigger={
                        <button
                          type="button"
                          className="text-primary underline hover:no-underline"
                        >
                          Privacy Policy
                        </button>
                      }
                    />{' '}
                    here.
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleSendPhoneOtp}
                    disabled={isLoading || !phone}
                  >
                    {isLoading ? 'Sending...' : 'Send Verification Code'}
                  </Button>
                </>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleSendPhoneOtp}
                    disabled={isLoading}
                  >
                    Resend
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => handleVerifyPhoneOtp()}
                    disabled={isLoading || phoneCode.length < 6}
                  >
                    {isLoading ? 'Verifying...' : 'Sign in'}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {isGoogleOAuthEnabled && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                type="button"
              >
                Continue with Google
              </Button>
            </>
          )}

          <div className="text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
