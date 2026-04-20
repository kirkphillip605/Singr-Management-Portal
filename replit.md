# Singr Karaoke Connect

A professional karaoke online request management platform with real-time requests and multi-venue support (Singer-facing request app included).

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database ORM**: Prisma (PostgreSQL)
- **Auth**: NextAuth.js v4 with Prisma adapter
- **Payments**: Stripe
- **Styling**: Tailwind CSS + Radix UI components
- **Monitoring**: Sentry (optional, disabled by default)

## Replit Setup

- Dev server runs on port **5000** via `npm run dev`
- Workflow: "Start application" → `npm run dev`
- Sentry instrumentation is disabled — re-enable by restoring `src/instrumentation.ts` and `src/instrumentation-client.ts` and setting the `NEXT_PUBLIC_SENTRY_DSN` env var

## Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Full public URL of the app (e.g. `https://your-app.replit.app`) |
| `NEXTAUTH_SECRET` | Secret for NextAuth session encryption (generate with `openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |

## Optional Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `HERE_API_KEY` | HERE Maps API key for venue search/geocoding |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error monitoring |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps |
| `NEXT_PUBLIC_APP_URL` | Public URL override |

## Project Structure

```
src/
  app/           # Next.js App Router pages and API routes
    admin/       # Admin dashboard
    api/         # API route handlers
    auth/        # Auth pages
    dashboard/   # Host/venue dashboard
  components/    # Shared React components
  hooks/         # Custom React hooks
  lib/           # Utilities, db client, auth config
  types/         # TypeScript type definitions
  utils/         # Helper functions
prisma/          # Prisma schema and migrations
scripts/         # Setup scripts (Stripe sync, etc.)
public/          # Static assets
```

## Database

Run the following after configuring `DATABASE_URL`:

```bash
npm run db:migrate:deploy   # Apply migrations in production
npm run db:generate         # Regenerate Prisma client after schema changes
```

## Security Notes

- Google OAuth credentials are server-side only (not exposed to client)
- `NEXTAUTH_SECRET` must be a strong random string in production
- Stripe webhook secret must match the Stripe dashboard signing secret
