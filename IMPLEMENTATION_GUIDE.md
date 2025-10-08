# Next.js 15 Refactoring - Implementation Guide

## Quick Reference for New Utilities

### 1. Type-Safe Page Components (Next.js 15)

```typescript
// src/app/venues/[slug]/page.tsx
import type { PageProps } from '@/types/global'

export default async function VenuePage({
  params,
  searchParams,
}: PageProps<{ slug: string }, { tab?: string }>) {
  const { slug } = await params
  const { tab } = await searchParams
  
  // Your page implementation
}
```

### 2. Validation with Zod Schemas

```typescript
import { venueSchema } from '@/utils/validation'

// In a Server Action or API route
async function createVenue(formData: FormData) {
  const data = venueSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    // ... other fields
  })
  
  // Type-safe data with validation
  const venue = await prisma.venue.create({ data })
  return venue
}
```

### 3. Helper Functions

```typescript
import { cn, formatCurrency, formatDate, debounce } from '@/utils/helpers'

// Merge Tailwind classes
const buttonClass = cn(
  'px-4 py-2 rounded',
  isActive && 'bg-blue-500 text-white',
  isDisabled && 'opacity-50 cursor-not-allowed'
)

// Format currency (amount in cents)
const price = formatCurrency(1500) // "$15.00"

// Format dates
const formattedDate = formatDate(new Date()) // "October 8, 2024"

// Debounce search
const handleSearch = debounce((query: string) => {
  // Search implementation
}, 300)
```

### 4. Async State Management Hook

```typescript
import { useAsync } from '@/hooks/use-async'

function UserProfile({ userId }: { userId: string }) {
  const { execute, data, isLoading, error } = useAsync(
    async (id: string) => {
      const response = await fetch(`/api/users/${id}`)
      if (!response.ok) throw new Error('Failed to fetch user')
      return response.json()
    },
    {
      immediate: false,
      onSuccess: (user) => {
        console.log('User loaded:', user)
      },
      onError: (error) => {
        console.error('Failed to load user:', error)
      }
    }
  )

  useEffect(() => {
    execute(userId)
  }, [userId])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!data) return null

  return <div>{data.name}</div>
}
```

### 5. Error Boundary Usage

```typescript
// Wrap components that might throw errors
import { ErrorBoundary } from '@/components/ui/error-boundary'

function App() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  )
}

// Or with custom fallback
<ErrorBoundary
  fallback={
    <div>Custom error UI</div>
  }
>
  <MyComponent />
</ErrorBoundary>
```

### 6. API Route with Next.js 15

```typescript
// src/app/api/venues/[id]/route.ts
import type { RouteContext } from '@/types/global'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  context: RouteContext<{ id: string }>
) {
  const { id } = await context.params
  
  // Your implementation
  const venue = await prisma.venue.findUnique({
    where: { id }
  })
  
  return Response.json(venue)
}
```

### 7. Environment Variables

```typescript
// Type-safe environment access
const stripeKey = process.env.STRIPE_SECRET_KEY // string
const nodeEnv = process.env.NODE_ENV // 'development' | 'production' | 'test'

// Client-side public variables
const publicUrl = process.env.NEXT_PUBLIC_APP_URL
```

### 8. Validation Types

```typescript
import type { SignUpInput, VenueInput } from '@/utils/validation'

// Use inferred types from Zod schemas
function processSignup(data: SignUpInput) {
  // data is fully typed: { name: string, email: string, password: string, confirmPassword: string }
}
```

## Best Practices

### Type Safety
- Always use the provided type definitions from `@/types/global`
- Use Zod schemas for runtime validation
- Enable strict mode in TypeScript (already configured)

### Error Handling
- Wrap route segments with ErrorBoundary
- Use try-catch in async operations
- Provide meaningful error messages

### Performance
- Use debounce/throttle for user input handlers
- Lazy load heavy components
- Optimize images (already configured in next.config.js)

### Code Organization
- Keep validation schemas in `@/utils/validation`
- Put reusable utilities in `@/utils/helpers`
- Custom hooks go in `@/hooks`
- Type definitions in `@/types`

## Migration Guide

### Updating Existing Pages for Next.js 15

Before:
```typescript
type Props = {
  params: { id: string }
  searchParams: { page?: string }
}

export default function Page({ params, searchParams }: Props) {
  const id = params.id  // ❌ Not Next.js 15 compliant
}
```

After:
```typescript
import type { PageProps } from '@/types/global'

export default async function Page({
  params,
  searchParams
}: PageProps<{ id: string }, { page?: string }>) {
  const { id } = await params  // ✅ Next.js 15 compliant
  const { page } = await searchParams
}
```

### Converting to Validation Schemas

Before:
```typescript
if (!email || !password) {
  throw new Error('Missing fields')
}
// Manual validation...
```

After:
```typescript
import { signInSchema } from '@/utils/validation'

try {
  const validated = signInSchema.parse({ email, password })
  // Use validated data
} catch (error) {
  // Handle validation error
}
```

## Next Steps

1. Run `npm run type-check` to ensure no type errors
2. Run `npm run lint` to check code quality
3. Run `npm run format` to format all files
4. Run `npm run build` to test production build
5. Review the README.md for deployment instructions

## Support

For questions or issues:
- Check the README.md
- Review the inline documentation in each utility file
- Create an issue in the repository
