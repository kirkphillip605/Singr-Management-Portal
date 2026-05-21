import Stripe from 'stripe'

const stripeSecret = process.env["STRIPE_SECRET_KEY"] || (process.env["npm_lifecycle_event"] === 'build' ? 'dummy_secret_for_build_1234567890' : '')
export const stripe = new Stripe(stripeSecret || 'dummy_secret', {
  apiVersion: (process.env["STRIPE_API_VERSION"] as Stripe.LatestApiVersion) ?? '2025-08-27.basil',
  typescript: true,
})

// Server-side only utilities moved to separate files
