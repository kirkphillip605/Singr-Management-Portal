'use client'

import { useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignInPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect if already logged in
  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (session?.user) {
      const destination = session.user.accountType === 'admin' ? '/admin' : '/dashboard'
      router.push(destination)
    }
  }, [session, status, router])

  const handleFusionAuthSignIn = () => {
    signIn('fusionauth', { callbackUrl: '/dashboard' })
  }

  // Show loading state while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
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
          <Button 
            onClick={handleFusionAuthSignIn}
            className="w-full" 
            size="lg"
          >
            Sign in with FusionAuth
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}