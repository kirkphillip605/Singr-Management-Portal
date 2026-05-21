// Better Auth session shape used throughout the app via getAuthSession().
//
// The unified Better Auth instance (packages/auth/src/server.ts) exposes a
// `roles` array on every session. `accountType` and `adminLevel` are derived
// from that array for back-compat with legacy code.

export type AppRole = 'host' | 'singer' | 'support' | 'super_admin'
export type AppAccountType = 'customer' | 'admin' | 'support'
export type AppAdminLevel = 'support' | 'super_admin'

export interface AppSessionUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  roles: AppRole[]
  /** Derived from `roles` — kept for legacy callers. */
  accountType: AppAccountType
  /** Derived from `roles` — kept for legacy callers. */
  adminLevel?: AppAdminLevel
  adminId?: string
  userId?: string
  businessName?: string
  displayName?: string
  avatarUrl?: string
  mustSetPassword?: boolean
  stripeCustomerId?: string
  banned?: boolean
}

export interface AppSession {
  user: AppSessionUser
  session: {
    id: string
    token: string
    userId: string
    expiresAt: Date
  }
}
