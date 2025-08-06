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
      const response = await fetch('/api/billing/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()
      
      // Redirect to Stripe billing portal
      window.location.href = url
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