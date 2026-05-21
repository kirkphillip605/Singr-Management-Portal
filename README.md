# Singr Karaoke Connect

> Professional karaoke management platform with real-time song requests, multi-venue support, and OpenKJ integration.

Built by [KirkNetworks, LLC](https://kirknetworks.com)

---

## Architecture

```
singr-karaoke-connect/
├── apps/
│   ├── marketing/        # Landing page & legal content (Next.js)
│   ├── host-portal/      # KJ/venue management dashboard (Next.js)
│   ├── admin-console/    # Internal staff admin panel (Next.js)
│   ├── api/              # OpenKJ API & webhooks (Next.js API routes)
│   └── singer-app/       # Singer-facing PWA (Ionic React + Capacitor)
├── packages/
│   ├── auth/             # Better Auth configuration & session helpers
│   ├── database/         # Prisma schema, client, & migrations
│   ├── redis/            # Redis client & rate limiter
│   ├── stripe-billing/   # Stripe SDK wrapper & helpers
│   ├── ui/               # Shared React UI components
│   └── config/           # Shared configs (TypeScript, ESLint, Tailwind, Logger)
├── docker-compose.yml    # Full-stack deployment
├── Dockerfile            # Multi-stage build for Next.js apps
└── scripts/
    └── deploy-setup.sh   # Interactive .env generator
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router) · Ionic React (Singer PWA) |
| **Language** | TypeScript 5.8 |
| **Database** | PostgreSQL 17 · Prisma ORM |
| **Cache** | Redis 7 |
| **Auth** | Better Auth (email, Google, Apple, phone OTP, magic link, passkey, 2FA, anonymous) |
| **Billing** | Stripe (subscriptions, checkout, webhooks) |
| **Styling** | Tailwind CSS · Radix UI |
| **Monitoring** | Sentry (per-app projects) |
| **Monorepo** | Turborepo · pnpm workspaces |
| **Deployment** | Docker Compose · Nginx Proxy Manager |

## URL Topology

| Subdomain | App | Port |
|---|---|---|
| `singrkaraoke.com` | Marketing | 25000 |
| `host.singrkaraoke.com` | Host Portal | 25001 |
| `admin.singrkaraoke.com` | Admin Console | 25002 |
| `api.singrkaraoke.com` | API | 25003 |
| `app.singrkaraoke.com` | Singer App | 25004 |

## Quick Start

```bash
# Prerequisites: Node.js 24+, pnpm 9+, Docker

# 1. Generate .env file
bash scripts/deploy-setup.sh

# 2. Start infrastructure
docker compose up -d db redis

# 3. Install dependencies
pnpm install

# 4. Run migrations & generate Prisma client
pnpm db:migrate:deploy
pnpm db:generate

# 5. Start development servers
pnpm dev
```

## User Roles

All users share a single `users` table with role-based access:

| Role | Description |
|---|---|
| `singer` | Can browse venues, search songs, submit requests |
| `host` | Venue/KJ operations, paid subscription required |
| `support` | Support staff with limited admin access |
| `super_admin` | Full platform administration |

A user can hold multiple roles — a host can also use the singer app without creating a separate account.

## Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Full deployment instructions for dev, staging, and production
- **[.env.example](.env.example)** — All environment variables with descriptions

## License

ISC © KirkNetworks, LLC
