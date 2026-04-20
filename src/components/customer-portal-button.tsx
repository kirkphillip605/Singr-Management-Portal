'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'

interface CustomerPortalButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  text?: string
  className?: string
}

export function CustomerPortalButton({ 
  variant = 'default', 
  text = 'Manage Subscription & Billing',
  className = 'w-full'
}: CustomerPortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    
    try {
      // Better Auth Stripe plugin owns the billing portal session.
      const response = await fetch('/api/auth/subscription/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/dashboard/billing`,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const data = await response.json()
      const portalUrl = data.url || data.redirect || data.portalUrl
      if (!portalUrl) throw new Error('No portal URL returned')
      window.location.href = portalUrl
    } catch (error) {
      console.error('Error redirecting to customer portal:', error)
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Opening Portal...
        </>
      ) : (
        <>
          <ExternalLink className="mr-2 h-4 w-4" />
          {text}
        </>
      )}
    </Button>
  )
}