'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { CreditCard, AlertTriangle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react'
import { formatAmountForDisplay } from '@/lib/stripe'

interface Subscription {
  id: string
  status: string
  cancel_at_period_end: boolean
  current_period_start: Date | string
  current_period_end: Date | string
  cancel_at?: string | null
  priceId?: string // Stripe price ID
  currency: string
  items?: any // Subscription items JSON
}

interface SubscriptionManagementProps {
  subscription: Subscription | null
}

export function SubscriptionManagement({ 
  subscription
}: SubscriptionManagementProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [priceInfo, setPriceInfo] = useState<any>(null)
  const router = useRouter()

  // Fetch price and product info when subscription loads
  useEffect(() => {
    if (subscription?.priceId) {
      fetch(`/api/prices/${subscription.priceId}`)
        .then(res => res.json())
        .then(data => setPriceInfo(data))
        .catch(() => {})
    }
  }, [subscription?.priceId])

  const handleCancelSubscription = async () => {
    if (!subscription) return
    
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/billing/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          cancelAtPeriodEnd: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReactivateSubscription = async () => {
    if (!subscription) return
    
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/billing/reactivate-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reactivate subscription')
      }

      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCustomerPortal = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/billing/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to open customer portal')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
      setIsLoading(false)
    }
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            No Active Subscription
          </CardTitle>
          <CardDescription>
            Choose a plan to get started with Singr Karaoke Connect
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              You don't have an active subscription. Choose a plan to unlock all features.
            </p>
            <Button onClick={() => router.push('/dashboard/billing/plans')}>
              Choose a Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Current Subscription
        </CardTitle>
        <CardDescription>
          Manage your Singr Karaoke Connect subscription
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {priceInfo?.productRelation?.name || 'Pro Plan'}
              </h3>
              <p className="text-muted-foreground">
                {formatAmountForDisplay(
                  Number(priceInfo?.unitAmount || 0), 
                  subscription.currency
                )} / {priceInfo?.recurring?.interval || 'month'}
              </p>
            </div>
            <Badge
              variant={
                subscription.status === 'active' 
                  ? 'default' 
                  : subscription.status === 'trialing'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {subscription.status === 'trialing' ? 'Trial' : subscription.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Current period</p>
              <p className="text-sm text-muted-foreground">
                {new Date(subscription.current_period_start).toLocaleDateString()} -{' '}
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">
                {subscription.cancel_at_period_end ? 'Cancels on' : 'Next billing date'}
              </p>
              <p className="text-sm text-muted-foreground">
                {subscription.cancel_at 
                  ? new Date(subscription.cancel_at).toLocaleDateString()
                  : new Date(subscription.current_period_end).toLocaleDateString()
                }
              </p>
            </div>
          </div>

          {subscription.cancel_at_period_end && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your subscription will be cancelled at the end of the current billing period on{' '}
                {new Date(subscription.current_period_end).toLocaleDateString()}.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCustomerPortal} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Manage Billing
            </Button>

            {subscription.cancel_at_period_end ? (
              <Button 
                variant="outline" 
                onClick={handleReactivateSubscription}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Reactivate Subscription
              </Button>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={isLoading}>
                    Cancel Subscription
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Subscription</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to cancel your subscription? You'll continue to have access 
                      until the end of your current billing period on{' '}
                      {new Date(subscription.current_period_end).toLocaleDateString()}.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {}}>
                      Keep Subscription
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleCancelSubscription}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        'Cancel Subscription'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}