# Report #2 — Refactor Plan

## Executive Summary

This refactor plan provides a comprehensive, prioritized roadmap to transform the **Singr Karaoke Connect** application into a modern, best-practice Next.js 15 application. The plan is structured in phases, from critical architectural changes to incremental improvements, ensuring the application remains functional throughout the migration.

**Estimated Timeline**: 6-8 weeks (full-time development)  
**Risk Level**: Medium (proper testing and incremental rollout mitigate risks)  
**Expected Benefits**:
- 30-40% reduction in network overhead (Server Actions vs API routes)
- 50% improvement in perceived performance (Suspense streaming)
- Improved maintainability and testability
- Better developer experience
- Enhanced type safety and error handling

---

## Phase 1: Foundation & Critical Architecture (Week 1-2)

### Priority: CRITICAL

These changes establish the architectural foundation for all subsequent improvements.

---

### 1.1 Implement Service Layer Pattern

**Impact**: Critical  
**Effort**: High  
**Rationale**: Separates business logic from route handlers and enables reusability

#### Directory Structure

```
src/lib/services/
├── index.ts                      # Barrel export
├── base-service.ts               # Abstract base class
├── venue-service.ts              # Venue operations
├── auth-service.ts               # Authentication logic
├── api-key-service.ts            # API key management
├── billing-service.ts            # Stripe/billing logic
├── support-service.ts            # Support ticket operations
└── errors/                       # Custom error classes
    ├── index.ts
    ├── api-error.ts
    ├── validation-error.ts
    └── not-found-error.ts
```

#### Implementation Example

```typescript
// src/lib/services/base-service.ts
import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export abstract class BaseService {
  protected prisma: PrismaClient
  protected logger: typeof logger

  constructor() {
    this.prisma = prisma
    this.logger = logger
  }

  protected handleError(error: unknown, context: string): never {
    this.logger.error(`Error in ${context}:`, error)
    throw error
  }
}
```

```typescript
// src/lib/services/venue-service.ts
import { BaseService } from './base-service'
import { slugify } from '@/lib/utils/string'
import { VenueNotFoundError, VenueExistsError } from './errors'
import type { Venue, Prisma } from '@prisma/client'

export class VenueService extends BaseService {
  /**
   * Create a new venue for a user
   */
  async createVenue(
    userId: string,
    data: {
      name: string
      description?: string
      address?: string
      city?: string
      state?: string
      zipCode?: string
    }
  ): Promise<Venue> {
    const slug = slugify(data.name)

    // Check for existing venue with same slug
    const existing = await this.prisma.venue.findFirst({
      where: { slug, userId },
    })

    if (existing) {
      throw new VenueExistsError(
        `A venue with the name "${data.name}" already exists`
      )
    }

    try {
      const venue = await this.prisma.venue.create({
        data: {
          ...data,
          slug,
          userId,
          isActive: true,
        },
      })

      this.logger.info(`Venue created: ${venue.id} by user ${userId}`)
      return venue
    } catch (error) {
      return this.handleError(error, 'VenueService.createVenue')
    }
  }

  /**
   * Update venue information
   */
  async updateVenue(
    venueId: string,
    userId: string,
    data: Partial<Omit<Venue, 'id' | 'userId' | 'createdAt'>>
  ): Promise<Venue> {
    // Verify ownership
    await this.getVenueByIdForUser(venueId, userId)

    try {
      const venue = await this.prisma.venue.update({
        where: { id: venueId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      })

      this.logger.info(`Venue updated: ${venue.id}`)
      return venue
    } catch (error) {
      return this.handleError(error, 'VenueService.updateVenue')
    }
  }

  /**
   * Get venue by ID, verify ownership
   */
  async getVenueByIdForUser(
    venueId: string,
    userId: string
  ): Promise<Venue> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, userId },
    })

    if (!venue) {
      throw new VenueNotFoundError(
        `Venue ${venueId} not found or access denied`
      )
    }

    return venue
  }

  /**
   * Delete a venue
   */
  async deleteVenue(venueId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getVenueByIdForUser(venueId, userId)

    try {
      await this.prisma.venue.update({
        where: { id: venueId },
        data: { isActive: false },
      })

      this.logger.info(`Venue soft-deleted: ${venueId}`)
    } catch (error) {
      return this.handleError(error, 'VenueService.deleteVenue')
    }
  }

  /**
   * List all venues for a user
   */
  async listVenuesForUser(
    userId: string,
    options: {
      includeInactive?: boolean
      limit?: number
      offset?: number
    } = {}
  ): Promise<Venue[]> {
    const { includeInactive = false, limit = 100, offset = 0 } = options

    const where: Prisma.VenueWhereInput = { userId }
    if (!includeInactive) {
      where.isActive = true
    }

    return await this.prisma.venue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })
  }
}

// Export singleton instance
export const venueService = new VenueService()
```

```typescript
// src/lib/services/errors/venue-error.ts
export class VenueError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VenueError'
  }
}

export class VenueNotFoundError extends VenueError {
  constructor(message: string) {
    super(message)
    this.name = 'VenueNotFoundError'
  }
}

export class VenueExistsError extends VenueError {
  constructor(message: string) {
    super(message)
    this.name = 'VenueExistsError'
  }
}
```

---

### 1.2 Create Data Access Layer

**Impact**: Critical  
**Effort**: Medium  
**Rationale**: Centralizes data fetching with automatic caching and deduplication

#### Directory Structure

```
src/lib/data/
├── index.ts                    # Barrel export
├── venues.ts                   # Venue queries
├── users.ts                    # User queries
├── api-keys.ts                 # API key queries
├── support.ts                  # Support ticket queries
├── requests.ts                 # Song request queries
└── billing.ts                  # Billing/subscription queries
```

#### Implementation Example

```typescript
// src/lib/data/venues.ts
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import type { Venue, Prisma } from '@prisma/client'

/**
 * Get venue by ID with request memoization
 * Multiple calls with same ID = single DB query
 */
export const getVenueById = cache(
  async (venueId: string): Promise<Venue | null> => {
    return await prisma.venue.findUnique({
      where: { id: venueId },
    })
  }
)

/**
 * Get venue with full details including stats
 */
export const getVenueWithDetails = cache(
  async (venueId: string, userId: string) => {
    return await prisma.venue.findFirst({
      where: {
        id: venueId,
        userId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            requests: true,
            apiKeys: true,
          },
        },
        apiKeys: {
          where: { status: 'active' },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  }
)

/**
 * Get all venues for user with request counts
 */
export const getVenuesForUser = cache(
  async (
    userId: string,
    options: {
      includeInactive?: boolean
      limit?: number
    } = {}
  ) => {
    const { includeInactive = false, limit = 100 } = options

    const where: Prisma.VenueWhereInput = { userId }
    if (!includeInactive) {
      where.isActive = true
    }

    return await prisma.venue.findMany({
      where,
      include: {
        _count: {
          select: { requests: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
)

/**
 * Get venue stats for dashboard
 */
export const getVenueStats = cache(
  async (venueId: string, userId: string) => {
    // Verify ownership
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, userId },
    })

    if (!venue) return null

    // Parallel queries for stats
    const [totalRequests, activeRequests, todayRequests] = await Promise.all([
      prisma.request.count({ where: { venueId } }),
      prisma.request.count({
        where: { venueId, status: 'pending' },
      }),
      prisma.request.count({
        where: {
          venueId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ])

    return {
      totalRequests,
      activeRequests,
      todayRequests,
    }
  }
)
```

```typescript
// src/lib/data/users.ts
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export const getUserById = cache(async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
  })
})

export const getUserWithCustomer = cache(async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customer: {
        include: {
          subscription: true,
        },
      },
    },
  })
})

export const getUserProfile = cache(async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      businessName: true,
      phoneNumber: true,
      createdAt: true,
      customer: {
        select: {
          subscription: {
            select: {
              status: true,
              currentPeriodEnd: true,
              plan: {
                select: {
                  name: true,
                  interval: true,
                },
              },
            },
          },
        },
      },
    },
  })
})
```

---

### 1.3 Implement Server Actions

**Impact**: Critical  
**Effort**: High  
**Rationale**: Replace API routes with Server Actions for better performance and DX

#### Directory Structure

```
src/app/actions/
├── venue-actions.ts            # Venue CRUD
├── auth-actions.ts             # Authentication
├── api-key-actions.ts          # API key management
├── support-actions.ts          # Support tickets
├── billing-actions.ts          # Billing operations
└── types.ts                    # Action return types
```

#### Action Type Definitions

```typescript
// src/app/actions/types.ts
export type ActionResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export type FormState<T = void> = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  data?: T
} | null
```

#### Implementation Example

```typescript
// src/app/actions/venue-actions.ts
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'
import { venueService } from '@/lib/services/venue-service'
import { venueSchema, updateVenueSchema } from '@/lib/validation/venue'
import type { ActionResponse, FormState } from './types'
import type { Venue } from '@prisma/client'

/**
 * Create a new venue
 * Used with useFormState hook
 */
export async function createVenueAction(
  prevState: FormState<Venue>,
  formData: FormData
): Promise<FormState<Venue>> {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return {
      success: false,
      error: 'You must be logged in to create a venue',
    }
  }

  // Extract form data
  const rawData = {
    name: formData.get('name'),
    description: formData.get('description'),
    address: formData.get('address'),
    city: formData.get('city'),
    state: formData.get('state'),
    zipCode: formData.get('zipCode'),
  }

  // Validate
  const result = venueSchema.safeParse(rawData)

  if (!result.success) {
    return {
      success: false,
      error: 'Please check the form for errors',
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  // Create venue using service
  try {
    const venue = await venueService.createVenue(
      session.user.id,
      result.data
    )

    // Revalidate relevant paths
    revalidatePath('/dashboard/venues')
    revalidatePath('/dashboard')

    // Redirect to new venue page
    redirect(`/dashboard/venues/${venue.id}`)
  } catch (error) {
    if (error instanceof VenueExistsError) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: false,
      error: 'Failed to create venue. Please try again.',
    }
  }
}

/**
 * Update venue information
 */
export async function updateVenueAction(
  venueId: string,
  prevState: FormState<Venue>,
  formData: FormData
): Promise<FormState<Venue>> {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return {
      success: false,
      error: 'Unauthorized',
    }
  }

  const rawData = Object.fromEntries(formData)
  const result = updateVenueSchema.safeParse(rawData)

  if (!result.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  try {
    const venue = await venueService.updateVenue(
      venueId,
      session.user.id,
      result.data
    )

    revalidatePath(`/dashboard/venues/${venueId}`)
    revalidatePath('/dashboard/venues')

    return {
      success: true,
      data: venue,
    }
  } catch (error) {
    if (error instanceof VenueNotFoundError) {
      return {
        success: false,
        error: 'Venue not found',
      }
    }

    return {
      success: false,
      error: 'Failed to update venue',
    }
  }
}

/**
 * Delete venue (soft delete)
 */
export async function deleteVenueAction(
  venueId: string
): Promise<ActionResponse> {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return {
      success: false,
      error: 'Unauthorized',
    }
  }

  try {
    await venueService.deleteVenue(venueId, session.user.id)

    revalidatePath('/dashboard/venues')
    revalidatePath('/dashboard')

    return { success: true, data: undefined }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to delete venue',
    }
  }
}

/**
 * Toggle venue accepting requests
 */
export async function toggleVenueAcceptingAction(
  venueId: string,
  accepting: boolean
): Promise<ActionResponse<Venue>> {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return {
      success: false,
      error: 'Unauthorized',
    }
  }

  try {
    const venue = await venueService.updateVenue(
      venueId,
      session.user.id,
      { acceptingRequests: accepting }
    )

    revalidatePath(`/dashboard/venues/${venueId}`)
    revalidateTag(`venue-${venueId}`)

    return {
      success: true,
      data: venue,
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to update venue status',
    }
  }
}
```

#### Client Component Using Server Action

```typescript
// src/components/features/venues/venue-form.tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createVenueAction } from '@/app/actions/venue-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

const initialState = null

export function VenueForm() {
  const [state, formAction] = useFormState(createVenueAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="name">Venue Name</Label>
        <Input
          id="name"
          name="name"
          required
          aria-invalid={!!state?.fieldErrors?.name}
        />
        {state?.fieldErrors?.name && (
          <p className="text-sm text-red-500 mt-1">
            {state.fieldErrors.name[0]}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" />
        {state?.fieldErrors?.address && (
          <p className="text-sm text-red-500 mt-1">
            {state.fieldErrors.address[0]}
          </p>
        )}
      </div>

      {/* More fields... */}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating...' : 'Create Venue'}
    </Button>
  )
}
```

---

### 1.4 Migrate API Routes to Server Actions

**Impact**: Critical  
**Effort**: High (incremental)  
**Timeline**: Gradual migration

#### Migration Priority

**Phase 1 (Week 1)**: High-frequency mutations
- ✅ Venue CRUD operations
- ✅ API key generation/revocation
- ✅ User profile updates

**Phase 2 (Week 2)**: Medium-frequency operations
- ✅ Support ticket creation/updates
- ✅ Song request submissions
- ✅ Settings updates

**Phase 3 (Later)**: Keep as API routes
- ❌ Webhook handlers (Stripe, etc.)
- ❌ External API integrations (OpenKJ)
- ❌ Public API endpoints (need REST)

#### Migration Checklist (Per Route)

```typescript
// Step 1: Create corresponding Server Action
// src/app/actions/[feature]-actions.ts
'use server'
export async function performAction(formData: FormData) {
  // Implementation
}

// Step 2: Create service method
// src/lib/services/[feature]-service.ts
export class FeatureService {
  async performOperation() {
    // Business logic
  }
}

// Step 3: Update client components to use action
// src/components/features/[feature]/form.tsx
'use client'
import { useFormState } from 'react-dom'
import { performAction } from '@/app/actions/[feature]-actions'

// Step 4: Remove old API route
// Delete: src/app/api/[feature]/route.ts

// Step 5: Update tests
// Update: src/__tests__/actions/[feature]-actions.test.ts
```

---

## Phase 2: Performance & Optimization (Week 3-4)

### Priority: HIGH

---

### 2.1 Implement Suspense Boundaries & Streaming

**Impact**: High  
**Effort**: Medium  
**Rationale**: Dramatically improves perceived performance

#### Page Structure Pattern

```typescript
// src/app/dashboard/venues/[id]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'
import { getVenueById } from '@/lib/data/venues'
import { VenueHeader } from './venue-header'
import { VenueStats } from './venue-stats'
import { VenueRequests } from './venue-requests'
import { VenueSettings } from './venue-settings'
import {
  VenueStatsSkeleton,
  VenueRequestsSkeleton,
  VenueSettingsSkeleton,
} from './skeletons'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function VenuePage({ params }: PageProps) {
  const { id } = await params
  const session = await getAuthSession()

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  // Fetch only critical data for initial render
  const venue = await getVenueById(id)

  if (!venue || venue.userId !== session.user.id) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Renders immediately - no async data */}
      <VenueHeader venue={venue} />

      {/* Each section streams independently */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Suspense fallback={<VenueStatsSkeleton />}>
          <VenueStats venueId={id} />
        </Suspense>

        <Suspense fallback={<VenueSettingsSkeleton />}>
          <VenueSettings venueId={id} userId={session.user.id} />
        </Suspense>
      </div>

      <Suspense fallback={<VenueRequestsSkeleton />}>
        <VenueRequests venueId={id} />
      </Suspense>
    </div>
  )
}

// Separate async component for stats
async function VenueStats({ venueId }: { venueId: string }) {
  // This can take time - page doesn't wait
  const stats = await getVenueStats(venueId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Requests" value={stats.totalRequests} />
          <StatCard label="Active" value={stats.activeRequests} />
          <StatCard label="Today" value={stats.todayRequests} />
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Loading Skeletons

```typescript
// src/app/dashboard/venues/[id]/skeletons.tsx
export function VenueStatsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function VenueRequestsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gray-200 animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full bg-gray-200 animate-pulse rounded" />
                <div className="h-3 w-2/3 bg-gray-200 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Dedicated Loading Files

```typescript
// src/app/dashboard/venues/loading.tsx
export default function VenuesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-10 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
              <div className="h-4 w-full bg-gray-200 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-2/3 bg-gray-200 animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

---

### 2.2 Optimize Data Fetching with Parallel Queries

**Impact**: High  
**Effort**: Low  
**Rationale**: Reduces total query time significantly

#### Before (Sequential)

```typescript
export default async function DashboardPage() {
  const session = await getAuthSession() // 50ms
  const user = await getUserProfile(session.user.id) // 100ms
  const venues = await getVenuesForUser(session.user.id) // 150ms
  const requests = await getRecentRequests(session.user.id) // 200ms
  const stats = await getDashboardStats(session.user.id) // 100ms
  // Total: ~600ms
}
```

#### After (Parallel)

```typescript
export default async function DashboardPage() {
  const session = await getAuthSession() // 50ms

  // All queries run in parallel
  const [user, venues, requests, stats] = await Promise.all([
    getUserProfile(session.user.id),
    getVenuesForUser(session.user.id),
    getRecentRequests(session.user.id),
    getDashboardStats(session.user.id),
  ])
  // Total: ~200ms (time of slowest query)
}
```

#### With Suspense (Best)

```typescript
export default async function DashboardPage() {
  const session = await getAuthSession()

  return (
    <>
      {/* Immediate render */}
      <DashboardHeader />

      {/* Each streams independently */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards userId={session.user.id} />
      </Suspense>

      <div className="grid grid-cols-2 gap-6">
        <Suspense fallback={<VenuesListSkeleton />}>
          <VenuesList userId={session.user.id} />
        </Suspense>

        <Suspense fallback={<RequestsListSkeleton />}>
          <RequestsList userId={session.user.id} />
        </Suspense>
      </div>
    </>
  )
}
```

---

### 2.3 Implement Proper Caching Strategy

**Impact**: High  
**Effort**: Medium  
**Rationale**: Reduces database load and improves response times

#### Cache Strategy

```typescript
// src/lib/data/venues.ts
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

/**
 * Request-level caching (using React cache)
 * Deduplicates within a single request
 */
export const getVenueById = cache(async (venueId: string) => {
  return await prisma.venue.findUnique({
    where: { id: venueId },
  })
})

/**
 * Full route cache (using Next.js cache)
 * Persists across requests
 */
export const getPublicVenues = unstable_cache(
  async (city?: string) => {
    return await prisma.venue.findMany({
      where: {
        isActive: true,
        ...(city && { city }),
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
      },
    })
  },
  ['public-venues'],
  {
    revalidate: 300, // 5 minutes
    tags: ['venues'],
  }
)

/**
 * Revalidate on-demand
 */
import { revalidateTag } from 'next/cache'

export async function revalidateVenues() {
  revalidateTag('venues')
}
```

#### Route Segment Config

```typescript
// src/app/dashboard/venues/[id]/page.tsx

// Revalidate every 60 seconds
export const revalidate = 60

// Or force dynamic
export const dynamic = 'force-dynamic'

// Or force static
export const dynamic = 'force-static'
```

---

### 2.4 Convert Home Page to Server Component

**Impact**: Medium  
**Effort**: Low  
**Rationale**: Improve initial load performance and SEO

#### Current (All Client)

```typescript
// src/app/page.tsx
'use client'

export default function HomePage() {
  const { data: session } = useSession()
  // Entire page re-renders on client
}
```

#### Refactored (Server + Client)

```typescript
// src/app/page.tsx (Server Component)
import { getAuthSession } from '@/lib/auth-server'
import { HomePageContent } from './home-client'

export default async function HomePage() {
  const session = await getAuthSession()

  return <HomePageContent initialSession={session} />
}

// src/app/home-client.tsx (Client Component)
'use client'

import { Session } from 'next-auth'
import { Navigation } from './navigation-client'

interface Props {
  initialSession: Session | null
}

export function HomePageContent({ initialSession }: Props) {
  return (
    <div>
      <Navigation session={initialSession} />
      {/* Static content rendered on server */}
      <StaticHeroSection />
      <StaticFeaturesSection />
      {/* ... */}
    </div>
  )
}
```

---

## Phase 3: Testing Infrastructure (Week 4-5)

### Priority: HIGH

---

### 3.1 Setup Testing Framework

**Impact**: Critical (for long-term maintainability)  
**Effort**: Medium  
**Rationale**: Enable confident refactoring and prevent regressions

#### Install Dependencies

```bash
npm install --save-dev \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @vitejs/plugin-react \
  @vitest/ui \
  msw \
  dotenv
```

#### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        '**/*.config.*',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

```typescript
// vitest.setup.ts
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import '@testing-library/jest-dom'

expect.extend(matchers)

afterEach(() => {
  cleanup()
})

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '',
}))
```

---

### 3.2 Write Tests for Services

**Impact**: High  
**Effort**: Medium

```typescript
// src/lib/services/__tests__/venue-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VenueService } from '../venue-service'
import { VenueExistsError, VenueNotFoundError } from '../errors'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    venue: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe('VenueService', () => {
  let service: VenueService

  beforeEach(() => {
    service = new VenueService()
    vi.clearAllMocks()
  })

  describe('createVenue', () => {
    it('should create a venue with valid data', async () => {
      const mockVenue = {
        id: 'venue-123',
        name: 'Test Venue',
        slug: 'test-venue',
        userId: 'user-123',
      }

      prisma.venue.findFirst.mockResolvedValue(null)
      prisma.venue.create.mockResolvedValue(mockVenue)

      const result = await service.createVenue('user-123', {
        name: 'Test Venue',
      })

      expect(result).toEqual(mockVenue)
      expect(prisma.venue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Venue',
          slug: 'test-venue',
          userId: 'user-123',
        }),
      })
    })

    it('should throw VenueExistsError if venue exists', async () => {
      prisma.venue.findFirst.mockResolvedValue({
        id: 'existing-venue',
        slug: 'test-venue',
      })

      await expect(
        service.createVenue('user-123', { name: 'Test Venue' })
      ).rejects.toThrow(VenueExistsError)
    })
  })

  describe('updateVenue', () => {
    it('should update venue successfully', async () => {
      const mockVenue = { id: 'venue-123', name: 'Updated Name' }

      prisma.venue.findFirst.mockResolvedValue(mockVenue)
      prisma.venue.update.mockResolvedValue(mockVenue)

      const result = await service.updateVenue(
        'venue-123',
        'user-123',
        { name: 'Updated Name' }
      )

      expect(result.name).toBe('Updated Name')
    })

    it('should throw VenueNotFoundError if venue not found', async () => {
      prisma.venue.findFirst.mockResolvedValue(null)

      await expect(
        service.updateVenue('venue-123', 'user-123', { name: 'New Name' })
      ).rejects.toThrow(VenueNotFoundError)
    })
  })
})
```

---

### 3.3 Write Tests for Server Actions

```typescript
// src/app/actions/__tests__/venue-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createVenueAction, updateVenueAction } from '../venue-actions'

vi.mock('@/lib/auth-server', () => ({
  getAuthSession: vi.fn(),
}))

vi.mock('@/lib/services/venue-service', () => ({
  venueService: {
    createVenue: vi.fn(),
    updateVenue: vi.fn(),
  },
}))

describe('venue-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createVenueAction', () => {
    it('should return error if not authenticated', async () => {
      getAuthSession.mockResolvedValue(null)

      const formData = new FormData()
      formData.append('name', 'Test Venue')

      const result = await createVenueAction(null, formData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('logged in')
    })

    it('should return field errors on validation failure', async () => {
      getAuthSession.mockResolvedValue({ user: { id: 'user-123' } })

      const formData = new FormData()
      // Missing required name field

      const result = await createVenueAction(null, formData)

      expect(result.success).toBe(false)
      expect(result.fieldErrors).toBeDefined()
    })

    it('should create venue successfully', async () => {
      getAuthSession.mockResolvedValue({ user: { id: 'user-123' } })
      venueService.createVenue.mockResolvedValue({
        id: 'venue-123',
        name: 'Test Venue',
      })

      const formData = new FormData()
      formData.append('name', 'Test Venue')
      formData.append('city', 'Portland')

      // Note: This will redirect, so we catch the error
      await expect(
        createVenueAction(null, formData)
      ).rejects.toThrow() // redirect throws

      expect(venueService.createVenue).toHaveBeenCalled()
    })
  })
})
```

---

### 3.4 Write Tests for Components

```typescript
// src/components/features/venues/__tests__/venue-form.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VenueForm } from '../venue-form'

describe('VenueForm', () => {
  it('should render form fields', () => {
    render(<VenueForm />)

    expect(screen.getByLabelText(/venue name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create venue/i })).toBeInTheDocument()
  })

  it('should show validation errors', async () => {
    const user = userEvent.setup()
    render(<VenueForm />)

    const submitButton = screen.getByRole('button', { name: /create venue/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    render(<VenueForm />)

    await user.type(screen.getByLabelText(/venue name/i), 'Test Venue')
    await user.type(screen.getByLabelText(/address/i), '123 Main St')

    const submitButton = screen.getByRole('button', { name: /create venue/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(submitButton).toHaveTextContent(/creating/i)
    })
  })
})
```

---

### 3.5 Integration Tests

```typescript
// src/__tests__/integration/venue-flow.test.ts
import { describe, it, expect } from 'vitest'
import { createMocks } from 'node-mocks-http'

describe('Venue Creation Flow', () => {
  it('should complete full venue creation flow', async () => {
    // 1. User authenticates
    const session = await getAuthSession()
    expect(session).toBeDefined()

    // 2. Create venue via Server Action
    const formData = new FormData()
    formData.append('name', 'Integration Test Venue')
    formData.append('city', 'Portland')

    const result = await createVenueAction(null, formData)
    expect(result.success).toBe(true)

    // 3. Verify venue exists in database
    const venue = await prisma.venue.findFirst({
      where: { name: 'Integration Test Venue' },
    })
    expect(venue).toBeDefined()
    expect(venue?.city).toBe('Portland')

    // 4. Clean up
    await prisma.venue.delete({ where: { id: venue!.id } })
  })
})
```

---

## Phase 4: Error Handling & Resilience (Week 5-6)

### Priority: MEDIUM-HIGH

---

### 4.1 Standardized Error Handling

**Impact**: Medium  
**Effort**: Medium

#### Error Class Hierarchy

```typescript
// src/lib/errors/base-error.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 400)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
  }
}
```

#### Global Error Handler

```typescript
// src/lib/middleware/error-handler.ts
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError } from '@/lib/errors/base-error'
import { logger } from '@/lib/logger'

export function handleError(error: unknown): NextResponse {
  // Log error
  logger.error('Error occurred:', error)

  // Handle known errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
        },
      },
      { status: error.statusCode }
    )
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    )
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        {
          error: {
            message: 'A record with this value already exists',
            code: 'DUPLICATE_ENTRY',
          },
        },
        { status: 409 }
      )
    }
  }

  // Unknown error - don't expose details
  return NextResponse.json(
    {
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    },
    { status: 500 }
  )
}
```

---

### 4.2 Error Boundaries for Routes

```typescript
// src/app/dashboard/venues/error.tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function VenuesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error('Venues page error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
      <AlertTriangle className="h-16 w-16 text-red-500" />
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="text-gray-600 text-center max-w-md">
        We're having trouble loading your venues. This might be a temporary issue.
      </p>
      <div className="flex gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">Go to Dashboard</a>
        </Button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-500">
            Error details (dev only)
          </summary>
          <pre className="mt-2 text-xs bg-gray-100 p-4 rounded overflow-auto">
            {error.message}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  )
}
```

---

### 4.3 Not Found Pages

```typescript
// src/app/dashboard/venues/[id]/not-found.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MapPin } from 'lucide-react'

export default function VenueNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
      <MapPin className="h-16 w-16 text-gray-400" />
      <h2 className="text-2xl font-bold">Venue Not Found</h2>
      <p className="text-gray-600 text-center max-w-md">
        The venue you're looking for doesn't exist or you don't have access to it.
      </p>
      <Button asChild>
        <Link href="/dashboard/venues">View All Venues</Link>
      </Button>
    </div>
  )
}
```

---

## Phase 5: Code Quality & Organization (Week 6-7)

### Priority: MEDIUM

---

### 5.1 Reorganize Components

**Impact**: Medium  
**Effort**: Medium

#### Target Structure

```
src/components/
├── ui/                         # Base UI primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
├── features/                   # Feature-specific components
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   └── password-reset-form.tsx
│   ├── venues/
│   │   ├── venue-form.tsx
│   │   ├── venue-card.tsx
│   │   ├── venue-list.tsx
│   │   └── venue-stats.tsx
│   ├── api-keys/
│   │   ├── api-key-form.tsx
│   │   ├── api-key-card.tsx
│   │   └── api-key-actions.tsx
│   ├── billing/
│   │   ├── pricing-plans.tsx
│   │   ├── subscription-card.tsx
│   │   └── payment-form.tsx
│   └── support/
│       ├── ticket-list.tsx
│       ├── ticket-form.tsx
│       └── ticket-thread.tsx
├── layouts/                    # Layout components
│   ├── dashboard-layout.tsx
│   ├── admin-layout.tsx
│   └── auth-layout.tsx
└── shared/                     # Shared across features
    ├── header.tsx
    ├── navigation.tsx
    ├── footer.tsx
    └── sidebar.tsx
```

---

### 5.2 Consolidate Utilities

```
src/lib/
├── core/                       # Core infrastructure
│   ├── auth.ts
│   ├── prisma.ts
│   ├── stripe.ts
│   └── logger.ts
├── data/                       # Data access layer
│   ├── users.ts
│   ├── venues.ts
│   ├── api-keys.ts
│   └── ...
├── services/                   # Business logic
│   ├── venue-service.ts
│   ├── auth-service.ts
│   └── ...
├── validation/                 # Zod schemas
│   ├── auth.ts
│   ├── venue.ts
│   ├── api-key.ts
│   └── ...
├── utils/                      # Pure utilities
│   ├── format.ts              # Formatting functions
│   ├── string.ts              # String manipulation
│   ├── date.ts                # Date utilities
│   └── async.ts               # Async helpers
└── errors/                     # Error classes
    ├── base-error.ts
    ├── venue-error.ts
    └── ...
```

---

### 5.3 Add Barrel Exports

```typescript
// src/components/ui/index.ts
export * from './button'
export * from './card'
export * from './input'
export * from './label'
export * from './dialog'
// ... etc

// Usage
import { Button, Card, Input, Label } from '@/components/ui'
```

```typescript
// src/lib/data/index.ts
export * from './users'
export * from './venues'
export * from './api-keys'
export * from './support'
export * from './billing'
```

---

### 5.4 Implement Consistent Naming

**Pattern**: Choose one and stick with it

**Option A (Recommended)**: kebab-case for all files
```
venue-form.tsx
api-key-actions.tsx
dashboard-header.tsx
```

**Option B**: PascalCase matching component names
```
VenueForm.tsx
ApiKeyActions.tsx
DashboardHeader.tsx
```

---

## Phase 6: Documentation & DX (Week 7-8)

### Priority: MEDIUM-LOW

---

### 6.1 API Documentation

```typescript
/**
 * Create a new venue
 *
 * @serverAction
 * @auth Required - User must be authenticated
 * @param formData - Form data containing venue information
 * @returns FormState with success or error information
 *
 * @example
 * ```tsx
 * import { useFormState } from 'react-dom'
 * import { createVenueAction } from '@/app/actions/venue-actions'
 *
 * const [state, formAction] = useFormState(createVenueAction, null)
 *
 * <form action={formAction}>
 *   <input name="name" required />
 *   <button type="submit">Create</button>
 * </form>
 * ```
 */
export async function createVenueAction(
  prevState: FormState<Venue>,
  formData: FormData
): Promise<FormState<Venue>>
```

---

### 6.2 Architecture Documentation

Create `docs/` directory:

```
docs/
├── ARCHITECTURE.md             # High-level architecture
├── SERVER_ACTIONS.md           # Server Actions guide
├── DATA_FETCHING.md            # Data fetching patterns
├── ERROR_HANDLING.md           # Error handling guide
├── TESTING.md                  # Testing guide
└── DEPLOYMENT.md               # Deployment guide
```

---

### 6.3 Developer Scripts

```json
// package.json
{
  "scripts": {
    // ... existing scripts
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "db:reset": "prisma migrate reset --force && npm run db:seed",
    "db:reset:test": "NODE_ENV=test prisma migrate reset --force",
    "dev:https": "next dev --experimental-https",
    "type-check:strict": "tsc --noEmit --strict",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "lint:strict": "next lint --max-warnings 0"
  }
}
```

---

## Implementation Timeline

### Week 1-2: Critical Foundation
- [ ] Day 1-2: Setup service layer
- [ ] Day 3-4: Create data access layer
- [ ] Day 5-6: Implement first Server Actions (venues)
- [ ] Day 7-8: Implement more Server Actions (api-keys, auth)
- [ ] Day 9-10: Migrate remaining CRUD operations to Server Actions

### Week 3-4: Performance Optimization
- [ ] Day 11-12: Add Suspense boundaries to main pages
- [ ] Day 13-14: Create loading skeletons
- [ ] Day 15-16: Optimize data fetching (parallel queries)
- [ ] Day 17-18: Implement caching strategy
- [ ] Day 19-20: Refactor home page to Server Component

### Week 4-5: Testing
- [ ] Day 21-22: Setup testing framework
- [ ] Day 23-24: Write service tests
- [ ] Day 25-26: Write Server Action tests
- [ ] Day 27-28: Write component tests
- [ ] Day 29-30: Write integration tests

### Week 5-6: Error Handling
- [ ] Day 31-32: Create error class hierarchy
- [ ] Day 33-34: Add error boundaries to routes
- [ ] Day 35-36: Implement not-found pages
- [ ] Day 37-38: Standardize error responses
- [ ] Day 39-40: Add error logging

### Week 6-7: Code Organization
- [ ] Day 41-42: Reorganize components
- [ ] Day 43-44: Consolidate utilities
- [ ] Day 45-46: Add barrel exports
- [ ] Day 47-48: Implement consistent naming

### Week 7-8: Documentation & Polish
- [ ] Day 49-50: Write architecture docs
- [ ] Day 51-52: Add API documentation
- [ ] Day 53-54: Create developer guides
- [ ] Day 55-56: Final testing and cleanup

---

## Success Metrics

### Performance
- **TTFB**: < 200ms (down from ~500ms)
- **FCP**: < 1.5s (down from ~3s)
- **LCP**: < 2.5s (down from ~4s)
- **Network Requests**: -30% (Server Actions vs API routes)
- **Bundle Size**: -15% (better tree-shaking)

### Code Quality
- **Test Coverage**: > 80%
- **Type Safety**: 0 `any` types
- **Linting Errors**: 0
- **Build Warnings**: 0

### Developer Experience
- **Build Time**: < 30s
- **Hot Reload**: < 2s
- **Type Check**: < 10s

---

## Risk Mitigation

### Risk 1: Breaking Changes During Migration
**Mitigation**: 
- Implement feature flags
- Deploy behind feature toggles
- Keep API routes during transition
- Gradual rollout by feature

### Risk 2: Performance Regression
**Mitigation**:
- Lighthouse CI in pipeline
- Load testing before deployment
- Rollback plan for each phase

### Risk 3: Database Query Performance
**Mitigation**:
- Add database indexes
- Monitor slow queries
- Implement query caching
- Use database connection pooling

### Risk 4: Test Coverage Gaps
**Mitigation**:
- Prioritize critical paths
- Integration tests for main flows
- Manual QA for complex features

---

## Post-Refactor Maintenance

### Weekly
- Review performance metrics
- Check error logs
- Monitor test coverage

### Monthly
- Update dependencies
- Review and refactor problematic code
- Optimize slow queries

### Quarterly
- Major dependency updates
- Architecture review
- Performance audit

---

## Conclusion

This refactor plan provides a comprehensive roadmap to transform the Singr Karaoke Connect application into a modern, performant, and maintainable Next.js 15 application. By following this phased approach, you'll:

1. **Improve Performance**: 30-40% faster load times through Server Actions and Suspense streaming
2. **Enhance Maintainability**: Clear separation of concerns with service and data access layers
3. **Increase Confidence**: Comprehensive test coverage enables safe refactoring
4. **Better Developer Experience**: Standardized patterns and documentation
5. **Future-Proof**: Aligned with Next.js 15+ best practices

**Key Priorities**:
1. ⚠️ **CRITICAL**: Service layer + Data access layer + Server Actions (Weeks 1-2)
2. 🚀 **HIGH**: Suspense streaming + Performance optimization (Weeks 3-4)
3. ✅ **HIGH**: Testing infrastructure (Weeks 4-5)
4. 🛡️ **MEDIUM**: Error handling (Weeks 5-6)
5. 📁 **MEDIUM**: Code organization (Weeks 6-7)
6. 📚 **LOW**: Documentation (Week 7-8)

The plan is designed to be executed incrementally while keeping the application functional. Each phase builds on the previous one, and you can adjust the timeline based on your team's capacity and priorities.
