import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion) ?? '2025-08-27.basil',
  typescript: true,
})

// Server-side only utilities moved to separate files
