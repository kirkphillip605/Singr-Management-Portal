# Singr Karaoke Connect

Singr Karaoke Connect is a multi-tenant karaoke management platform. It provides a customer-facing admin dashboard for KJs and venue owners, a singer-facing web app for guests to browse songs and submit requests, and an OpenKJ-compatible HTTP API that lets the OpenKJ desktop application sync requests in real time.

## URL topology

In production every public hostname points at the same single Next.js
process; a host-aware middleware (`src/middleware.ts`) inspects the `Host`
header and rewrites each request into the right section of the app:

| Hostname                         | Surface                          | Internal prefix |
|----------------------------------|----------------------------------|-----------------|
| `singrkaraoke.com` / `www.`      | Marketing landing page only      | `/`             |
| `host.singrkaraoke.com`          | Customer (KJ / venue) portal     | `/dashboard/*`  |
| `api.singrkaraoke.com`           | OpenKJ + webhook + auth API      | `/api/*`        |
| *future:* `app.singrkaraoke.com` | Singer app (separate Capacitor build) — talks to `api.` | n/a |
| `admin.singrkaraoke.com` | Internal staff console (`/admin/*`) | `/admin/*` (prefix hidden in the URL bar) |

Nginx Proxy Manager terminates TLS for each subdomain and forwards every
hostname to the same upstream (`<box>:5000`). No per-subdomain Next.js
deployments are needed.

The middleware also:

- Strips the `/dashboard` prefix from `host.singrkaraoke.com/...` URLs (a
  link to `/dashboard/venues` 308-redirects to `/venues` so the dashboard
  prefix never leaks into the URL bar) and the `/admin` prefix from
  `admin.singrkaraoke.com/...` URLs (same pattern).
- Blocks **everything** on the apex domain except the marketing landing
  (`/`) and `/legal/*`. Sign-in, the host portal, the admin console, and
  the API each live on their own subdomain. The footer "Support login"
  link on the landing page jumps directly to
  `https://admin.singrkaraoke.com/auth/signin`.
- Enforces an origin-bound authorization context on
  `api.singrkaraoke.com`: browser requests whose `Origin` is not in
  the allow-list get a 403 *before* hitting any route handler.
  Server-to-server callers (OpenKJ clients, Stripe webhooks — no
  `Origin` header) pass through untouched and authenticate with
  bearer API keys / signed payloads as before.
- Sets dynamic CORS on `api.singrkaraoke.com` — origins are echoed
  against an allow-list and OPTIONS preflights are answered directly
  from the middleware.
- Falls through unchanged on Replit preview URLs and `localhost`, so the
  existing single-port dev experience keeps working.

To exercise the subdomain routing locally without owning the domain, use the
`*.localhost` aliases (most browsers resolve these automatically):

```
http://host.localhost:5000     # customer portal
http://api.localhost:5000      # public API
http://admin.localhost:5000    # internal admin console
http://localhost:5000          # apex landing
```

You can also force a surface via `SINGR_HOST_SURFACE_OVERRIDE=host npm run
dev` for one-off testing.

### Auth realm isolation

Even though every surface shares one Postgres database, sessions are kept
separate so a customer credential cannot silently grant access to the singer
app or admin console:

- Better Auth cookies are **host-only** (no `Domain` attribute) so a session
  cookie on `host.singrkaraoke.com` is never sent to `api.`, `app.` or
  `admin.`.
- Each surface has a **distinct cookie name** (today: `singr.host.*`;
  reserved for the future `singr.admin.*`, `singr.singer.*`).
- Server-side route handlers and layouts re-check `accountType` /
  `adminLevel` on every protected route, so even a forged cookie of the
  wrong type is rejected with 401/403.

## Architecture

The project is a single Next.js 15 (App Router) application that hosts three logically distinct surfaces:

- **Customer App** (`src/app/dashboard`, `src/app/auth`) — Where KJs and venue owners sign in to manage their venues, API keys, song book, branding, billing, and support tickets.
- **Singer App** (`src/app/(public singer routes inside src/app)`) — Public, mobile-friendly pages where guests at a venue browse songs and submit requests.
- **Admin Console** (`src/app/admin`) — Internal staff console for managing customers, subscriptions, and platform-wide support.
- **OpenKJ API** (`src/app/api/openkj`) — JSON HTTP endpoint consumed by the OpenKJ desktop client. Authenticates via per-customer API keys and exposes the `getSerial`, `getRequests`, `setAccepting`, `addSongs`, etc. commands.

Supporting pieces:

- **Database** — PostgreSQL accessed through Prisma (`prisma/schema.prisma`).
- **Auth** — [Better Auth](https://www.better-auth.com/) with email/password (Argon2 + bcrypt fallback), Google OAuth with account linking, Twilio phone OTP, and optional 2FA via TOTP / SMS / email.
- **Payments** — Stripe Checkout + customer portal, with webhooks at `/api/webhooks/stripe`.
- **Email/SMS** — SMTP (nodemailer) for transactional email; Twilio for SMS OTP.
- **Monitoring** — Sentry (optional, opt-in via `NEXT_PUBLIC_SENTRY_DSN`).

### User roles

- **Customer / Host** — A KJ or venue owner. Signs up, subscribes, creates venues, generates OpenKJ API keys, and manages their song book and branding.
- **Singer** — A guest at a venue. Uses the public singer pages to browse a venue's song book and submit requests; no account required.
- **Admin** — Internal Singr staff. Has access to `/admin` for cross-customer management, support triage, and subscription operations.

## Local development

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+ (local or hosted)
- A Stripe account (test mode is fine)
- Optional: Twilio, Google OAuth, HERE Maps, and SMTP credentials for the features that depend on them

### Setup

1. **Clone and install dependencies**

   ```bash
   git clone <repository-url>
   cd singr-karaoke-connect
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and fill in at minimum `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and the Stripe keys. See the [Environment variables](#environment-variables) section for the full reference.

3. **Initialize the database**

   ```bash
   npm run db:generate          # generate Prisma client
   npm run db:migrate           # apply migrations (creates tables)
   npm run db:seed              # seed an admin + demo customer user
   ```

4. **(Optional) Provision Stripe products**

   ```bash
   npm run stripe:setup         # create the default products / prices
   npm run stripe:sync          # mirror Stripe data into the local DB
   ```

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   The app listens on [http://localhost:5000](http://localhost:5000).

### Stripe webhooks (local)

Forward Stripe events to your local server using the Stripe CLI:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Copy the `whsec_…` secret it prints into `STRIPE_WEBHOOK_SECRET`.

## Environment variables

The full annotated list lives in [`.env.example`](./.env.example). The most important ones:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `BETTER_AUTH_SECRET` | yes | Session signing secret. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | yes | Public base URL of the app (used for OAuth/email links). |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Stripe API keys. |
| `STRIPE_WEBHOOK_SECRET` | yes (for billing) | Signing secret for `/api/webhooks/stripe`. |
| `HERE_API_KEY` | yes (for venue search) | HERE Maps API key for geocoding. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | optional | Enables "Continue with Google". |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | optional | Enables SMS-based phone OTP and 2FA. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | optional | Enables transactional email (password reset, verification, email 2FA). |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | optional | Enables Sentry error reporting. |
| `SUPPORT_PHONE` / `SUPPORT_EMAIL` / `SUPPORT_DOCS` | optional | Contact info shown in the in-app support UI. |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | legacy | Read as fallbacks during the migration to Better Auth. `NEXTAUTH_URL` is also still used by the Stripe billing return URLs and a few public-URL hints in the dashboard. New installs should set the `BETTER_AUTH_*` equivalents instead. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET` | legacy | Fallback only — older deploys sometimes stored the Google OAuth client secret under this name. New installs should leave it empty. |

When optional credentials are missing the corresponding feature degrades gracefully (e.g. OTPs are logged to the server console instead of being sent over SMS).

## npm scripts

### Development
- `npm run dev` — Start the dev server on port 5000.
- `npm run lint` / `npm run lint:fix` — Run / auto-fix ESLint.
- `npm run format` — Format with Prettier.
- `npm run type-check` / `npm run type-check:watch` — Run TypeScript without emitting.

### Database
- `npm run db:generate` — Regenerate the Prisma client.
- `npm run db:migrate` — Create + apply a new migration in development.
- `npm run db:migrate:deploy` — Apply pending migrations in production.
- `npm run db:push` — Push the schema without creating a migration.
- `npm run db:seed` — Run `prisma/seed.ts`.
- `npm run db:studio` — Open Prisma Studio.

### Stripe
- `npm run stripe:setup` — Create initial Stripe products / prices.
- `npm run stripe:sync` — Sync Stripe data into the local DB.

### Production
- `npm run build` — Build the Next.js app.
- `npm run start` — Start the production server on port 5000.
- `npm run analyze` — Build with bundle analyzer enabled.
- `npm run clean` — Remove `.next` and the npm cache.

## Project structure

```
src/
  app/                  # Next.js App Router pages and API routes
    admin/              # Internal admin console
    api/                # API route handlers (auth, billing, openkj, webhooks, ...)
    auth/               # Sign-in / sign-up / password-reset pages
    dashboard/          # Customer (KJ / venue owner) dashboard
  components/           # Shared React components (UI primitives + features)
  hooks/                # Custom React hooks
  lib/                  # Server libs: prisma client, auth, stripe, logger, ...
  types/                # TypeScript type definitions
prisma/                 # Prisma schema, migrations, and seed script
scripts/                # One-off scripts (Stripe sync, admin user creation)
public/                 # Static assets
```

## License

ISC
