# Singr Karaoke Connect

Professional karaoke management platform with real-time requests, multi-venue support, and seamless OpenKJ integration. Built with Next.js 15 and optimized for production deployment.

## ✨ Features

- 🎤 Multi-venue karaoke management
- 📱 Real-time song request system
- 💳 Integrated Stripe billing
- 🔗 OpenKJ desktop integration
- 🎨 Custom branding options
- 📊 Analytics and reporting
- 🔐 Secure API key management
- ⚡ Next.js 15 optimized performance
- 🛡️ Type-safe with strict TypeScript
- 🎯 Production-ready error handling

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Stripe account (for billing)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd singr-management-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. **Set up Stripe products (optional)**
   ```bash
   npm run stripe:setup
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

Visit [http://localhost:3000](http://localhost:3000) to see your application.

## 📁 Project Structure

```
src/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── admin/             # Admin pages
│   ├── auth/              # Authentication pages
│   ├── layout.tsx         # Root layout with metadata
│   ├── page.tsx           # Home page
│   └── providers.tsx      # Client-side providers
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── admin/            # Admin-specific components
│   └── support/          # Support components
├── lib/                   # Core libraries
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client setup
│   ├── stripe.ts         # Stripe integration
│   └── utils.ts          # Utility functions
├── utils/                 # Additional utilities
│   ├── validation.ts     # Zod validation schemas
│   └── helpers.ts        # Helper functions
├── hooks/                 # Custom React hooks
│   └── use-async.ts      # Async state management
└── types/                 # TypeScript definitions
    ├── global.d.ts       # Global type definitions
    └── next-auth.d.ts    # NextAuth type extensions
```

## 🛠️ Tech Stack

### Core
- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/) (strict mode)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)

### Authentication & Authorization
- **Auth**: [NextAuth.js](https://next-auth.js.org/) with [FusionAuth](https://fusionauth.io/)
- **Provider**: FusionAuth OAuth 2.0 / OpenID Connect
- **Role-Based Access**: Customer owner role verification

See [FUSIONAUTH_INTEGRATION.md](./FUSIONAUTH_INTEGRATION.md) for detailed authentication setup.

### UI & Styling
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

### Payments & Subscriptions
- **Payment Processing**: [Stripe](https://stripe.com/)
- **Webhooks**: Stripe webhooks for subscription management

### Development & Quality
- **Type Checking**: Strict TypeScript
- **Linting**: ESLint with Next.js config
- **Formatting**: Prettier with Tailwind plugin
- **Validation**: Zod schemas
- **Error Tracking**: Sentry (optional)

## 📜 Available Scripts

### Development
- `npm run dev` - Start development server with Turbopack
- `npm run type-check` - Run TypeScript type checking
- `npm run type-check:watch` - Watch mode for type checking
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier

### Database
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:migrate:deploy` - Deploy migrations to production
- `npm run db:seed` - Seed database with initial data
- `npm run db:studio` - Open Prisma Studio

### Stripe
- `npm run stripe:setup` - Create initial Stripe products
- `npm run stripe:sync` - Sync Stripe data to database

### Production
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run prebuild` - Pre-build checks (type checking)
- `npm run analyze` - Analyze bundle size

### Code Modification
- `npm run codemod:next15-params` - Update route params for Next.js 15
- `npm run codemod:next15-pages` - Update page params for Next.js 15

### Utilities
- `npm run clean` - Clean build artifacts

## 🔧 New Utilities & Helpers

### Validation Schemas (`src/utils/validation.ts`)
Comprehensive Zod schemas for type-safe validation:
- User authentication (signup, signin)
- Venue management
- API keys
- Song requests
- Support tickets
- Subscriptions

```typescript
import { signInSchema } from '@/utils/validation'

const result = signInSchema.parse({ email, password })
```

### Helper Functions (`src/utils/helpers.ts`)
Common utility functions:
- `cn()` - Tailwind class name merging
- `formatCurrency()` - Currency formatting
- `formatDate()` - Date formatting
- `debounce()` - Debounce function calls
- `slugify()` - Convert strings to slugs
- And many more...

```typescript
import { cn, formatCurrency } from '@/utils/helpers'

const className = cn('text-lg', isActive && 'font-bold')
const price = formatCurrency(1500) // $15.00
```

### Async Hook (`src/hooks/use-async.ts`)
Custom hook for async operations:

```typescript
import { useAsync } from '@/hooks/use-async'

const { execute, data, isLoading, error } = useAsync(
  async (userId: string) => {
    const res = await fetch(`/api/users/${userId}`)
    return res.json()
  }
)

// Later...
await execute('user-123')
```

### Error Boundary (`src/components/ui/error-boundary.tsx`)
Graceful error handling:

```typescript
import { ErrorBoundary } from '@/components/ui/error-boundary'

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### Global Types (`src/types/global.d.ts`)
Next.js 15 compliant types:
- `PageProps<TParams, TSearchParams>` - For page components
- `LayoutProps<TParams>` - For layout components
- `RouteContext<TParams>` - For API routes
- Environment variables typing
- API response types

## 🔐 Environment Variables

See `.env.example` for required environment variables. Key variables include:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Your app URL
- `FUSIONAUTH_ISSUER` - FusionAuth server URL
- `FUSIONAUTH_CLIENT_ID` - FusionAuth application client ID
- `FUSIONAUTH_CLIENT_SECRET` - FusionAuth application client secret
- `FUSIONAUTH_REQUIRED_ROLE` - Required role for billing portal access (default: `customer_owner`)
- `STRIPE_SECRET_KEY` - Stripe secret key

For complete FusionAuth configuration details, see [FUSIONAUTH_INTEGRATION.md](./FUSIONAUTH_INTEGRATION.md).

## 🏗️ Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Run database migrations**
   ```bash
   npm run db:migrate:deploy
   ```

3. **Start production server**
   ```bash
   npm run start
   ```

### Recommended Platforms
- [Vercel](https://vercel.com/) (Recommended for Next.js)
- [Railway](https://railway.app/)
- [Render](https://render.com/)
- AWS, Google Cloud, Azure

## 📝 Code Quality

This project follows strict TypeScript and code quality standards:

- ✅ Strict TypeScript mode enabled
- ✅ ESLint with Next.js recommended rules
- ✅ Prettier for consistent formatting
- ✅ Type-safe environment variables
- ✅ Comprehensive validation with Zod
- ✅ Error boundaries for graceful failures

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

ISC

## 🆘 Support

For support, please:
- Create an issue in the repository
- Visit [support.singr.io](https://support.singr.io)
- Email support@singr.io

---

Built with ❤️ by Singr Karaoke Team# Singr-Management-Portal
