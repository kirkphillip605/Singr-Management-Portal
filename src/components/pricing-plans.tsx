'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Star, Loader2, CreditCard } from 'lucide-react'
import { formatAmountForDisplay } from '@/lib/stripe'

interface Price {
  id: string
  unitAmount: bigint
  currency: string
  interval: string
  intervalCount: number
  metadata: Record<string, string>
  product: {
    id: string
    name: string
    description?: string
  }
}

interface PricingPlansProps {
  prices: Price[]
  currentSubscription?: {
    priceId: string
    status: string
  }
}

export function PricingPlans({ prices, currentSubscription }: PricingPlansProps) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleSubscribe = async (priceId: string) => {
    setLoadingPriceId(priceId)
    setError('')

    try {
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/dashboard/billing?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/billing`,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
      setLoadingPriceId(null)
    }
  }

  const getSavingsPercentage = (price: Price) => {
    if (price.metadata?.savings_percentage) {
      return parseInt(price.metadata.savings_percentage)
    }
    return null
  }

  const getPlanName = (price: Price) => {
    if (price.metadata?.plan_name) {
      switch (price.metadata.plan_name) {
        case 'monthly': return 'Monthly'
        case 'semi-annual': return 'Semi-Annual'
        case 'annual': return 'Annual'
        default: return price.product.name || 'Plan'
      }
    }
    return price.product.name || 'Plan'
  }

  const isCurrentPlan = (priceId: string) => {
    return currentSubscription?.priceId === priceId && 
           ['active', 'trialing'].includes(currentSubscription.status)
  }

  const sortedPrices = [...prices].sort((a, b) => {
    const order = { monthly: 1, 'semi-annual': 2, annual: 3 }
    const aOrder = order[a.metadata?.plan_name as keyof typeof order] || 999
    const bOrder = order[b.metadata?.plan_name as keyof typeof order] || 999
    return aOrder - bOrder
  })

  if (prices.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No plans available</h3>
          <p className="text-muted-foreground">
            Pricing plans are being configured. Please check back later.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {sortedPrices.map((price, index) => {
          const savings = getSavingsPercentage(price)
          const planName = getPlanName(price)
          const isPopular = price.metadata?.plan_name === 'semi-annual'
          const isCurrent = isCurrentPlan(price.id)
          const isLoading = loadingPriceId === price.id

          return (
            <Card 
              key={price.id} 
              className={`relative ${
                isPopular ? 'ring-2 ring-primary transform scale-105' : ''
              } ${isCurrent ? 'border-green-500' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              {isCurrent && (
                <div className="absolute -top-4 right-4">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{planName}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {formatAmountForDisplay(Number(price.unitAmount), price.currency)}
                  </span>
                  <span className="text-muted-foreground">/{price.interval}</span>
                </div>
                {savings && (
                  <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">
                    Save {savings}%
                  </Badge>
                )}
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span>Full Platform Access</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span>Unlimited Venues</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span>Real-time Song Requests</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span>OpenKJ Integration</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                    <span>Email Support</span>
                  </li>
                  {(isPopular || price.metadata?.plan_name === 'annual') && (
                    <>
                      <li className="flex items-center text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                        <span>Priority Support</span>
                      </li>
                      <li className="flex items-center text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                        <span>Custom Branding Available</span>
                      </li>
                    </>
                  )}
                  {price.metadata?.plan_name === 'annual' && (
                    <li className="flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-3 flex-shrink-0" />
                      <span>Free Setup Consultation</span>
                    </li>
                  )}
                </ul>

                <Button 
                  className="w-full" 
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handleSubscribe(price.id)}
                  disabled={isCurrent || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    `Choose ${planName}`
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          All plans include a 7-day free trial • No setup fees • Cancel anytime
        </p>
      </div>
    </div>
  )
}