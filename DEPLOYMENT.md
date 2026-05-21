# Deployment Guide — Singr Karaoke Connect

This guide covers deploying Singr Karaoke Connect for **development**, **staging**, and **production** environments.

---

## Prerequisites

| Tool | Minimum Version | Purpose |
|---|---|---|
| Node.js | 24.x LTS | Local development |
| pnpm | 9.15+ | Package management |
| Docker | 24+ | Containerized deployment |
| Docker Compose | 2.20+ | Service orchestration |
| Git | 2.30+ | Source control |
| openssl | Any | Secret generation |

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone git@github.com:your-org/Singr-Management-Portal.git
cd Singr-Management-Portal

# 2. Run the interactive setup wizard
bash scripts/deploy-setup.sh

# 3. Start infrastructure (PostgreSQL + Redis)
docker compose up -d db redis

# 4. Install dependencies
pnpm install

# 5. Run database migrations
pnpm db:migrate:deploy

# 6. Generate Prisma client
pnpm db:generate

# 7. Start all apps in development mode
pnpm dev
```

### Default Development Ports

| Service | Port | URL |
|---|---|---|
| PostgreSQL | 25432 | `postgresql://singr:...@localhost:25432/singr` |
| Redis | 26379 | `redis://localhost:26379` |
| Marketing | 25000 | `http://localhost:25000` |
| Host Portal | 25001 | `http://localhost:25001` |
| Admin Console | 25002 | `http://localhost:25002` |
| API | 25003 | `http://localhost:25003` |
| Singer App | 25004 | `http://localhost:25004` |

---

## Secret Generation

Generate all required secrets before deployment:

```bash
# Better Auth session secret
openssl rand -base64 32

# Database password
openssl rand -base64 24

# Or use the setup wizard which auto-generates these:
bash scripts/deploy-setup.sh
```

### Apple Sign-In Key

```bash
# Convert your .p8 key file to a single base64 string for the env var:
base64 -i AuthKey_XXXXX.p8 | tr -d '\n'
```

---

## Staging Deployment

### 1. Prepare the Environment

```bash
# Run setup wizard targeting staging
bash scripts/deploy-setup.sh
# Select option 2 (staging) when prompted
```

### 2. Build & Deploy with Docker Compose

```bash
# Build all containers
docker compose build

# Start all services
docker compose up -d

# Run database migrations
docker compose exec host-portal node -e "
  const { execSync } = require('child_process');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
"
# Or from the host if you have pnpm installed:
pnpm db:migrate:deploy

# Verify all services are running
docker compose ps
```

### 3. Configure Nginx Proxy Manager

Create proxy hosts for each subdomain:

| Subdomain | Forward Hostname | Forward Port |
|---|---|---|
| `singrkaraoke.com` | `marketing` (or server IP) | 25000 |
| `host.singrkaraoke.com` | `host-portal` | 25001 |
| `admin.singrkaraoke.com` | `admin-console` | 25002 |
| `api.singrkaraoke.com` | `api` | 25003 |
| `app.singrkaraoke.com` | `singer-app` | 25004 |

**For each proxy host:**
- Enable SSL with Let's Encrypt
- Enable "Force SSL"
- Enable WebSocket support (for live features)

---

## Production Deployment

### 1. Prepare Production Environment

```bash
# Generate production .env
bash scripts/deploy-setup.sh
# Select option 3 (production)
```

> **Critical:** Ensure all secrets are unique and not shared with staging.

### 2. Build & Deploy

```bash
# Pull latest code
git pull origin main

# Build fresh containers
docker compose build --no-cache

# Deploy with zero downtime (rolling restart)
docker compose up -d --remove-orphans

# Run migrations
pnpm db:migrate:deploy
```

### 3. Set Up Stripe

1. Create your products and prices in the [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Set up webhook endpoint: `https://api.singrkaraoke.com/api/webhooks/stripe`
3. Subscribe to events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in your `.env`

---

## Promoting Between Environments

### Staging → Production

```bash
# 1. Tag the staging release
git tag -a v1.x.x -m "Release v1.x.x"
git push origin v1.x.x

# 2. On the production server
git fetch origin
git checkout v1.x.x

# 3. Rebuild and deploy
docker compose build --no-cache
docker compose up -d

# 4. Run any new migrations
pnpm db:migrate:deploy
```

### Rolling Back

```bash
# 1. Check out the previous tag
git checkout v1.x.y

# 2. Rebuild containers
docker compose build
docker compose up -d

# 3. If database changes need reverting, restore from backup
# (See Database Backups section below)
```

---

## Database Management

### Backups

```bash
# Create a backup
docker compose exec db pg_dump -U singr singr > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
cat backup_YYYYMMDD_HHMMSS.sql | docker compose exec -T db psql -U singr singr
```

### Automated Daily Backups

Add to your server's crontab:

```bash
# Daily backup at 2 AM, keep last 14 days
0 2 * * * cd /path/to/singr && docker compose exec -T db pg_dump -U singr singr | gzip > /backups/singr_$(date +\%Y\%m\%d).sql.gz && find /backups -name "singr_*.sql.gz" -mtime +14 -delete
```

### Running Migrations

```bash
# Development (creates migration files)
pnpm db:migrate

# Staging/Production (applies existing migrations)
pnpm db:migrate:deploy

# View migration status
pnpm --filter @singr/database exec prisma migrate status
```

---

## Monitoring

### Logs

```bash
# Tail all logs
docker compose logs -f

# Tail specific service
docker compose logs -f host-portal

# Last 100 lines from API
docker compose logs --tail 100 api
```

### Health Checks

```bash
# Check container status
docker compose ps

# PostgreSQL health
docker compose exec db pg_isready -U singr

# Redis health
docker compose exec redis redis-cli ping
```

### Sentry

Each app reports to its own Sentry project configured via DSN:
- `SENTRY_HOST_PORTAL_DSN`
- `SENTRY_ADMIN_CONSOLE_DSN`
- `SENTRY_API_DSN`
- `SENTRY_SINGER_APP_DSN`

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|---|---|
| `ECONNREFUSED` on database | Check `docker compose ps db` — ensure it's healthy |
| Prisma migration drift | Run `pnpm db:migrate:deploy` or reset with `prisma migrate reset` |
| Port conflict | Update `PORT_*` values in `.env` and restart |
| Build OOM | Increase Docker memory limit (at least 4GB recommended) |
| Stripe webhooks failing | Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint in Stripe Dashboard |
| Redis connection refused | Check `docker compose ps redis` and `REDIS_URL` in `.env` |

### Full Reset (Development Only)

```bash
# Stop everything and remove volumes
docker compose down -v

# Remove node_modules
pnpm clean

# Start fresh
pnpm install
docker compose up -d db redis
pnpm db:migrate:deploy
pnpm dev
```
