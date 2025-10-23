'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignUpPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect if already logged in
  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (session) {
      router.push('/dashboard')
    }
  }, [session, status, router])

  const handleFusionAuthRegister = () => {
    // Redirect to FusionAuth registration page
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const fusionauthIssuer = process.env.NEXT_PUBLIC_FUSIONAUTH_ISSUER || 'https://auth.singrkaraoke.com'
    const clientId = process.env.NEXT_PUBLIC_FUSIONAUTH_CLIENT_ID || '9f1a576c-708f-4f05-a3cf-12096b314ca4'
    const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/callback/fusionauth`)
    
    const registrationUrl = `${fusionauthIssuer}/oauth2/register?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}`
    
    window.location.href = registrationUrl
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
              className="h-16 w-auto"
            />
          </div>
          <hr />
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Get started with Singr Karaoke Connect
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleFusionAuthRegister}
            className="w-full" 
            size="lg"
          >
            Register with FusionAuth
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              By registering, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>

          <div className="text-center text-sm">
            Already have an account?{' '}
            <a href="/auth/signin" className="text-primary hover:underline">
              Sign in
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}